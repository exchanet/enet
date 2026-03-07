import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import readline from 'readline'
import { detectSystemAgents, getInstallPath, AGENTS } from '../utils/agent_detector.js'
import { getMethod, fetchFromGitHub, readInstallRecord, writeInstallRecord } from '../utils/registry.js'

export async function installCommand(methodId, options) {
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
      targetAgents = await checkboxSelect(detected, method, alreadyInstalled)
    }

    if (targetAgents.length === 0) {
      console.log(chalk.dim('\n  Nothing selected. Cancelled.\n'))
      process.exit(0)
    }
  }

  console.log()

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
// Checkbox selection UI
//
// Shows all detected agents with tags:
//   — installed   already present on disk for this method
//   — new         detected but never installed for this method
// ─────────────────────────────────────────────────────────────────

async function checkboxSelect(detected, method, alreadyInstalled = new Set()) {
  const available   = detected.filter(a =>  method.adapters[a.key] || method.adapters['generic'])
  const unavailable = detected.filter(a => !method.adapters[a.key] && !method.adapters['generic'])

  if (available.length === 0) {
    console.log(chalk.yellow('  ⚠ No adapters available for your detected agents.'))
    console.log(chalk.dim(`  Adapters in this method: ${Object.keys(method.adapters).join(', ')}\n`))
    process.exit(1)
  }

  const items = available.map(a => ({
    agent:       a,
    checked:     true,
    installed:   alreadyInstalled.has(a.key),
    usesGeneric: !method.adapters[a.key]
  }))

  console.log(chalk.white('  Select adapters to install:\n'))

  return new Promise((resolve) => {
    let cursor = 0

    const lineCount = () => items.length + (unavailable.length > 0 ? 3 : 2) + 2

    const render = () => {
      if (render.drawn) process.stdout.write(`\x1B[${lineCount()}A`)
      render.drawn = true

      items.forEach((item, i) => {
        const isCursor = i === cursor
        const box     = item.checked     ? chalk.green('[✓]')           : chalk.dim('[ ]')
        const arrow   = isCursor         ? chalk.cyan(' ❯ ')            : '   '
        const name    = isCursor         ? chalk.white(item.agent.name) : chalk.dim(item.agent.name)
        const status  = item.installed   ? chalk.dim(' — installed')    : chalk.yellow(' — new')
        const generic = item.usesGeneric ? chalk.dim(' (generic adapter)') : ''
        process.stdout.write(`${arrow}${box} ${name}${status}${generic}\n`)
      })

      if (unavailable.length > 0) {
        process.stdout.write(chalk.dim(`\n  No adapter for: ${unavailable.map(a => a.name).join(', ')}\n`))
      }
      process.stdout.write('\n')
      process.stdout.write(chalk.dim('  ↑↓ navigate · Space toggle · A all · Enter confirm · Ctrl+C cancel\n\n'))
    }

    render()

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()

    process.stdin.on('data', (key) => {
      const k = key.toString()
      if      (k === '\u001b[A') { cursor = (cursor - 1 + items.length) % items.length; render() }
      else if (k === '\u001b[B') { cursor = (cursor + 1) % items.length; render() }
      else if (k === ' ')        { items[cursor].checked = !items[cursor].checked; render() }
      else if (k === 'a' || k === 'A') {
        const all = items.every(i => i.checked)
        items.forEach(i => { i.checked = !all })
        render()
      }
      else if (k === '\r' || k === '\n') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.pause()
        rl.close()
        const selected = items.filter(i => i.checked).map(i => i.agent)
        if (selected.length > 0) {
          console.log(chalk.dim(`\n  Installing for: ${selected.map(a => a.name).join(', ')}\n`))
        }
        resolve(selected)
      }
      else if (k === '\u0003') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.pause()
        rl.close()
        console.log('\n')
        process.exit(0)
      }
    })
  })
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
