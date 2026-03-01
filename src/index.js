#!/usr/bin/env node

import { program } from 'commander'
import chalk from 'chalk'
import { installCommand } from './commands/install.js'
import { listCommand } from './commands/list.js'
import { initCommand } from './commands/init.js'
import { validateCommand } from './commands/validate.js'
import { newCommand } from './commands/new.js'
import { updateCommand } from './commands/update.js'
import { statusCommand } from './commands/status.js'
import { doctorCommand } from './commands/doctor.js'

const VERSION = '1.0.0'

console.log(chalk.cyan(`\n◆ enet v${VERSION} — exchanet methods manager\n`))

program
  .name('enet')
  .description('Install, scaffold and manage exchanet AI coding methods')
  .version(VERSION)

program
  .command('install <method>')
  .description('Install a method into the current project')
  .option('-a, --agent <agent>', 'Force agent: cursor | windsurf | copilot | generic')
  .option('-g, --global', 'Install globally to home directory')
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
  .option('-n, --name <name>', 'Module name')
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
  .command('new <type> <name>')
  .description('Scaffold a new module, ui-pack or integration')
  .option('-s, --section <section>', 'Admin Panel section')
  .option('--dry-run', 'Preview files without writing')
  .action(newCommand)

program
  .command('update [method]')
  .description('Update installed methods to latest version')
  .option('--all', 'Update all installed methods')
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
