import fs from 'fs-extra'
import path from 'path'

export const AGENTS = {
  cursor: {
    name: 'Cursor',
    signals: ['.cursor'],
    installDir: '.cursor/rules',
    filename: 'enet-{id}.md',
    configNote: 'Rule auto-applies to all files (alwaysApply: true)'
  },
  windsurf: {
    name: 'Windsurf',
    signals: ['.windsurfrules', '.windsurf'],
    installDir: '.',
    filename: '.windsurfrules',
    configNote: 'Appended to .windsurfrules'
  },
  copilot: {
    name: 'GitHub Copilot',
    signals: ['.github/copilot-instructions.md', '.github'],
    installDir: '.github',
    filename: 'copilot-instructions.md',
    configNote: 'Written to .github/copilot-instructions.md'
  },
  antigravity: {
    name: 'Antigravity (Google)',
    signals: ['.agent/rules', '.agent'],
    installDir: '.agent/rules',
    filename: 'enet-{id}.md',
    configNote: 'Rule saved to .agent/rules/ — set activation to Always On in Antigravity'
  },
  claudecode: {
    name: 'Claude Code',
    signals: ['CLAUDE.md', '.claude'],
    installDir: '.',
    filename: 'CLAUDE.md',
    configNote: 'Written to CLAUDE.md — Claude Code reads this file automatically'
  },
  generic: {
    name: 'Generic Agent',
    signals: [],
    installDir: '.enet',
    filename: '{id}.md',
    configNote: 'Saved to .enet/ — paste contents into your agent\'s context'
  }
}

/**
 * Detects which AI agent is active in the current project.
 */
export async function detectAgent(cwd = process.cwd()) {
  for (const [key, agent] of Object.entries(AGENTS)) {
    if (key === 'generic') continue
    for (const signal of agent.signals) {
      if (await fs.pathExists(path.join(cwd, signal))) {
        return { key, ...agent }
      }
    }
  }
  return { key: 'generic', ...AGENTS.generic }
}

/**
 * Returns the full install path for a method adapter.
 */
export function getInstallPath(agent, methodId, cwd = process.cwd()) {
  const filename = agent.filename.replace('{id}', methodId)
  return path.join(cwd, agent.installDir, filename)
}
