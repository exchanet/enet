import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import ora from 'ora'
import { detectAgent, getInstallPath } from '../utils/agent_detector.js'
import { getAllMethods } from '../utils/registry.js'

export async function doctorCommand() {
  const cwd = process.cwd()

  const spinner = ora('Running diagnostics...').start()
  const [methods, agent] = await Promise.all([getAllMethods(), detectAgent()])
  spinner.stop()

  console.log(chalk.white('  ◆ enet doctor\n'))

  const checks = []

  // Agent detected
  checks.push({
    label: `AI agent detected (${agent.name})`,
    pass: agent.key !== 'generic',
    hint: 'Create .cursor/, .windsurfrules, or .github/ to auto-detect your agent.'
  })

  // At least one method installed
  let installedCount = 0
  for (const method of methods) {
    if (await fs.pathExists(getInstallPath(agent, method.id))) installedCount++
  }
  checks.push({
    label: `Methods installed (${installedCount}/${methods.length})`,
    pass: installedCount > 0,
    hint: `Run: enet install reflex`
  })

  // manifest.schema.json
  const hasSchema = await fs.pathExists(path.join(cwd, 'manifest.schema.json'))
  checks.push({
    label: 'manifest.schema.json present',
    pass: hasSchema,
    hint: 'Run: enet install reflex (downloads schema automatically)'
  })

  // Modules directory
  const modulesDir = await findModulesDir(cwd)
  checks.push({
    label: modulesDir
      ? `Modules directory (${path.relative(cwd, modulesDir)})`
      : 'Modules directory',
    pass: !!modulesDir,
    hint: 'Create a modules/ directory for your first module.'
  })

  // Manifests valid
  if (hasSchema && modulesDir) {
    const manifests = await findManifests(modulesDir)
    if (manifests.length > 0) {
      const { valid, invalid } = await quickValidate(path.join(cwd, 'manifest.schema.json'), manifests)
      checks.push({
        label: `Manifests valid (${valid}/${manifests.length})`,
        pass: invalid === 0,
        hint: 'Run: enet validate --all'
      })
    }
  }

  // Node version
  const nodeVersion = parseInt(process.version.replace('v', '').split('.')[0])
  checks.push({
    label: `Node.js ${process.version}`,
    pass: nodeVersion >= 18,
    hint: 'Upgrade to Node.js 18 or higher.'
  })

  // Print
  let allPass = true
  for (const check of checks) {
    const icon = check.pass ? chalk.green('✓') : chalk.red('✗')
    console.log(`  ${icon} ${check.pass ? chalk.white(check.label) : chalk.dim(check.label)}`)
    if (!check.pass && check.hint) {
      console.log(chalk.dim(`    → ${check.hint}`))
    }
    if (!check.pass) allPass = false
  }

  console.log()
  if (allPass) {
    console.log(chalk.green('  ✓ Everything looks good!\n'))
  } else {
    console.log(chalk.yellow('  ⚠ Some issues found. Follow the hints above.\n'))
  }
}

async function findModulesDir(cwd) {
  for (const dir of ['modules', 'packs', 'src/modules']) {
    const full = path.join(cwd, dir)
    if (await fs.pathExists(full)) return full
  }
  return null
}

async function findManifests(dir) {
  const results = []
  const entries = await fs.readdir(dir)
  for (const entry of entries) {
    const p = path.join(dir, entry, 'manifest.json')
    if (await fs.pathExists(p)) results.push(p)
  }
  return results
}

async function quickValidate(schemaPath, manifests) {
  const { default: Ajv } = await import('ajv')
  const { default: addFormats } = await import('ajv-formats')
  const schema = await fs.readJson(schemaPath)
  const ajv = new Ajv({ allErrors: false })
  addFormats(ajv)
  const validate = ajv.compile(schema)
  let valid = 0, invalid = 0
  for (const p of manifests) {
    try {
      validate(await fs.readJson(p)) ? valid++ : invalid++
    } catch { invalid++ }
  }
  return { valid, invalid }
}
