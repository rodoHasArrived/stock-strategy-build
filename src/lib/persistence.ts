/**
 * External private persistence layer.
 *
 * Stores strategy definitions, run logs, and artifacts in the browser's
 * localStorage — outside Spark's default shared KV store — so that each
 * user's data remains private to their browser session.
 */

const PREFIX = 'ssb:private:'
const KEY_STRATEGY = `${PREFIX}strategy`
const KEY_RUN_LOG_INDEX = `${PREFIX}run-log-index`
const KEY_ARTIFACT_INDEX = `${PREFIX}artifact-index`

// ─── Strategy ────────────────────────────────────────────────────────────────

export function saveStrategyExternal(strategy: unknown): void {
  try {
    localStorage.setItem(KEY_STRATEGY, JSON.stringify(strategy))
  } catch {
    // localStorage may be unavailable in some environments; fail silently
  }
}

export function loadStrategyExternal(): unknown | null {
  try {
    const raw = localStorage.getItem(KEY_STRATEGY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// ─── Run logs ─────────────────────────────────────────────────────────────────

function runLogKey(runId: string): string {
  return `${PREFIX}run-log:${runId}`
}

function runLogIndex(): string[] {
  try {
    const raw = localStorage.getItem(KEY_RUN_LOG_INDEX)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveRunLog(runId: string, log: unknown): void {
  try {
    localStorage.setItem(runLogKey(runId), JSON.stringify(log))
    const index = runLogIndex()
    if (!index.includes(runId)) {
      index.push(runId)
      localStorage.setItem(KEY_RUN_LOG_INDEX, JSON.stringify(index))
    }
  } catch {
    // ignore
  }
}

export function loadRunLog(runId: string): unknown | null {
  try {
    const raw = localStorage.getItem(runLogKey(runId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function listRunLogs(): string[] {
  return runLogIndex()
}

export function deleteRunLog(runId: string): void {
  try {
    localStorage.removeItem(runLogKey(runId))
    const index = runLogIndex().filter(id => id !== runId)
    localStorage.setItem(KEY_RUN_LOG_INDEX, JSON.stringify(index))
  } catch {
    // ignore
  }
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

function artifactKey(name: string): string {
  return `${PREFIX}artifact:${name}`
}

function artifactIndex(): string[] {
  try {
    const raw = localStorage.getItem(KEY_ARTIFACT_INDEX)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveArtifact(name: string, data: string): void {
  try {
    localStorage.setItem(artifactKey(name), data)
    const index = artifactIndex()
    if (!index.includes(name)) {
      index.push(name)
      localStorage.setItem(KEY_ARTIFACT_INDEX, JSON.stringify(index))
    }
  } catch {
    // ignore
  }
}

export function loadArtifact(name: string): string | null {
  try {
    return localStorage.getItem(artifactKey(name))
  } catch {
    return null
  }
}

export function listArtifacts(): string[] {
  return artifactIndex()
}

// ─── File download helper ─────────────────────────────────────────────────────

export function downloadJSON(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
