import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import { getAllMethods, getMethod, fetchFromGitHub } from '../utils/registry.js'
import { detectAgent, getInstallPath } from '../utils/agent-detector.js'

export async function updateCommand(methodId, options) {
  const spinner = ora('Fetching registry...').start()
  const [allMethods, agent] = await Promise.all([getAllMethods(), detectAgent()])
  spinner.stop()

  const targets = methodId
    ? [(await getMethod(methodId))].filter(Boolean)
    : allMethods

  if (methodId && targets.length === 0) {
    console.log(chalk.red(`  ✗ Unknown method: "${methodId}"\n`))
    process.exit(1)
  }

  console.log(chalk.white(`\n  Updating methods...\n`))

  let updated = 0, skipped = 0

  for (const method of targets) {
    const installPath = getInstallPath(agent, method.id)
    if (!await fs.pathExists(installPath)) { skipped++; continue }

    const s = ora(`Updating ${method.name}...`).start()
    try {
      const adapterPath = method.adapters[agent.key] ?? method.adapters.generic
      const content = await fetchFromGitHub(method.repo, adapterPath)
      await fs.writeFile(installPath, content)
      s.succeed(chalk.green(`${method.name} updated`))
      updated++
    } catch (err) {
      s.fail(chalk.yellow(`${method.name} — ${err.message}`))
    }
  }

  console.log()
  if (updated === 0 && skipped > 0) {
    console.log(chalk.dim(`  No methods installed to update.\n`))
  } else {
    console.log(chalk.dim(`  ${updated} updated, ${skipped} not installed\n`))
  }
}
