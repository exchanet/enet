#!/usr/bin/env node

import { program } from 'commander'
import chalk from 'chalk'
import { createRequire } from 'module'
import { installCommand } from './commands/install.js'
import { listCommand } from './commands/list.js'
import { initCommand } from './commands/init.js'
import { validateCommand } from './commands/validate.js'
import { newCommand } from './commands/new.js'
import { updateCommand } from './commands/update.js'
import { statusCommand } from './commands/status.js'
import { doctorCommand } from './commands/doctor.js'

// Read version from package.json — single source of truth
const require = createRequire(import.meta.url)
const pkg = require('../package.json')
const VERSION = pkg.version

function isNewerVersion (latest, current) {
  const parts = (v) => String(v).replace(/^v/, '').split('.').map(Number)
  const a = parts(latest)
  const b = parts(current)
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0
    const y = b[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

// ── Version check (every command) ─────────────────────────────────────────────
// Shows warning if a newer enet is on npm; never blocks, never crashes if offline

async function checkForUpdate () {
  try {
    const res = await fetch('https://registry.npmjs.org/@exchanet/enet/latest', { signal: AbortSignal.timeout(3000) })
    if (!res.ok) return
    const data = await res.json()
    const latest = data?.version
    if (latest && isNewerVersion(latest, VERSION)) {
      console.log(
        chalk.yellow('  ⚠ Warning: a newer version of enet is available.\n') +
        chalk.dim(`  Current: v${VERSION}  →  Latest: v${latest}\n`) +
        chalk.dim('  Update: ') +
        chalk.white('npm install -g @exchanet/enet\n')
      )
    }
  } catch {
    // Offline or timeout — skip silently
  }
}

await checkForUpdate()

// ── Header ────────────────────────────────────────────────────────────────────

console.log(chalk.cyan(`\n◆ enet v${VERSION} — exchanet methods manager\n`))

// ── Commands ──────────────────────────────────────────────────────────────────

program
  .name('enet')
  .description('Install, scaffold and manage exchanet AI coding methods')
  .version(VERSION)

program
  .command('install <method>')
  .description('Install a method (default: global; use -p for this project only)')
  .option('-a, --agent <agent>', 'Force agent: cursor | windsurf | antigravity | claudecode | copilot | generic')
  .option('-g, --global', 'Install globally (default) — available for all agents/projects')
  .option('-p, --project', 'Install only in current project')
  .option('--all', 'Install for all detected agents without prompting')
  .action(installCommand)

program
  .command('list')
  .alias('ls')
  .description('List all available methods')
  .option('--installed', 'Show only installed methods')
  .action(listCommand)

program
  .command('init')
  .description('Interactively create a manifest.json for a new module')
  .option('-n, --name <n>', 'Module name')
  .option('-s, --section <section>', 'Admin Panel section')
  .option('--json', 'Print manifest as JSON without writing to disk')
  .action(initCommand)

program
  .command('validate [path]')
  .description('Validate manifest.json files against the schema')
  .option('-a, --all', 'Validate all modules recursively')
  .option('--strict', 'Treat warnings as errors')
  .action(validateCommand)

program
  .command('new <type> <n>')
  .description('Scaffold a new module, ui-pack or integration')
  .option('-s, --section <section>', 'Admin Panel section')
  .option('--dry-run', 'Preview files without writing')
  .action(newCommand)

program
  .command('update [method]')
  .description('Update installed methods and add adapters for new agents')
  .option('--all', 'Add all new agents without prompting')
  .option('--add-only', 'Only add new agents, skip re-downloading existing')
  .option('--update-only', 'Only re-download existing, skip new agent prompt')
  .option('-g, --global', 'Update global install')
  .action(updateCommand)

program
  .command('status')
  .description('Show installed methods and detected agent')
  .action(statusCommand)

program
  .command('doctor')
  .description('Diagnose project setup — manifests, methods, agent config')
  .action(doctorCommand)

program.parse()
