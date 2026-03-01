import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'

export async function newCommand(type, name, options) {
  const VALID = ['module', 'ui-pack', 'integration']
  if (!VALID.includes(type)) {
    console.log(chalk.red(`  ✗ Unknown type: "${type}". Valid: ${VALID.join(', ')}\n`))
    process.exit(1)
  }

  const id = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const section = options.section || (type === 'ui-pack' ? 'appearance' : 'modules')
  const cwd = process.cwd()
  const modulesDir = await findModulesDir(cwd)
  const targetDir = path.join(modulesDir, id)

  if (await fs.pathExists(targetDir)) {
    console.log(chalk.red(`  ✗ Already exists: ${path.relative(cwd, targetDir)}\n`))
    process.exit(1)
  }

  const files = buildScaffold(type, id, name, section)

  if (options.dryRun) {
    console.log(chalk.dim('\n  Files that would be created:\n'))
    Object.keys(files).forEach(f => console.log(chalk.dim(`  ${path.relative(cwd, path.join(targetDir, f))}`)))
    console.log()
    return
  }

  for (const [filePath, content] of Object.entries(files)) {
    const full = path.join(targetDir, filePath)
    await fs.ensureDir(path.dirname(full))
    await fs.writeFile(full, content)
  }

  const rel = path.relative(cwd, targetDir)
  console.log(chalk.green(`\n  ✓ ${type} "${name}" scaffolded\n`))
  Object.keys(files).forEach(f => console.log(chalk.dim(`  ${rel}/${f}`)))
  console.log()
  console.log(chalk.dim('  Next:'))
  console.log(chalk.dim(`  1. Complete ${chalk.white(`${rel}/manifest.json`)}`))
  console.log(chalk.dim(`  2. Implement the handlers`))
  console.log(chalk.dim(`  3. Run ${chalk.white('enet validate')}\n`))
}

function buildScaffold(type, id, name, section) {
  const cls = toPascal(id)
  if (type === 'module') return {
    'manifest.json': JSON.stringify({
      id, name, version: '1.0.0', type: 'functional', section,
      dependencies: [], hooks: {},
      settings: {
        enabled: { type: 'boolean', label: 'Enable module', default: true, ui: 'toggle' }
      },
      capabilities: [
        { type: 'view',   label: `${name} List`, data: `${cls}.getAll` },
        { type: 'metric', label: `Total ${name}`, data: `${cls}.count` }
      ]
    }, null, 2),
    [`handlers/${id}.js`]: `export class ${cls} {
  constructor(context) { this.ctx = context; this.db = context.db }

  async getAll(ctx, { page = 1, limit = 20 } = {}) {
    // TODO: implement
    return []
  }

  async count(ctx) {
    // TODO: implement
    return 0
  }
}
`,
    'README.md': `# ${name}\n\nDescribe this module.\n`
  }

  if (type === 'ui-pack') return {
    'manifest.json': JSON.stringify({
      id, name, version: '1.0.0', type: 'ui', section: 'appearance',
      dependencies: [],
      capabilities: [{
        type: 'theme', label: `${name} Theme`,
        variables: { 'primary-color': '#6366f1', 'font-family': 'Inter, sans-serif', 'border-radius': '8px' }
      }]
    }, null, 2),
    'styles/theme.css': `:root {\n  --primary-color: #6366f1;\n  --font-family: Inter, sans-serif;\n  --border-radius: 8px;\n}\n`,
    'README.md': `# ${name} UI Pack\n\nActivate from Admin Panel → Appearance.\n`
  }

  if (type === 'integration') return {
    'manifest.json': JSON.stringify({
      id, name, version: '1.0.0', type: 'integration', section,
      dependencies: [], hooks: {},
      settings: {
        api_key: { type: 'string', label: 'API Key', default: '', ui: 'text' },
        enabled: { type: 'boolean', label: 'Enable', default: false, ui: 'toggle' }
      },
      capabilities: [
        { type: 'action', label: 'Test Connection', handler: `${cls}.testConnection` },
        { type: 'metric', label: 'Status', data: `${cls}.getStatus` }
      ]
    }, null, 2),
    [`handlers/${id}.js`]: `export class ${cls} {
  constructor(context) { this.ctx = context }

  get apiKey() { return this.ctx.settings.get('api_key') }

  async testConnection(ctx) {
    if (!this.apiKey) return { success: false, message: 'API key not configured' }
    // TODO: implement
    return { success: true, message: 'Connected' }
  }

  async getStatus(ctx) {
    return this.ctx.settings.get('enabled') ? 'active' : 'disabled'
  }
}
`,
    'README.md': `# ${name} Integration\n\nConfigure API Key in Admin Panel → ${section}.\n`
  }
}

function toPascal(str) {
  return str.split('-').map(s => s[0].toUpperCase() + s.slice(1)).join('')
}

async function findModulesDir(cwd) {
  for (const dir of ['modules', 'packs', 'src/modules']) {
    if (await fs.pathExists(path.join(cwd, dir))) return path.join(cwd, dir)
  }
  return path.join(cwd, 'modules')
}
