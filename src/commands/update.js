import chalk from 'chalk'
import ora from 'ora'
import fs from 'fs-extra'
import path from 'path'
import enquirer from 'enquirer'
const { MultiSelect } = enquirer
import { getAllMethods, getMethod, fetchFromGitHub, readInstallRecord, writeInstallRecord } from '../utils/registry.js'
import { detectSystemAgents, detectAgent, getInstallPath, AGENTS } from '../utils/agent_detector.js'
import { installForAgent } from './install.js'

export async function updateCommand(methodId, options) {
  const spinner = ora('Fetching registry...').start()
  const [allMethods, detectedAgents] = await Promise.all([
    getAllMethods(),
    detectSystemAgents()
  ])
  spinner.stop()

  const targets = methodId
    ? [(await getMethod(methodId))].filter(Boolean)
    : allMethods

  if (methodId && targets.length === 0) {
    console.log(chalk.red(`  ✗ Unknown method: "${methodId}"\n`))
    process.exit(1)
  }

  console.log(chalk.bold('\n  ◆ enet update\n'))

  let totalUpdated = 0, totalAdded = 0, totalSkipped = 0
  const currentAgent = await detectAgent()

  for (const method of targets) {
    let record = await readInstallRecord(method.id)

    // If no record but adapter file exists (e.g. list shows "installed"), treat as installed for current agent
    if ((!record || record.agents.length === 0) && currentAgent) {
      const pathForCurrent = getInstallPath(currentAgent, method.id)
      if (await fs.pathExists(pathForCurrent)) {
        record = { agents: [currentAgent.key], version: record?.version, updatedAt: record?.updatedAt }
        await writeInstallRecord(method.id, { agents: record.agents, version: method.version })
      }
    }

    if (!record || record.agents.length === 0) {
      totalSkipped++
      console.log(chalk.dim(`  ${method.name} — not installed, skipping`))
      continue
    }

    console.log(chalk.white(`  ${method.name}`))
    console.log(chalk.dim(`  Installed for: ${record.agents.join(', ')}\n`))

    // Agents already installed for this method
    const installedAgents = record.agents
      .map(key => AGENTS[key] ? { key, ...AGENTS[key] } : null)
      .filter(Boolean)

    // Agents newly detected on system but NOT yet installed for this method
    const newAgents = detectedAgents.filter(a =>
      !record.agents.includes(a.key) &&
      (method.adapters[a.key] || method.adapters['generic'])
    )

    // ── 1. Update already-installed adapters ────────────────────
    if (!options.addOnly) {
      for (const agent of installedAgents) {
        const ok = await updateOneAdapter(method, agent, options)
        if (ok) totalUpdated++
      }
    }

    // ── 2. Offer to add newly detected agents ───────────────────
    if (newAgents.length > 0 && !options.updateOnly) {
      console.log(chalk.yellow(`\n  New agents detected since last install:\n`))

      let agentsToAdd = []
      if (options.all) {
        agentsToAdd = newAgents
        console.log(chalk.dim(`  Adding all: ${newAgents.map(a => a.name).join(', ')}\n`))
      } else {
        agentsToAdd = await checkboxSelectNew(newAgents, method)
      }

      for (const agent of agentsToAdd) {
        const ok = await installForAgent(method, agent, options, true)
        if (ok) {
          totalAdded++
          record.agents.push(agent.key)
        }
      }

      // Save updated record with newly added agents
      await writeInstallRecord(method.id, { agents: record.agents, version: method.version })

    } else if (newAgents.length === 0 && !options.addOnly) {
      console.log(chalk.dim(`  No new agents detected.\n`))
    }
  }

  // ── Summary ──────────────────────────────────────────────────
  console.log(chalk.dim('  ─────────────────────────────'))
  if (totalUpdated > 0) console.log(chalk.green(`  ✓ ${totalUpdated} adapter${totalUpdated !== 1 ? 's' : ''} updated`))
  if (totalAdded > 0)   console.log(chalk.green(`  ✓ ${totalAdded} new adapter${totalAdded !== 1 ? 's' : ''} installed`))
  if (totalSkipped > 0) console.log(chalk.dim(`    ${totalSkipped} method${totalSkipped !== 1 ? 's' : ''} not installed, skipped`))
  if (totalUpdated === 0 && totalAdded === 0 && totalSkipped === 0) {
    console.log(chalk.dim('  Everything is up to date.'))
  }
  console.log()
}

// ─────────────────────────────────────────────────────────────────
// Update a single already-installed adapter
// Re-downloads from GitHub and overwrites the local file
// ─────────────────────────────────────────────────────────────────

async function updateOneAdapter(method, agent, options = {}) {
  const isGlobal    = options.global || false
  const adapterKey  = method.adapters[agent.key] ? agent.key : 'generic'
  const adapterPath = method.adapters[adapterKey]

  if (!adapterPath) {
    console.log(chalk.dim(`  ${agent.name} — no adapter in registry, skipping`))
    return false
  }

  const installPath = getInstallPath(agent, method.id, { global: isGlobal })
  const exists  = await fs.pathExists(installPath)
  const action  = exists ? 'Updating' : 'Restoring'
  const s = ora(`${action} ${agent.name}...`).start()

  try {
    const content = await fetchFromGitHub(method.repo, adapterPath)
    await fs.ensureDir(path.dirname(installPath))

    // Windsurf: replace existing section, don't append duplicates
    if (agent.key === 'windsurf' && exists) {
      const existing = await fs.readFile(installPath, 'utf8')
      if (existing.includes(method.name)) {
        const marker = '\n\n---\n\n'
        const idx    = existing.indexOf(method.name)
        const before = existing.substring(0, existing.lastIndexOf(marker, idx) + marker.length)
        await fs.writeFile(installPath, before + content)
      } else {
        await fs.appendFile(installPath, `\n\n---\n\n${content}`)
      }
    } else {
      await fs.writeFile(installPath, content)
    }

    s.succeed(chalk.green(`${agent.name} — ${action.toLowerCase()}d`))
    console.log(chalk.dim(`  → ${installPath}\n`))
    return true

  } catch (err) {
    s.fail(chalk.red(`${agent.name} — ${err.message}`))
    return false
  }
}

// ─────────────────────────────────────────────────────────────────
// New agents selection during update (Enquirer, Windows-safe)
// ─────────────────────────────────────────────────────────────────

async function checkboxSelectNew(newAgents, method) {
  if (newAgents.length === 0) return []

  if (!process.stdin.isTTY) {
    return newAgents
  }

  const prompt = new MultiSelect({
    name: 'newAgents',
    message: 'Add these agents for this method?',
    choices: newAgents.map(a => ({
      name: a.key,
      message: `${a.name}${!method.adapters[a.key] ? ' (generic adapter)' : ''}`,
      value: a,
      enabled: true
    })),
    result (names) {
      return this.options.choices.filter(c => names.includes(c.name)).map(c => c.value)
    }
  })

  try {
    return await prompt.run() || []
  } catch (err) {
    if (err.name === 'ENOTTY' || err.message?.includes('cancel')) {
      return []
    }
    throw err
  }
}
