import chalk from 'chalk'
import fs from 'fs-extra'
import path from 'path'
import pkg from 'enquirer'
const { prompt } = pkg

export async function initCommand(options) {
  console.log(chalk.white('  Creating manifest.json\n'))
  console.log(chalk.dim('  The manifest is the module. Complete it before writing any code.\n'))

  try {
    const basic = await prompt([
      { type: 'input',  name: 'name',    message: 'Module name:', validate: v => v.length > 1 || 'Required' },
      { type: 'input',  name: 'id',      message: 'Module ID (kebab-case):', validate: v => /^[a-z][a-z0-9-]*$/.test(v) || 'kebab-case only' },
      { type: 'select', name: 'type',    message: 'Type:', choices: ['functional', 'integration', 'ui', 'core'] },
      { type: 'input',  name: 'section', message: 'Admin section (e.g. monitoring):', validate: v => /^[a-z][a-z0-9-]*$/.test(v) || 'kebab-case only' }
    ])

    // Settings
    const settings = {}
    const { addSettings } = await prompt({ type: 'confirm', name: 'addSettings', message: 'Add configurable settings?', initial: true })

    if (addSettings) {
      let more = true
      while (more) {
        const { key } = await prompt({ type: 'input', name: 'key', message: '  Setting key (empty to finish):' })
        if (!key) break

        const details = await prompt([
          { type: 'input',  name: 'label',   message: '  Label:' },
          { type: 'select', name: 'type',    message: '  Type:', choices: ['integer', 'string', 'boolean', 'select'] },
          { type: 'select', name: 'ui',      message: '  Widget:', choices: ['text', 'number', 'slider', 'toggle', 'select', 'textarea'] },
          { type: 'input',  name: 'default', message: '  Default:' }
        ])

        settings[key] = {
          type: details.type,
          label: details.label,
          default: parseDefault(details.default, details.type),
          ui: details.ui
        }

        const { cont } = await prompt({ type: 'confirm', name: 'cont', message: '  Add another?', initial: false })
        more = cont
      }
    }

    // Capabilities
    const capabilities = []
    const { addCaps } = await prompt({ type: 'confirm', name: 'addCaps', message: 'Add capabilities?', initial: true })

    if (addCaps) {
      let more = true
      while (more) {
        const cap = await prompt([
          { type: 'select', name: 'type',    message: '  Type:', choices: ['view', 'action', 'metric', 'widget', 'page'] },
          { type: 'input',  name: 'label',   message: '  Label:', validate: v => v.length > 0 || 'Required' },
          { type: 'input',  name: 'handler', message: '  Handler (ClassName.method):', validate: v => /^[A-Z][a-zA-Z0-9]*\.[a-z][a-zA-Z0-9]*$/.test(v) || 'Format: ClassName.method' }
        ])

        const capability = { type: cap.type, label: cap.label }
        if (cap.type === 'action') {
          capability.handler = cap.handler
          const { dangerous } = await prompt({ type: 'confirm', name: 'dangerous', message: '  Mark as dangerous?', initial: false })
          if (dangerous) capability.dangerous = true
        } else {
          capability.data = cap.handler
        }
        capabilities.push(capability)

        const { cont } = await prompt({ type: 'confirm', name: 'cont', message: '  Add another?', initial: false })
        more = cont
      }
    }

    const manifest = {
      id: basic.id,
      name: basic.name,
      version: '1.0.0',
      type: basic.type,
      section: basic.section,
      dependencies: [],
      hooks: {},
      ...(Object.keys(settings).length > 0 && { settings }),
      ...(capabilities.length > 0 && { capabilities })
    }

    const json = JSON.stringify(manifest, null, 2)

    if (options.json) { console.log('\n' + json + '\n'); return }

    const { confirm } = await prompt({ type: 'confirm', name: 'confirm', message: 'Write manifest.json here?', initial: true })
    if (!confirm) { console.log('\n' + json + '\n'); return }

    const outPath = path.join(process.cwd(), 'manifest.json')
    if (await fs.pathExists(outPath)) {
      const { overwrite } = await prompt({ type: 'confirm', name: 'overwrite', message: chalk.yellow('manifest.json exists. Overwrite?'), initial: false })
      if (!overwrite) { console.log(chalk.dim('\n  Cancelled.\n')); return }
    }

    await fs.writeJson(outPath, manifest, { spaces: 2 })
    console.log(chalk.green('\n  ✓ manifest.json created\n'))
    console.log(chalk.dim(`  Implement the handlers, then run ${chalk.white('enet validate')}.\n`))

  } catch (err) {
    if (err === '') { console.log(chalk.dim('\n  Cancelled.\n')); return }
    console.log(chalk.red(`\n  Error: ${err.message}\n`))
    process.exit(1)
  }
}

function parseDefault(value, type) {
  if (type === 'integer') return parseInt(value) || 0
  if (type === 'boolean') return value === 'true'
  return value
}
