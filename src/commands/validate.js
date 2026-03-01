import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'

export async function validateCommand(targetPath, options) {
  const cwd = process.cwd()
  const schemaPath = path.join(cwd, 'manifest.schema.json')

  if (!await fs.pathExists(schemaPath)) {
    console.log(chalk.red('\n  ✗ manifest.schema.json not found'))
    console.log(chalk.dim(`  Run ${chalk.white('enet install reflex')} to install it.\n`))
    process.exit(1)
  }

  const schema = await fs.readJson(schemaPath)
  const ajv = new Ajv({ allErrors: true })
  addFormats(ajv)
  const validate = ajv.compile(schema)

  let manifests = []

  if (targetPath) {
    const p = path.resolve(cwd, targetPath, 'manifest.json')
    if (await fs.pathExists(p)) manifests = [p]
    else { console.log(chalk.red(`\n  ✗ No manifest.json at ${targetPath}\n`)); process.exit(1) }
  } else {
    manifests = await findAllManifests(cwd)
    if (manifests.length === 0) {
      const local = path.join(cwd, 'manifest.json')
      if (await fs.pathExists(local)) manifests = [local]
    }
  }

  if (manifests.length === 0) {
    console.log(chalk.dim('\n  No manifest.json files found.'))
    console.log(chalk.dim(`  Run ${chalk.white('enet init')} to create one.\n`))
    return
  }

  console.log(chalk.white(`\n  Validating ${manifests.length} manifest${manifests.length > 1 ? 's' : ''}...\n`))

  let passed = 0, failed = 0

  for (const manifestPath of manifests) {
    const rel = path.relative(cwd, manifestPath)
    let data
    try {
      data = await fs.readJson(manifestPath)
    } catch (e) {
      console.log(`  ${chalk.red('✗')} ${chalk.white(rel)}`)
      console.log(chalk.red(`    Invalid JSON: ${e.message}\n`))
      failed++; continue
    }

    const valid = validate(data)
    const warnings = semanticChecks(data)

    if (valid) {
      console.log(`  ${chalk.green('✓')} ${chalk.white(rel)} ${chalk.dim(`— ${data.name} v${data.version}`)}`)
      warnings.forEach(w => console.log(chalk.dim(`    ⚠ ${w}`)))
      if (options.strict && warnings.length > 0) failed++
      else passed++
    } else {
      console.log(`  ${chalk.red('✗')} ${chalk.white(rel)} ${chalk.dim(`— ${data.name || 'unknown'}`)}`)
      validate.errors.forEach(err => {
        console.log(chalk.red(`    ✗ ${err.instancePath || err.schemaPath}: ${err.message}`))
      })
      failed++
    }
    console.log()
  }

  console.log(chalk.dim('  ' + '─'.repeat(40)))
  if (failed === 0) {
    console.log(chalk.green(`  ✓ All ${passed} manifest${passed > 1 ? 's' : ''} valid\n`))
  } else {
    console.log(chalk.red(`  ✗ ${failed} failed`) + chalk.dim(`, ${passed} passed\n`))
    process.exit(1)
  }
}

function semanticChecks(m) {
  const w = []
  if (!m.capabilities?.length) w.push('No capabilities — module invisible in Admin Panel')
  if (m.settings && Object.keys(m.settings).length === 0) w.push('Empty settings object')
  const unprotected = (m.capabilities || []).filter(c => c.type === 'action' && !c.permissions?.length)
  if (unprotected.length) w.push(`${unprotected.length} action(s) without permissions`)
  return w
}

async function findAllManifests(cwd) {
  const results = []
  for (const dir of ['modules', 'packs', 'src/modules']) {
    const full = path.join(cwd, dir)
    if (!await fs.pathExists(full)) continue
    const entries = await fs.readdir(full)
    for (const entry of entries) {
      const p = path.join(full, entry, 'manifest.json')
      if (await fs.pathExists(p)) results.push(p)
    }
  }
  return results
}
