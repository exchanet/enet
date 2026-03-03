import fs from 'fs-extra'
import path from 'path'
import os from 'os'

const HOME = os.homedir()

export const AGENTS = {
  cursor: {
    name: 'Cursor',
    systemSignals: [
      path.join(HOME, '.cursor')
    ],
    projectSignals: ['.cursor/rules', '.cursor'],
    projectInstallDir: '.cursor/rules',
    globalInstallDir: path.join(HOME, '.cursor', 'rules'),
    filename: 'enet-{id}.md',
    configNote: 'Rule auto-applies to all files (alwaysApply: true)'
  },
  windsurf: {
    name: 'Windsurf',
    systemSignals: [
      path.join(HOME, '.codeium', 'windsurf')
    ],
    projectSignals: ['.windsurfrules', '.windsurf'],
    projectInstallDir: '.',
    globalInstallDir: path.join(HOME, '.codeium', 'windsurf', 'memories'),
    globalFilename: 'global_rules.md',
    filename: '.windsurfrules',
    configNote: 'Appended to global_rules.md'
  },
  antigravity: {
    name: 'Antigravity (Google)',
    systemSignals: [
      path.join(HOME, '.gemini', 'antigravity')
    ],
    projectSignals: ['.agent/rules', '.agent'],
    projectInstallDir: '.agent/rules',
    globalInstallDir: path.join(HOME, '.gemini', 'antigravity', 'skills', 'method-modular-design'),
    globalFilename: 'SKILL.md',
    filename: 'enet-{id}.md',
    configNote: 'Skill saved — set activation to Always On in Antigravity'
  },
  claudecode: {
    name: 'Claude Code',
    systemSignals: [
      path.join(HOME, '.claude')
    ],
    projectSignals: ['CLAUDE.md', '.claude'],
    projectInstallDir: '.',
    globalInstallDir: path.join(HOME, '.claude'),
    globalFilename: 'CLAUDE.md',
    filename: 'CLAUDE.md',
    configNote: 'Written to ~/.claude/CLAUDE.md — Claude Code reads this automatically'
  },
  copilot: {
    name: 'GitHub Copilot',
    systemSignals: [],
    projectSignals: ['.github/copilot-instructions.md'],
    projectInstallDir: '.github',
    globalInstallDir: null,
    filename: 'copilot-instructions.md',
    configNote: 'Written to .github/copilot-instructions.md'
  },
  generic: {
    name: 'Generic Agent',
    systemSignals: [],
    projectSignals: [],
    projectInstallDir: '.enet',
    globalInstallDir: null,
    filename: '{id}.md',
    configNote: 'Saved to .enet/ — paste contents into your agent\'s context'
  }
}

/**
 * Detects ALL agents installed on the system by checking known global paths.
 */
export async function detectSystemAgents() {
  const found = []
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key === 'generic') continue
    for (const signal of agent.systemSignals) {
      if (await fs.pathExists(signal)) {
        found.push({ key, ...agent })
        break
      }
    }
  }
  return found
}

/**
 * Detects ALL agents present in the current project.
 */
export async function detectProjectAgents(cwd = process.cwd()) {
  const found = []
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key === 'generic') continue
    for (const signal of agent.projectSignals) {
      if (await fs.pathExists(path.join(cwd, signal))) {
        found.push({ key, ...agent })
        break
      }
    }
  }
  return found
}

/**
 * Returns the first detected agent (legacy, used by status/doctor).
 */
export async function detectAgent(cwd = process.cwd()) {
  const agents = await detectProjectAgents(cwd)
  return agents[0] ?? { key: 'generic', ...AGENTS.generic }
}

/**
 * Returns the install path for a method adapter.
 */
export function getInstallPath(agent, methodId, { global = false, cwd = process.cwd() } = {}) {
  if (global) {
    const filename = agent.globalFilename ?? agent.filename.replace('{id}', methodId)
    return path.join(agent.globalInstallDir, filename)
  }
  const filename = agent.filename.replace('{id}', methodId)
  return path.join(cwd, agent.projectInstallDir, filename)
}
