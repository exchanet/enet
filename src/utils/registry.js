import fs from 'fs-extra'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const RAW_BASE   = 'https://raw.githubusercontent.com'
const REGISTRY_URL = `${RAW_BASE}/exchanet/enet/main/registry.json`
const CACHE_FILE   = path.join(__dirname, '../../.registry-cache.json')
const CACHE_TTL_MS = 1000 * 60 * 60 // 1 hour

// ── Registry ──────────────────────────────────────────────────────────────────

/**
 * Loads the registry from:
 * 1. Remote GitHub (exchanet/enet/registry.json) — always fresh
 * 2. Local cache if remote fails — fallback
 * 3. Bundled registry.json in the package — last resort
 */
export async function loadRegistry() {
  try {
    const res = await fetch(REGISTRY_URL, { signal: AbortSignal.timeout(5000) })
    if (res.ok) {
      const data = await res.json()
      await fs.writeJson(CACHE_FILE, { ...data, _cachedAt: Date.now() }).catch(() => {})
      return data
    }
  } catch {
    // Network unavailable — fall through to cache
  }

  try {
    if (await fs.pathExists(CACHE_FILE)) {
      const cached = await fs.readJson(CACHE_FILE)
      const age = Date.now() - (cached._cachedAt || 0)
      if (age < CACHE_TTL_MS * 24) {
        return cached
      }
    }
  } catch {
    // Cache corrupted — fall through to bundled
  }

  const bundled = path.join(__dirname, '../../registry.json')
  return fs.readJson(bundled)
}

/**
 * Returns a single method from the registry, or null if not found.
 */
export async function getMethod(id) {
  const registry = await loadRegistry()
  return registry.methods?.[id] ?? null
}

/**
 * Returns all methods from the registry as an array.
 */
export async function getAllMethods() {
  const registry = await loadRegistry()
  return Object.values(registry.methods ?? {})
}

// ── GitHub file fetcher ───────────────────────────────────────────────────────

/**
 * Fetches a raw file from a GitHub repo (main branch).
 */
export async function fetchFromGitHub(repo, filePath) {
  const url = `${RAW_BASE}/${repo}/main/${filePath}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(
      `Could not fetch ${filePath} from ${repo} (HTTP ${res.status})\n` +
      `  URL: ${url}`
    )
  }

  return res.text()
}

// ── Install state ─────────────────────────────────────────────────────────────
//
// Tracks which agents have each method installed.
// Stored in .enet/installed.json in the project root.
//
// Format:
// {
//   "pdca-t": {
//     "agents": ["cursor", "claudecode", "antigravity"],
//     "version": "3.0.0",
//     "updatedAt": "2025-03-01T10:00:00.000Z"
//   },
//   "modular-design": { ... }
// }

function getInstallRecordFile() {
  // Resolve relative to cwd so it works in any project
  return path.join(process.cwd(), '.enet', 'installed.json')
}

/**
 * Reads the install record for a single method.
 * Returns { agents: ['cursor', ...], version: '3.0.0', updatedAt: '...' }
 * or null if the method has never been installed.
 */
export async function readInstallRecord(methodId) {
  try {
    const file = getInstallRecordFile()
    if (!await fs.pathExists(file)) return null
    const data = await fs.readJson(file)
    return data[methodId] ?? null
  } catch {
    return null
  }
}

/**
 * Writes (or updates) the install record for a single method.
 * Merges with existing records — other methods are not touched.
 */
export async function writeInstallRecord(methodId, record) {
  try {
    const file = getInstallRecordFile()
    await fs.ensureDir(path.dirname(file))

    let data = {}
    if (await fs.pathExists(file)) {
      data = await fs.readJson(file).catch(() => ({}))
    }

    data[methodId] = {
      agents: record.agents,
      version: record.version ?? null,
      updatedAt: new Date().toISOString()
    }

    await fs.writeJson(file, data, { spaces: 2 })
  } catch {
    // Non-fatal — install works correctly even if state cannot be saved
  }
}
