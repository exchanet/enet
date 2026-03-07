import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import enquirer from 'enquirer'
const { MultiSelect, Select } = enquirer
import { detectSystemAgents, getInstallPath, AGENTS } from '../utils/agent_detector.js'
import { getMethod, fetchFromGitHub, readInstallRecord, writeInstallRecord } from '../utils/registry.js'

export async function installCommand(methodId, options) {
  if (options.project) options.global = false
  // 1. Load method from registry
  const spinner = ora('Fetching registry...').start()
  const method = await getMethod(methodId).catch(() => null)
  spinner.stop()

  if (!method) {
    console.log(chalk.red(`\n  ✗ Unknown method: "${methodId}"`))
    console.log(chalk.dim(`  Run ${chalk.white('enet list')} to see available methods.\n`))
    process.exit(1)
  }

  console.log(chalk.bold(`\n  ◆ ${method.name}`))
  console.log(chalk.dim(`  ${method.description}\n`))

  // 2. Read existing install record — know what is already installed
  const record = await readInstallRecord(methodId)
  const alreadyInstalled = new Set(record?.agents ?? [])

  if (alreadyInstalled.size > 0) {
    console.log(chalk.dim(`  Already installed for: ${[...alreadyInstalled].join(', ')}\n`))
  }

  // 3. Determine target agents
  let targetAgents = []

  if (options.agent) {
    // --agent flag: bypass detection and checkbox entirely
    if (!AGENTS[options.agent]) {
      console.log(chalk.red(`  ✗ Unknown agent: "${options.agent}"`))
      console.log(chalk.dim(`  Valid: ${Object.keys(AGENTS).filter(k => k !== 'generic').join(', ')}\n`))
      process.exit(1)
    }
    targetAgents = [{ key: options.agent, ...AGENTS[options.agent] }]

  } else {
    const detected = await detectSystemAgents()

    if (detected.length === 0) {
      console.log(chalk.yellow('  ⚠ No AI agents detected on this system.'))
      console.log(chalk.dim(`  Use ${chalk.white('--agent <n>')} to force an agent.`))
      console.log(chalk.dim(`  Valid: ${Object.keys(AGENTS).filter(k => k !== 'generic').join(', ')}\n`))
      process.exit(1)
    }

    if (options.all) {
      targetAgents = detected
    } else {
      // Always show checkbox — even with 1 agent, even on re-run
      targetAgents = await checkboxSelect(detected, method, alreadyInstalled, options)
    }

    if (targetAgents.length === 0) {
      console.log(chalk.dim('\n  Nothing selected. Cancelled.\n'))
      process.exit(0)
    }
  }

  // 3b. If neither -g nor -p was passed, ask: global or project?
  if (options.global === undefined && process.stdin.isTTY) {
    const destPrompt = new Select({
      name: 'destination',
      message: 'Install to:',
      choices: [
        { name: 'global', message: 'Global (home) — available for all agents and projects', value: true },
        { name: 'project', message: 'Project — this folder only', value: false }
      ]
    })
    try {
      options.global = await destPrompt.run()
    } catch {
      console.log(chalk.dim('\n  Cancelled.\n'))
      process.exit(0)
    }
  }
  // Default when not TTY or when skipped: global
  if (options.global === undefined) options.global = true

  if (options.global) {
    console.log(chalk.cyan('\n  Destination: global (home) — available for all agents/projects\n'))
  } else {
    console.log(chalk.dim('\n  Destination: this project only\n'))
  }

  // 4. Install each selected agent
  const newlyInstalled = []
  let schemaInstalled = false

  for (const agent of targetAgents) {
    const ok = await installForAgent(method, agent, options, schemaInstalled)
    schemaInstalled = true
    if (ok) newlyInstalled.push(agent.key)
  }

  // 5. Persist updated install record
  const updatedAgents = [...new Set([...alreadyInstalled, ...newlyInstalled])]
  await writeInstallRecord(methodId, { agents: updatedAgents, version: method.version })

  printHints(methodId)
}

// ─────────────────────────────────────────────────────────────────
// Adapter selection via Enquirer (works on Windows/PowerShell)
// ─────────────────────────────────────────────────────────────────

async function checkboxSelect(detected, method, alreadyInstalled = new Set(), options = {}) {
  const available   = detected.filter(a =>  method.adapters[a.key] || method.adapters['generic'])
  const unavailable = detected.filter(a => !method.adapters[a.key] && !method.adapters['generic'])

  if (available.length === 0) {
    console.log(chalk.yellow('  ⚠ No adapters available for your detected agents.'))
    console.log(chalk.dim(`  Adapters in this method: ${Object.keys(method.adapters).join(', ')}\n`))
    process.exit(1)
  }

  if (unavailable.length > 0) {
    console.log(chalk.dim(`  No adapter for: ${unavailable.map(a => a.name).join(', ')}\n`))
  }

  const scopeLabel = options.global === true ? 'global (home)' : options.global === false ? 'this project' : 'choose in next step'
  const prompt = new MultiSelect({
    name: 'agents',
    message: `Select adapters to install (destination: ${scopeLabel})`,
    choices: available.map(a => ({
      name: a.key,
      message: `${a.name}${alreadyInstalled.has(a.key) ? ' — installed' : ' — new'}${!method.adapters[a.key] ? ' (generic)' : ''}`,
      value: a,
      enabled: true
    })),
    result (names) {
      return this.options.choices.filter(c => names.includes(c.name)).map(c => c.value)
    }
  })

  if (!process.stdin.isTTY) {
    return available
  }

  try {
    const selected = await prompt.run()
    if (selected && selected.length > 0) {
      console.log(chalk.dim(`\n  Installing for: ${selected.map(a => a.name).join(', ')}\n`))
    }
    return selected || []
  } catch (err) {
    if (err.name === 'ENOTTY' || err.message?.includes('cancel')) {
      console.log(chalk.dim('\n  Cancelled.\n'))
      process.exit(0)
    }
    throw err
  }
}

// ─────────────────────────────────────────────────────────────────
// Install for one agent
// Exported so update.js can reuse it without duplication
// Returns true on success, false on failure/skip
// ─────────────────────────────────────────────────────────────────

export async function installForAgent(method, agent, options = {}, skipExtras = false) {
  const isGlobal    = options.global || false
  const adapterKey  = method.adapters[agent.key] ? agent.key : 'generic'
  const adapterPath = method.adapters[adapterKey]

  if (!adapterPath) {
    console.log(chalk.yellow(`  ⚠ ${agent.name} — no adapter found, skipping`))
    return false
  }

  if (isGlobal && !agent.globalInstallDir) {
    console.log(chalk.yellow(`  ⚠ ${agent.name} — global install not supported, skipping`))
    return false
  }

  const spinner = ora(`${agent.name}${isGlobal ? ' (global)' : ''}...`).start()

  try {
    const content     = await fetchFromGitHub(method.repo, adapterPath)
    const installPath = getInstallPath(agent, method.id, { global: isGlobal })

    await fs.ensureDir(path.dirname(installPath))

    // Windsurf: append to .windsurfrules — replace existing section if already present
    if (agent.key === 'windsurf' && await fs.pathExists(installPath)) {
      const existing = await fs.readFile(installPath, 'utf8')
      if (existing.includes(method.name)) {
        const marker = '\n\n---\n\n'
        const idx    = existing.indexOf(method.name)
        const before = existing.substring(0, existing.lastIndexOf(marker, idx) + marker.length)
        await fs.writeFile(installPath, before + content)
      } else {
        await fs.appendFile(installPath, `\n\n---\n\n${content}`)
      }
    } else {
      await fs.writeFile(installPath, content)
    }

    spinner.succeed(chalk.green(`${agent.name}`))
    console.log(chalk.dim(`  → ${installPath}`))
    console.log(chalk.dim(`  ${agent.configNote}\n`))

  } catch (err) {
    spinner.fail(chalk.red(`${agent.name} — ${err.message}`))
    return false
  }

  // Extras (schema, manifests…) — downloaded once across all agents
  if (!skipExtras && method.extras) {
    for (const [key, filePath] of Object.entries(method.extras)) {
      const s = ora(`Fetching ${key}...`).start()
      try {
        const content = await fetchFromGitHub(method.repo, filePath)
        await fs.writeFile(path.join(process.cwd(), path.basename(filePath)), content)
        s.succeed(chalk.dim(`${key} → ${path.basename(filePath)}`))
      } catch {
        s.warn(chalk.dim(`${key} not available (non-critical)`))
      }
    }
    console.log()
  }

  return true
}

// ─────────────────────────────────────────────────────────────────
// Post-install hints
// ─────────────────────────────────────────────────────────────────

function printHints(methodId) {
  if (methodId === 'modular-design') {
    console.log(chalk.dim('  Next steps:'))
    console.log(chalk.dim('  1. Give your agent a spectech (stack + modules needed)'))
    console.log(chalk.dim('  2. Agent declares architecture — confirm it'))
    console.log(chalk.dim('  3. Agent builds Core → modules → Admin Panel'))
    console.log()
    console.log(chalk.dim(`  ${chalk.white('enet new module <n>')}   scaffold your first module`))
    console.log(chalk.dim(`  ${chalk.white('enet validate')}             check manifests at any time\n`))
  }
  if (methodId === 'pdca-t') {
    console.log(chalk.dim('  Next steps:'))
    console.log(chalk.dim('  1. Start any coding task — the method activates automatically'))
    console.log(chalk.dim('  2. Your agent will follow the 8-phase quality cycle'))
    console.log(chalk.dim('  3. Every delivery includes a full test report'))
    console.log()
    console.log(chalk.dim(`  Works best alongside ${chalk.white('enet install modular-design')}.\n`))
  }
}
