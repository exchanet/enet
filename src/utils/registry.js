import fetch from 'node-fetch'
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
  // Try remote first
  try {
    const res = await fetch(REGISTRY_URL, { timeout: 5000 })
    if (res.ok) {
      const data = await res.json()
      // Save to cache for offline fallback
      await fs.writeJson(CACHE_FILE, { ...data, _cachedAt: Date.now() }).catch(() => {})
      return data
    }
  } catch {
    // Network unavailable — fall through to cache
  }

  // Try local cache
  try {
    if (await fs.pathExists(CACHE_FILE)) {
      const cached = await fs.readJson(CACHE_FILE)
      const age = Date.now() - (cached._cachedAt || 0)
      if (age < CACHE_TTL_MS * 24) { // Accept cache up to 24h when offline
        return cached
      }
    }
  } catch {
    // Cache corrupted — fall through to bundled
  }

  // Fallback to bundled registry.json
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
