type TelemetryEvent = {
  name: string
  timestamp: number
  data?: Record<string, unknown>
}

type TelemetrySnapshot = {
  firstVisitAt: number
  lastVisitAt: number
  initialValueAt?: number
  initialValueSource?: 'cells' | 'backtest'
  advancedFeatureUsage: Record<string, number>
  retentionVisits: number
  strategyComplexity: {
    cellCount: number
    transitionCount: number
  }
  events: TelemetryEvent[]
}

const TELEMETRY_KEY = 'strategy-ui-telemetry-v1'

const createDefaultSnapshot = (): TelemetrySnapshot => {
  const now = Date.now()
  return {
    firstVisitAt: now,
    lastVisitAt: now,
    advancedFeatureUsage: {},
    retentionVisits: 1,
    strategyComplexity: {
      cellCount: 0,
      transitionCount: 0,
    },
    events: [],
  }
}

const readSnapshot = (): TelemetrySnapshot => {
  if (typeof window === 'undefined') return createDefaultSnapshot()
  try {
    const raw = window.localStorage.getItem(TELEMETRY_KEY)
    if (!raw) return createDefaultSnapshot()
    const parsed = JSON.parse(raw) as TelemetrySnapshot
    return {
      ...createDefaultSnapshot(),
      ...parsed,
      advancedFeatureUsage: parsed.advancedFeatureUsage ?? {},
      strategyComplexity: parsed.strategyComplexity ?? { cellCount: 0, transitionCount: 0 },
      events: parsed.events ?? [],
    }
  } catch {
    return createDefaultSnapshot()
  }
}

const writeSnapshot = (snapshot: TelemetrySnapshot) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(TELEMETRY_KEY, JSON.stringify(snapshot))
}

const mutateSnapshot = (mutator: (snapshot: TelemetrySnapshot) => TelemetrySnapshot) => {
  const current = readSnapshot()
  const next = mutator(current)
  writeSnapshot(next)
  return next
}

export const trackRetentionVisit = () => {
  mutateSnapshot((snapshot) => {
    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    const isNewVisit = now - snapshot.lastVisitAt > dayMs * 0.5
    return {
      ...snapshot,
      lastVisitAt: now,
      retentionVisits: snapshot.retentionVisits + (isNewVisit ? 1 : 0),
    }
  })
}

export const trackEvent = (name: string, data?: Record<string, unknown>) => {
  mutateSnapshot((snapshot) => ({
    ...snapshot,
    events: [...snapshot.events.slice(-99), { name, timestamp: Date.now(), data }],
  }))
}

export const trackInitialValueRealization = (source: 'cells' | 'backtest') => {
  mutateSnapshot((snapshot) => {
    if (snapshot.initialValueAt) return snapshot
    return {
      ...snapshot,
      initialValueAt: Date.now(),
      initialValueSource: source,
    }
  })
}

export const trackAdvancedFeatureUsage = (feature: string) => {
  mutateSnapshot((snapshot) => ({
    ...snapshot,
    advancedFeatureUsage: {
      ...snapshot.advancedFeatureUsage,
      [feature]: (snapshot.advancedFeatureUsage[feature] ?? 0) + 1,
    },
  }))
}

export const trackStrategyComplexity = (cellCount: number, transitionCount: number) => {
  mutateSnapshot((snapshot) => ({
    ...snapshot,
    strategyComplexity: {
      cellCount,
      transitionCount,
    },
  }))
}

export const getTelemetrySnapshot = () => readSnapshot()
