import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import { detectSystemAgents, getInstallPath, AGENTS } from '../utils/agent-detector.js'
import { getMethod, fetchFromGitHub } from '../utils/registry.js'

export async function installCommand(methodId, options) {
  // Load method from registry
  const spinner = ora('Fetching registry...').start()
  const method = await getMethod(methodId).catch(() => null)
  spinner.stop()

  if (!method) {
    console.log(chalk.red(`  ✗ Unknown method: "${methodId}"`))
    console.log(chalk.dim(`  Run ${chalk.white('enet list')} to see available methods.\n`))
    process.exit(1)
  }

  // Determine target agents
  let targetAgents = []

  if (options.agent) {
    // --agent flag: install for a specific agent only
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
      console.log(chalk.dim(`  Valid: cursor, windsurf, antigravity, claudecode, copilot, generic\n`))
      process.exit(1)
    }

    if (detected.length === 1 || options.global) {
      // Only one detected, or --global flag: install for all without asking
      targetAgents = detected
    } else {
      // Multiple agents detected: ask the user
      console.log(chalk.white(`\n  Detected ${detected.length} agents on this system:\n`))
      detected.forEach((a, i) => console.log(chalk.dim(`  [${i + 1}] ${a.name}`)))
      console.log(chalk.dim(`  [${detected.length + 1}] All of the above\n`))

      const { createInterface } = await import('readline')
      const rl = createInterface({ input: process.stdin, output: process.stdout })
      const answer = await new Promise(resolve => {
        rl.question(chalk.white('  Install for which agent(s)? '), resolve)
      })
      rl.close()

      const choice = parseInt(answer.trim())
      if (choice === detected.length + 1) {
        targetAgents = detected
      } else if (choice >= 1 && choice <= detected.length) {
        targetAgents = [detected[choice - 1]]
      } else {
        console.log(chalk.red('\n  Invalid choice. Cancelled.\n'))
        process.exit(1)
      }
    }
  }

  console.log()

  // Install for each target agent
  let schemaInstalled = false
  for (const agent of targetAgents) {
    await installForAgent(method, agent, options, schemaInstalled)
    schemaInstalled = true // only install schema once
  }

  printHints(methodId)
}

async function installForAgent(method, agent, options, skipExtras = false) {
  const isGlobal = options.global || false
  const adapterKey = method.adapters[agent.key] ? agent.key : 'generic'
  const adapterPath = method.adapters[adapterKey]

  if (isGlobal && !agent.globalInstallDir) {
    console.log(chalk.yellow(`  ⚠ ${agent.name} does not support global install — skipping`))
    return
  }

  const spinner = ora(`Installing for ${agent.name}${isGlobal ? ' (global)' : ''}...`).start()

  try {
    const content = await fetchFromGitHub(method.repo, adapterPath)
    const installPath = getInstallPath(agent, method.id, { global: isGlobal })

    await fs.ensureDir(path.dirname(installPath))

    // Windsurf global appends to global_rules.md
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

    spinner.succeed(chalk.green(`${agent.name} — installed`))
    console.log(chalk.dim(`  → ${installPath}`))
    console.log(chalk.dim(`  ${agent.configNote}\n`))

  } catch (err) {
    spinner.fail(chalk.red(`${agent.name} — ${err.message}`))
    return
  }

  // Download extras (schema, etc.) once
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

function printHints(methodId) {
  if (methodId === 'modular-design') {
    console.log(chalk.dim('  Next:'))
    console.log(chalk.dim(`  1. Give your agent a spectech (stack + modules needed)`))
    console.log(chalk.dim(`  2. Agent declares architecture — confirm it`))
    console.log(chalk.dim(`  3. Agent builds Core → modules → Admin Panel`))
    console.log()
    console.log(chalk.dim(`  ${chalk.white('enet new module <name>')}   scaffold your first module`))
    console.log(chalk.dim(`  ${chalk.white('enet validate')}             check manifests at any time\n`))
  }
  if (methodId === 'pdca-t') {
    console.log(chalk.dim(`  PDCA-T adds quality validation to your workflow.`))
    console.log(chalk.dim(`  Works best alongside ${chalk.white('enet install modular-design')}.\n`))
  }
}
