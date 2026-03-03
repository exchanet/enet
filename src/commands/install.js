import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import readline from 'readline'
import { detectSystemAgents, getInstallPath, AGENTS } from '../utils/agent-detector.js'
import { getMethod, fetchFromGitHub } from '../utils/registry.js'

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
    const record = await readInstallRecord(methodId)
    const alreadyInstalled = new Set(record?.agents ?? [])
    if (alreadyInstalled.size > 0) {
      console.log(chalk.dim(`  Already installed for: ${[...alreadyInstalled].join(', ')}\n`))
    }

  // 2. Determine target agents
  let targetAgents = []

  if (options.agent) {
    // --agent flag: skip detection, install for this specific agent only
    if (!AGENTS[options.agent]) {
      console.log(chalk.red(`  ✗ Unknown agent: "${options.agent}"`))
      console.log(chalk.dim(`  Valid: ${Object.keys(AGENTS).filter(k => k !== 'generic').join(', ')}\n`))
      process.exit(1)
    }
    targetAgents = [{ key: options.agent, ...AGENTS[options.agent] }]

  } else {
    // Detect all agents installed on the system
    const detected = await detectSystemAgents()

    if (detected.length === 0) {
      console.log(chalk.yellow('  ⚠ No AI agents detected on this system.'))
      console.log(chalk.dim(`  Use ${chalk.white('--agent <name>')} to force an agent.`))
      console.log(chalk.dim(`  Valid: ${Object.keys(AGENTS).filter(k => k !== 'generic').join(', ')}\n`))
      process.exit(1)
    }

    // 3. Show checkbox selection — always, even with 1 agent detected
    //    This is the core UX fix: user always chooses, never surprised
    if (options.all) {
      // --all flag skips the prompt
      targetAgents = detected
    } else {
      targetAgents = await checkboxSelect(detected, method)
    }

    if (targetAgents.length === 0) {
      console.log(chalk.dim('\n  Nothing selected. Cancelled.\n'))
      process.exit(0)
    }
  }

  console.log()

  // 4. Install for each selected agent
  let schemaInstalled = false
  for (const agent of targetAgents) {
    await installForAgent(method, agent, options, schemaInstalled)
    schemaInstalled = true
  }

  printHints(methodId)
}

// ─────────────────────────────────────────────────────────────────
// Checkbox selection UI
// ─────────────────────────────────────────────────────────────────

async function checkboxSelect(detected, method) {
  // Build list: detected agents that have an adapter in this method come first,
  // then show unavailable ones as disabled so user knows what exists
  const available = detected.filter(a => method.adapters[a.key] || method.adapters['generic'])
  const unavailable = detected.filter(a => !method.adapters[a.key] && !method.adapters['generic'])

  if (available.length === 0) {
    console.log(chalk.yellow('  ⚠ No adapters available for your detected agents.'))
    console.log(chalk.dim(`  Available adapters in this method: ${Object.keys(method.adapters).join(', ')}\n`))
    process.exit(1)
  }

  // Initial state: all available agents pre-checked
  const items = available.map(a => ({
    agent: a,
    checked: true,
    usesGeneric: !method.adapters[a.key]
  }))

  console.log(chalk.white('  Agents detected on your system:\n'))

  return new Promise((resolve) => {
    let cursor = 0

    const render = () => {
      // Move cursor up to redraw (after first render)
      const lines = items.length + 6
      if (render.drawn) process.stdout.write(`\x1B[${lines}A`)
      render.drawn = true

      items.forEach((item, i) => {
        const isCursor = i === cursor
        const box = item.checked ? chalk.green('[✓]') : chalk.dim('[ ]')
        const arrow = isCursor ? chalk.cyan(' ❯ ') : '   '
        const name = isCursor ? chalk.white(item.agent.name) : chalk.dim(item.agent.name)
        const tag = item.usesGeneric ? chalk.dim(' (generic adapter)') : ''
        process.stdout.write(`${arrow}${box} ${name}${tag}\n`)
      })

      if (unavailable.length > 0) {
        process.stdout.write(chalk.dim(`\n  Not available for: ${unavailable.map(a => a.name).join(', ')}\n`))
      } else {
        process.stdout.write('\n')
      }

      process.stdout.write(chalk.dim('  ↑↓ navigate · Space toggle · A select all · Enter confirm\n\n'))
    }

    render()

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    if (process.stdin.isTTY) process.stdin.setRawMode(true)
    process.stdin.resume()

    process.stdin.on('data', (key) => {
      const k = key.toString()

      if (k === '\u001b[A') {                      // arrow up
        cursor = (cursor - 1 + items.length) % items.length
        render()
      } else if (k === '\u001b[B') {               // arrow down
        cursor = (cursor + 1) % items.length
        render()
      } else if (k === ' ') {                      // space: toggle current
        items[cursor].checked = !items[cursor].checked
        render()
      } else if (k === 'a' || k === 'A') {         // A: toggle all
        const allChecked = items.every(i => i.checked)
        items.forEach(i => { i.checked = !allChecked })
        render()
      } else if (k === '\r' || k === '\n') {       // Enter: confirm
        if (process.stdin.isTTY) process.stdin.setRawMode(false)
        process.stdin.pause()
        rl.close()
        const selected = items.filter(i => i.checked).map(i => i.agent)
        console.log(chalk.dim(`\n  Installing for: ${selected.map(a => a.name).join(', ')}\n`))
        resolve(selected)
      } else if (k === '\u0003') {                 // Ctrl+C
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
// ─────────────────────────────────────────────────────────────────

async function installForAgent(method, agent, options, skipExtras = false) {
  const isGlobal = options.global || false

  // Use the agent-specific adapter if available, fall back to generic
  const adapterKey = method.adapters[agent.key] ? agent.key : 'generic'
  const adapterPath = method.adapters[adapterKey]

  if (!adapterPath) {
    console.log(chalk.yellow(`  ⚠ ${agent.name} — no adapter found, skipping`))
    return
  }

  if (isGlobal && !agent.globalInstallDir) {
    console.log(chalk.yellow(`  ⚠ ${agent.name} — global install not supported, skipping`))
    return
  }

  const spinner = ora(`Installing for ${agent.name}${isGlobal ? ' (global)' : ''}...`).start()

  try {
    const content = await fetchFromGitHub(method.repo, adapterPath)
    const installPath = getInstallPath(agent, method.id, { global: isGlobal })

    await fs.ensureDir(path.dirname(installPath))

    // Windsurf: append to .windsurfrules instead of overwriting
    if (agent.key === 'windsurf' && await fs.pathExists(installPath)) {
      const existing = await fs.readFile(installPath, 'utf8')
      if (existing.includes(method.name)) {
        spinner.warn(chalk.yellow(`${agent.name} — already installed`))
        return
      }
      await fs.appendFile(installPath, `\n\n---\n\n${content}`)
    } else {
      await fs.writeFile(installPath, content)
    }

    spinner.succeed(chalk.green(`${agent.name}`))
    console.log(chalk.dim(`  → ${installPath}`))
    console.log(chalk.dim(`  ${agent.configNote}\n`))

  } catch (err) {
    spinner.fail(chalk.red(`${agent.name} — ${err.message}`))
    return
  }

  // Download extras (schema, etc.) — only once across all agents
  if (!skipExtras && method.extras) {
    for (const [key, filePath] of Object.entries(method.extras)) {
      const extraSpinner = ora(`Fetching ${key}...`).start()
      try {
        const extraContent = await fetchFromGitHub(method.repo, filePath)
        const extraOut = path.join(process.cwd(), path.basename(filePath))
        await fs.writeFile(extraOut, extraContent)
        extraSpinner.succeed(chalk.dim(`${key} → ${path.basename(filePath)}`))
      } catch {
        extraSpinner.warn(chalk.dim(`${key} not available (non-critical)`))
      }
    }
    console.log()
  }
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
    console.log(chalk.dim(`  ${chalk.white('enet new module <name>')}   scaffold your first module`))
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
