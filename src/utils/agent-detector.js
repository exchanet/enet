import fs from 'fs-extra'
import path from 'path'
import os from 'os'

const HOME = os.homedir()

export const AGENTS = {
  cursor: {
    name: 'Cursor',
    systemSignals: [
      path.join(HOME, '.cursor'),
      path.join(HOME, 'Library', 'Application Support', 'Cursor'),
      path.join(HOME, 'AppData', 'Roaming', 'Cursor'),
      path.join(HOME, '.config', 'Cursor'),
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
      path.join(HOME, '.codeium', 'windsurf'),
      path.join(HOME, 'Library', 'Application Support', 'Windsurf'),
      path.join(HOME, 'AppData', 'Roaming', 'Windsurf'),
    ],
    projectSignals: ['.windsurfrules', '.windsurf'],
    projectInstallDir: '.',
    globalInstallDir: path.join(HOME, '.codeium', 'windsurf', 'memories'),
    globalFilename: 'global_rules.md',
    filename: '.windsurfrules',
    configNote: 'Appended to .windsurfrules in project root'
  },

  antigravity: {
    name: 'Antigravity (Google)',
    systemSignals: [
      path.join(HOME, '.gemini', 'antigravity'),
      path.join(HOME, 'Library', 'Application Support', 'Google', 'Antigravity'),
      path.join(HOME, 'AppData', 'Roaming', 'Google', 'Antigravity'),
    ],
    projectSignals: ['.agent/rules', '.agent'],
    projectInstallDir: '.agent/rules',
    globalInstallDir: path.join(HOME, '.gemini', 'antigravity', 'skills'),
    globalFilename: 'SKILL.md',
    filename: 'enet-{id}.md',
    configNote: 'Rule placed in .agent/rules/ — activates automatically in Antigravity'
  },

  claudecode: {
    name: 'Claude Code',
    systemSignals: [
      path.join(HOME, '.claude'),
    ],
    projectSignals: ['CLAUDE.md', '.claude'],
    projectInstallDir: '.',
    globalInstallDir: path.join(HOME, '.claude'),
    globalFilename: 'CLAUDE.md',
    filename: 'CLAUDE.md',
    configNote: 'Written to CLAUDE.md — Claude Code reads this automatically'
  },

  copilot: {
    name: 'GitHub Copilot',
    systemSignals: [
      path.join(HOME, '.vscode', 'extensions'),
      path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'extensions'),
      path.join(HOME, 'AppData', 'Roaming', 'Code', 'User', 'extensions'),
      path.join(HOME, '.vscode-server', 'extensions'),
    ],
    systemSignalFilter: (signalPath) => {
      try {
        const entries = fs.readdirSync(signalPath)
        return entries.some(e => e.toLowerCase().startsWith('github.copilot'))
      } catch {
        return false
      }
    },
    projectSignals: ['.github/copilot-instructions.md'],
    projectInstallDir: '.github',
    globalInstallDir: null,
    filename: 'copilot-instructions.md',
    configNote: 'Written to .github/copilot-instructions.md'
  },

  generic: {
    name: 'Generic / Other agent',
    systemSignals: [],
    projectSignals: [],
    projectInstallDir: '.enet',
    globalInstallDir: null,
    filename: '{id}.md',
    configNote: "Saved to .enet/ — paste contents into your agent's context"
  }
}

export async function detectSystemAgents() {
  const found = []
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key === 'generic') continue
    for (const signal of agent.systemSignals) {
      const exists = await fs.pathExists(signal)
      if (!exists) continue
      if (agent.systemSignalFilter) {
        if (agent.systemSignalFilter(signal)) {
          found.push({ key, ...agent })
          break
        }
        continue
      }
      found.push({ key, ...agent })
      break
    }
  }
  return found
}

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

export async function detectAgent(cwd = process.cwd()) {
  const agents = await detectProjectAgents(cwd)
  return agents[0] ?? { key: 'generic', ...AGENTS.generic }
}

export function getInstallPath(agent, methodId, { global = false, cwd = process.cwd() } = {}) {
  if (global) {
    if (!agent.globalInstallDir) return null

    if (agent.key === 'antigravity') {
      return path.join(agent.globalInstallDir, `method-${methodId}`, 'SKILL.md')
    }

    const filename = agent.globalFilename ?? agent.filename.replace('{id}', methodId)
    return path.join(agent.globalInstallDir, filename)
  }

  const filename = agent.filename.replace('{id}', methodId)
  return path.join(cwd, agent.projectInstallDir, filename)
}
