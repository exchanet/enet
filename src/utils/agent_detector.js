import fs from 'fs-extra'
import path from 'path'
import os from 'os'

const HOME = os.homedir()

export const AGENTS = {
  cursor: {
    name: 'Cursor',
    systemSignals: [
      path.join(HOME, '.cursor'),
      path.join(HOME, 'Library', 'Application Support', 'Cursor'),   // macOS
      path.join(HOME, 'AppData', 'Roaming', 'Cursor'),               // Windows
      path.join(HOME, '.config', 'Cursor'),                          // Linux
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
      path.join(HOME, 'Library', 'Application Support', 'Windsurf'), // macOS
      path.join(HOME, 'AppData', 'Roaming', 'Windsurf'),             // Windows
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
      path.join(HOME, 'Library', 'Application Support', 'Google', 'Antigravity'), // macOS
      path.join(HOME, 'AppData', 'Roaming', 'Google', 'Antigravity'),             // Windows
    ],
    projectSignals: ['.agent/rules', '.agent'],
    projectInstallDir: '.agent/rules',
    // globalInstallDir is a base — getInstallPath() resolves the full path dynamically:
    // ~/.gemini/antigravity/skills/method-{id}/SKILL.md
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
    // Copilot is a VS Code extension — detect by checking the extensions folder
    // for a github.copilot-* subfolder, not just the presence of .vscode/
    systemSignals: [
      path.join(HOME, '.vscode', 'extensions'),                                         // Linux / Windows
      path.join(HOME, 'Library', 'Application Support', 'Code', 'User', 'extensions'), // macOS
      path.join(HOME, 'AppData', 'Roaming', 'Code', 'User', 'extensions'),             // Windows alt
      path.join(HOME, '.vscode-server', 'extensions'),                                  // remote / SSH
    ],
    systemSignalFilter: (signalPath) => {
      // Only return true if a github.copilot extension folder exists inside
      try {
        const entries = fs.readdirSync(signalPath)
        return entries.some(e => e.toLowerCase().startsWith('github.copilot'))
      } catch {
        return false
      }
    },
    projectSignals: ['.github/copilot-instructions.md'],
    projectInstallDir: '.github',
    globalInstallDir: null, // Copilot has no global rules path
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
    configNote: 'Saved to .enet/ — paste contents into your agent\'s context'
  }
}

// ─────────────────────────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────────────────────────

/**
 * Detects ALL agents installed on the system by checking known global paths.
 * Uses systemSignalFilter for agents that share directories with other software
 * (e.g. Copilot shares VS Code's extensions folder).
 */
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
        continue // signal dir exists but filter didn't match — try next signal path
      }
      found.push({ key, ...agent })
      break
    }
  }
  return found
}

/**
 * Detects ALL agents present in the current project folder.
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
 * Returns the first detected agent (legacy — used by status/doctor).
 */
export async function detectAgent(cwd = process.cwd()) {
  const agents = await detectProjectAgents(cwd)
  return agents[0] ?? { key: 'generic', ...AGENTS.generic }
}

// ─────────────────────────────────────────────────────────────────
// Path resolution
// ─────────────────────────────────────────────────────────────────

/**
 * Returns the resolved install path for a given agent + method.
 *
 * Special cases:
 *  - antigravity global → ~/.gemini/antigravity/skills/method-{id}/SKILL.md
 *    Each method gets its own subfolder (not a shared file).
 *  - windsurf global    → ~/.codeium/windsurf/memories/global_rules.md
 *  - claudecode global  → ~/.claude/CLAUDE.md
 */
export function getInstallPath(agent, methodId, { global = false, cwd = process.cwd() } = {}) {
  if (global) {
    if (!agent.globalInstallDir) return null // agent doesn't support global install

    if (agent.key === 'antigravity') {
      // Dynamic subfolder per method: skills/method-{id}/SKILL.md
      return path.join(agent.globalInstallDir, `method-${methodId}`, 'SKILL.md')
    }

    const filename = agent.globalFilename ?? agent.filename.replace('{id}', methodId)
    return path.join(agent.globalInstallDir, filename)
  }

  // Project-level install
  const filename = agent.filename.replace('{id}', methodId)
  return path.join(cwd, agent.projectInstallDir, filename)
}
