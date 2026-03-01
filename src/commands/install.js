import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import { detectAgent, getInstallPath, AGENTS } from '../utils/agent-detector.js'
import { getMethod } from '../utils/registry.js'
import { fetchFromGitHub } from '../utils/registry.js'

export async function installCommand(methodId, options) {
  const spinner = ora('Fetching registry...').start()
  const method = await getMethod(methodId).catch(() => null)
  spinner.stop()

  if (!method) {
    console.log(chalk.red(`  ✗ Unknown method: "${methodId}"`))
    console.log(chalk.dim(`  Run ${chalk.white('enet list')} to see available methods.\n`))
    process.exit(1)
  }

  // Detect or force agent
  let agent
  if (options.agent) {
    if (!AGENTS[options.agent]) {
      console.log(chalk.red(`  ✗ Unknown agent: "${options.agent}"`))
      console.log(chalk.dim(`  Valid: cursor, windsurf, copilot, generic\n`))
      process.exit(1)
    }
    agent = { key: options.agent, ...AGENTS[options.agent] }
  } else {
    agent = await detectAgent()
  }

  console.log(chalk.dim(`  Method : ${chalk.white(method.name)}`))
  console.log(chalk.dim(`  Agent  : ${chalk.white(agent.name)}${options.agent ? '' : chalk.dim(' (auto-detected)')}`))
  console.log(chalk.dim(`  Source : ${chalk.white(`github.com/${method.repo}`)}\n`))

  const fetchSpinner = ora(`Fetching adapter...`).start()

  try {
    const adapterPath = method.adapters[agent.key] ?? method.adapters.generic
    const content = await fetchFromGitHub(method.repo, adapterPath)

    const installPath = options.global
      ? path.join(process.env.HOME || process.env.USERPROFILE, '.enet', `${methodId}.md`)
      : getInstallPath(agent, methodId)

    await fs.ensureDir(path.dirname(installPath))

    // Windsurf appends, others overwrite
    if (agent.key === 'windsurf' && await fs.pathExists(installPath)) {
      const existing = await fs.readFile(installPath, 'utf8')
      if (existing.includes(method.name)) {
        fetchSpinner.warn(chalk.yellow(`${method.name} already installed`))
        return
      }
      await fs.appendFile(installPath, `\n\n---\n\n${content}`)
    } else {
      await fs.writeFile(installPath, content)
    }

    fetchSpinner.succeed(chalk.green(`${method.name} installed`))
    console.log(chalk.dim(`  → ${path.relative(process.cwd(), installPath)}`))
    console.log(chalk.dim(`  ${agent.configNote}\n`))

    // Download extras (e.g. manifest.schema.json for reflex)
    if (method.extras) {
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

    printHints(methodId)

  } catch (err) {
    fetchSpinner.fail(chalk.red(`Failed: ${err.message}`))
    console.log(chalk.dim('  Check your internet connection and try again.\n'))
    process.exit(1)
  }
}

function printHints(methodId) {
  if (methodId === 'reflex') {
    console.log(chalk.dim('  Next:'))
    console.log(chalk.dim(`  1. Give your agent a spectech (stack + modules needed)`))
    console.log(chalk.dim(`  2. Agent declares architecture — confirm it`))
    console.log(chalk.dim(`  3. Agent builds Core → modules → Admin Panel`))
    console.log()
    console.log(chalk.dim(`  ${chalk.white('enet new module <name>')}   scaffold your first module`))
    console.log(chalk.dim(`  ${chalk.white('enet validate')}            check manifests at any time\n`))
  }
  if (methodId === 'pdca-t') {
    console.log(chalk.dim(`  PDCA-T adds quality validation to your workflow.`))
    console.log(chalk.dim(`  Works best alongside ${chalk.white('enet install reflex')}.\n`))
  }
}
