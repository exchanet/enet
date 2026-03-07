import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import ora from 'ora'
import { getAllMethods } from '../utils/registry.js'
import { detectAgent, getInstallPath } from '../utils/agent_detector.js'

export async function statusCommand() {
  const cwd = process.cwd()

  const spinner = ora('Loading...').start()
  const [methods, agent] = await Promise.all([getAllMethods(), detectAgent()])
  spinner.stop()

  console.log(chalk.white('  Project Status\n'))
  console.log(chalk.dim(`  Directory : ${cwd}`))
  console.log(chalk.dim(`  Agent     : ${chalk.white(agent.name)}\n`))

  console.log(chalk.dim('  Installed methods:\n'))

  let any = false
  for (const method of methods) {
    const installPath = getInstallPath(agent, method.id)
    if (await fs.pathExists(installPath)) {
      console.log(`  ${chalk.green('✓')} ${chalk.white(method.name)}`)
      console.log(chalk.dim(`    ${path.relative(cwd, installPath)}\n`))
      any = true
    }
  }

  if (!any) {
    console.log(chalk.dim(`  None. Run ${chalk.white('enet install reflex')} to get started.\n`))
    return
  }

  const hasSchema = await fs.pathExists(path.join(cwd, 'manifest.schema.json'))
  console.log(`  ${hasSchema ? chalk.green('✓') : chalk.dim('○')} manifest.schema.json`)

  const moduleCount = await countModules(cwd)
  if (moduleCount > 0) {
    console.log(`  ${chalk.green('✓')} ${moduleCount} module${moduleCount > 1 ? 's' : ''} found`)
  }

  console.log()
  console.log(chalk.dim(`  ${chalk.white('enet validate')}   check all manifests`))
  console.log(chalk.dim(`  ${chalk.white('enet doctor')}     full health check\n`))
}

async function countModules(cwd) {
  let count = 0
  for (const dir of ['modules', 'packs', 'src/modules']) {
    const full = path.join(cwd, dir)
    if (!await fs.pathExists(full)) continue
    const entries = await fs.readdir(full)
    for (const e of entries) {
      if (await fs.pathExists(path.join(full, e, 'manifest.json'))) count++
    }
  }
  return count
}
