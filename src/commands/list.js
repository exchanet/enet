import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import { getAllMethods } from '../utils/registry.js'
import { detectAgent, getInstallPath } from '../utils/agent_detector.js'

export async function listCommand(options) {
  const spinner = ora('Fetching registry...').start()

  let methods
  try {
    methods = await getAllMethods()
    spinner.stop()
  } catch (err) {
    spinner.fail(chalk.red(`Could not load registry: ${err.message}`))
    process.exit(1)
  }

  const agent = await detectAgent()

  console.log(chalk.dim(`  Agent: ${chalk.white(agent.name)}\n`))

  if (options.installed) {
    console.log(chalk.white('  Installed methods:\n'))
  } else {
    console.log(chalk.white(`  Available methods (${methods.length}):\n`))
  }

  let shown = 0

  for (const method of methods) {
    const installPath = getInstallPath(agent, method.id)
    const isInstalled = await fs.pathExists(installPath)

    if (options.installed && !isInstalled) continue

    const status = isInstalled ? chalk.green('✓ installed') : chalk.dim('○ available')
    const tags = method.tags.map(t => chalk.dim(`#${t}`)).join(' ')

    console.log(`  ${chalk.white(method.id.padEnd(24))} ${status}`)
    console.log(`  ${chalk.dim(method.description)}`)
    console.log(`  ${tags}\n`)
    shown++
  }

  if (shown === 0 && options.installed) {
    console.log(chalk.dim('  No methods installed yet.\n'))
    console.log(chalk.dim(`  Run ${chalk.white('enet install reflex')} to get started.\n`))
    return
  }

  if (!options.installed) {
    console.log(chalk.dim(`  Install: ${chalk.white('enet install <method>')}`))
    console.log(chalk.dim(`  Example: ${chalk.white('enet install reflex')}\n`))
  }
}
