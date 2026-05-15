import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  BracketsCurly,
  BookOpen,
  CalendarBlank,
  ChartLine,
  CheckCircle,
  ClockCounterClockwise,
  Database,
  Download,
  Equals,
  FileCsv,
  FloppyDisk,
  PlayCircle,
  PlugsConnected,
  Rows,
  Table as TableIcon,
  TrendDown,
  TrendUp,
  Upload,
  WarningCircle,
} from '@phosphor-icons/react'
import {
  BacktestConfig,
  BacktestDiagnostic,
  BacktestRunRecord,
  BacktestResult,
  StrategyDataset,
  StrategySessionState,
} from '@/lib/types'
import { toast } from 'sonner'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { CommonMistakesGuide, StrategyCodeHelper } from '@/components/StrategyCodeHelper'
import { cn } from '@/lib/utils'
import { fixtureStrategyDataProvider } from '@/lib/strategyDataProvider'
import { downloadJSON, listBacktestRunRecords, saveBacktestRunRecord } from '@/lib/persistence'

interface BacktestBuilderProps {
  onRun: (config: BacktestConfig, strategyCode: string, dataFiles: Record<string, any>, dataset?: StrategyDataset | null) => Promise<BacktestResult>
  strategyId?: string
  strategyName?: string
  strategyVersion?: number
  session?: StrategySessionState
  templateCategory?: string
  onDatasetChange?: (dataset: StrategyDataset | null) => void
  onSessionChange?: (updates: Partial<StrategySessionState>) => void
  onRunRecordChange?: (record: BacktestRunRecord | null, isStale: boolean) => void
}

const datasets = fixtureStrategyDataProvider.listDatasets()
const defaultDataset = datasets[0]

const getRows = (data: unknown): Array<Record<string, unknown>> => {
  if (Array.isArray(data)) return data as Array<Record<string, unknown>>
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: Array<Record<string, unknown>> }).data
  }
  return []
}

const getRowCount = (data: unknown) => getRows(data).length

const getDateValue = (row: Record<string, unknown>) => {
  const value = row.SessionDate ?? row.Date ?? row.date
  return typeof value === 'string' ? value : undefined
}

const parseDateValue = (value?: string) => {
  if (!value) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

const formatShortDate = (value?: string) => value ?? 'open'

const getFieldSet = (rows: Array<Record<string, unknown>>) => {
  const fieldSet = new Set<string>()
  rows.forEach(row => Object.keys(row).forEach(field => fieldSet.add(field)))
  return fieldSet
}

const hasAnyField = (fields: Set<string>, candidates: string[]) =>
  candidates.some(candidate => fields.has(candidate))

const getMissingFields = (fields: Set<string>) => {
  const missing: string[] = []
  if (!hasAnyField(fields, ['SessionDate', 'Date', 'date'])) missing.push('date')
  if (!hasAnyField(fields, ['Close', 'close'])) missing.push('close')
  if (!hasAnyField(fields, ['Volume', 'volume'])) missing.push('volume')
  return missing
}

const analyzeDataFiles = (files: Record<string, any>) => {
  const rowCounts: Record<string, number> = {}
  const symbolFields: Record<string, string[]> = {}
  const missingFields: Record<string, string[]> = {}
  const fields = new Set<string>()
  const dates: string[] = []

  Object.entries(files).forEach(([symbol, data]) => {
    const rows = getRows(data)
    rowCounts[symbol] = rows.length
    const fieldSet = getFieldSet(rows)
    symbolFields[symbol] = Array.from(fieldSet).sort()
    symbolFields[symbol].forEach(field => fields.add(field))
    const missing = getMissingFields(fieldSet)
    if (missing.length > 0) missingFields[symbol] = missing
    rows.forEach(row => {
      const date = getDateValue(row)
      if (date) dates.push(date)
    })
  })

  dates.sort()

  return {
    fields: Array.from(fields).sort(),
    rowCounts,
    symbolFields,
    missingFields,
    startDate: dates[0],
    endDate: dates[dates.length - 1],
    totalRows: Object.values(rowCounts).reduce((sum, count) => sum + count, 0),
  }
}

const buildCustomDataset = (
  current: StrategyDataset | null,
  data: Record<string, any>,
  importedSymbol: string,
  fileName: string
): StrategyDataset => {
  const analysis = analyzeDataFiles(data)
  const symbols = Object.keys(data)
  const fingerprint = [
    'custom',
    symbols.join(','),
    Object.entries(analysis.rowCounts).map(([symbol, count]) => `${symbol}:${count}`).join('|'),
    analysis.startDate ?? 'no-start',
    analysis.endDate ?? 'no-end',
    analysis.fields.join(','),
    Date.now(),
  ].join('::')

  return {
    id: current?.category === 'custom' ? current.id : `custom-${Date.now()}`,
    name: current?.category === 'custom' ? current.name : 'Custom Research Dataset',
    description: 'Imported market data managed locally for strategy proofing.',
    category: 'custom',
    symbols,
    period: analysis.startDate && analysis.endDate ? `${analysis.startDate} to ${analysis.endDate}` : 'custom window',
    dataType: 'Imported CSV/JSON market rows',
    useCase: current?.useCase ?? 'Custom signal logic',
    fields: analysis.fields,
    rowCounts: analysis.rowCounts,
    startDate: analysis.startDate,
    endDate: analysis.endDate,
    coupons: current?.coupons,
    provenance: {
      provider: 'import',
      source: fileName,
      asOf: new Date().toISOString(),
      notes: `Last import replaced ${importedSymbol}.`,
    },
    fingerprint,
    data,
    strategyTemplate: current?.strategyTemplate ?? '',
    compatibleTemplateCategories: current?.compatibleTemplateCategories?.length
      ? current.compatibleTemplateCategories
      : ['Equity', 'Fixed Income', 'Portfolio', 'Trading'],
  }
}

const parseCellValue = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  const numeric = Number(trimmed)
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(trimmed) ? numeric : trimmed
}

const parseCsvRows = (text: string): Array<Record<string, unknown>> => {
  const rows: string[][] = []
  let cell = ''
  let row: string[] = []
  let inQuotes = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && inQuotes && next === '"') {
      cell += '"'
      index += 1
    } else if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      row.push(cell)
      cell = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') index += 1
      row.push(cell)
      if (row.some(value => value.trim())) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell)
  if (row.some(value => value.trim())) rows.push(row)

  const [rawHeaders, ...body] = rows
  if (!rawHeaders) return []
  const headers = rawHeaders.map((header, index) => header.replace(/^\uFEFF/, '').trim() || `field_${index + 1}`)

  return body.map(values => Object.fromEntries(
    headers.map((header, index) => [header, parseCellValue(values[index] ?? '')])
  ))
}

const readImportedData = async (file: File) => {
  const text = await file.text()
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsvRows(text)
  return JSON.parse(text)
}

const getFreshness = (asOf?: string) => {
  const timestamp = parseDateValue(asOf)
  if (!timestamp) return { label: 'Unknown', detail: 'No as-of timestamp', variant: 'outline' as const }

  const ageDays = Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000))
  if (ageDays <= 7) return { label: 'Fresh', detail: `${ageDays} days old`, variant: 'default' as const }
  if (ageDays <= 90) return { label: 'Aging', detail: `${ageDays} days old`, variant: 'secondary' as const }
  return { label: 'Historical', detail: `${ageDays} days old`, variant: 'outline' as const }
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPct = (value: number) => Number.isFinite(value) ? `${value.toFixed(2)}%` : 'n/a'

const formatDateInput = (date?: Date) => date ? date.toISOString().slice(0, 10) : ''

const buildDatasetFingerprint = (
  dataset: StrategyDataset | null,
  dataFiles: Record<string, any>
) => {
  const rows = Object.entries(dataFiles)
    .map(([symbol, data]) => `${symbol}:${getRowCount(data)}`)
    .sort()
    .join('|')
  return `${dataset?.fingerprint ?? 'custom'}::${rows}`
}

const buildRunSignature = (
  config: BacktestConfig,
  strategyCode: string,
  datasetFingerprint: string
) => JSON.stringify({
  startCapital: config.startCapital,
  transactionCost: config.transactionCost,
  volumeCapPct: config.volumeCapPct,
  slippageModel: config.slippageModel,
  startDate: config.startDate?.toISOString() ?? null,
  endDate: config.endDate?.toISOString() ?? null,
  strategyCode,
  datasetFingerprint,
})

const createDiagnostic = (
  severity: BacktestDiagnostic['severity'],
  message: string,
  id: string,
  symbol?: string
): BacktestDiagnostic => ({
  id,
  severity,
  message,
  symbol,
})

const validateBacktestInputs = (
  config: BacktestConfig,
  strategyCode: string,
  dataFiles: Record<string, any>
): BacktestDiagnostic[] => {
  const diagnostics: BacktestDiagnostic[] = []

  if (!strategyCode.trim()) {
    diagnostics.push(createDiagnostic('error', 'Strategy logic is empty.', 'strategy-empty'))
  }

  if (config.startDate && config.endDate && config.startDate > config.endDate) {
    diagnostics.push(createDiagnostic('error', 'Start date must be before end date.', 'date-window-invalid'))
  }

  if (Object.keys(dataFiles).length === 0) {
    diagnostics.push(createDiagnostic('error', 'No symbols are loaded for this backtest.', 'dataset-empty'))
  }

  Object.entries(dataFiles).forEach(([symbol, data]) => {
    const rows = getRows(data)
    if (rows.length === 0) {
      diagnostics.push(createDiagnostic('error', `${symbol} has no rows.`, 'symbol-empty', symbol))
      return
    }

    const firstRow = rows[0]
    const hasDate = 'SessionDate' in firstRow || 'Date' in firstRow || 'date' in firstRow
    if (!hasDate) {
      diagnostics.push(createDiagnostic('error', `${symbol} is missing a date column.`, 'symbol-missing-date', symbol))
    }

    const tradableRows = rows.filter(row => {
      const close = Number(row.Close ?? row.close)
      return Number.isFinite(close) && close > 0
    })
    if (tradableRows.length === 0) {
      diagnostics.push(createDiagnostic('error', `${symbol} has no tradable positive close prices.`, 'symbol-no-price', symbol))
    }

    const volumeRows = rows.filter(row => {
      const volume = Number(row.Volume ?? row.volume)
      return Number.isFinite(volume) && volume > 0
    })
    if (volumeRows.length === 0) {
      diagnostics.push(createDiagnostic('warning', `${symbol} has no positive volume rows; volume caps may prevent trades.`, 'symbol-no-volume', symbol))
    }
  })

  return diagnostics
}

const countReasons = (result: BacktestResult | null) => {
  if (!result) return []
  const counts = new Map<string, number>()
  result.trades.forEach(trade => counts.set(trade.reason, (counts.get(trade.reason) ?? 0) + 1))
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
}

export function BacktestBuilder({
  onRun,
  strategyId = 'default',
  strategyName = 'New Strategy',
  strategyVersion,
  session,
  templateCategory,
  onDatasetChange,
  onSessionChange,
  onRunRecordChange,
}: BacktestBuilderProps) {
  const sessionDataset = session?.datasetId ? fixtureStrategyDataProvider.loadDataset(session.datasetId) : undefined
  const initialDataset = sessionDataset ?? defaultDataset ?? null
  const [config, setConfig] = useState<BacktestConfig>({
    startCapital: 1000,
    startDate: initialDataset?.startDate ? new Date(initialDataset.startDate) : undefined,
    endDate: initialDataset?.endDate ? new Date(initialDataset.endDate) : undefined,
    transactionCost: 0.003,
    volumeCapPct: 0.25,
    slippageModel: 'adaptive',
  })
  const [selectedDataset, setSelectedDataset] = useState<StrategyDataset | null>(initialDataset)
  const [strategyCode, setStrategyCode] = useState(session?.backtestCode ?? initialDataset?.strategyTemplate ?? '')
  const [dataFiles, setDataFiles] = useState<Record<string, any>>(initialDataset?.data ?? {})
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [activeRunRecord, setActiveRunRecord] = useState<BacktestRunRecord | null>(null)
  const [runHistory, setRunHistory] = useState<BacktestRunRecord[]>(() => listBacktestRunRecords())
  const [diagnostics, setDiagnostics] = useState<BacktestDiagnostic[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null)
  const [importSymbol, setImportSymbol] = useState(initialDataset?.symbols[0] ?? '')

  const datasetAnalysis = useMemo(() => analyzeDataFiles(dataFiles), [dataFiles])
  const loadedRows = datasetAnalysis.totalRows
  const activeUniverse = selectedDataset?.symbols ?? Object.keys(dataFiles)
  const activeFreshness = getFreshness(selectedDataset?.provenance.asOf)
  const missingFieldEntries = Object.entries(datasetAnalysis.missingFields)
  const datasetFingerprint = buildDatasetFingerprint(selectedDataset, dataFiles)
  const runSignature = buildRunSignature(config, strategyCode, datasetFingerprint)
  const resultIsStale = Boolean(result && lastRunSignature !== runSignature)
  const currentDiagnostics = useMemo(
    () => diagnostics.filter(diagnostic => diagnostic.severity !== 'info'),
    [diagnostics]
  )
  const reasonCounts = countReasons(result)
  const riskAssumptions = [
    `${(config.transactionCost * 100).toFixed(2)}% cost`,
    `${(config.volumeCapPct * 100).toFixed(0)}% volume cap`,
    `${config.slippageModel} slippage`,
  ].join(' / ')
  const runStatus = isRunning
    ? 'Running backtest'
    : result
      ? resultIsStale
        ? 'Needs rerun after edits'
        : `${result.trades.length} trades, ${formatPct(result.metrics.totalReturn)} total return`
      : 'Ready to run'

  useEffect(() => {
    onRunRecordChange?.(activeRunRecord, resultIsStale)
  }, [activeRunRecord, resultIsStale, onRunRecordChange])

  useEffect(() => {
    onDatasetChange?.(selectedDataset)
  }, [selectedDataset, onDatasetChange])

  const updateConfig = (updates: Partial<BacktestConfig>) => {
    setConfig(current => ({ ...current, ...updates }))
  }

  const loadDataset = (datasetId: string) => {
    const nextDataset = fixtureStrategyDataProvider.loadDataset(datasetId)
    if (!nextDataset) return
    setSelectedDataset(nextDataset)
    setDataFiles(nextDataset.data)
    setStrategyCode(nextDataset.strategyTemplate)
    setConfig(current => ({
      ...current,
      startDate: nextDataset.startDate ? new Date(nextDataset.startDate) : undefined,
      endDate: nextDataset.endDate ? new Date(nextDataset.endDate) : undefined,
    }))
    setImportSymbol(nextDataset.symbols[0] ?? '')
    onSessionChange?.({
      datasetId: nextDataset.id,
      datasetName: nextDataset.name,
      datasetFingerprint: nextDataset.fingerprint,
      backtestCode: nextDataset.strategyTemplate,
    })
    toast.success(`Loaded ${nextDataset.name}`)
  }

  useEffect(() => {
    if (!templateCategory) return
    const recommendedDataset = datasets.find(dataset =>
      dataset.compatibleTemplateCategories.includes(templateCategory)
    )
    if (!recommendedDataset) return
    setSelectedDataset(recommendedDataset)
    setDataFiles(recommendedDataset.data)
    setStrategyCode(recommendedDataset.strategyTemplate)
    setConfig(current => ({
      ...current,
      startDate: recommendedDataset.startDate ? new Date(recommendedDataset.startDate) : undefined,
      endDate: recommendedDataset.endDate ? new Date(recommendedDataset.endDate) : undefined,
    }))
    setImportSymbol(recommendedDataset.symbols[0] ?? '')
    onSessionChange?.({
      templateCategory,
      datasetId: recommendedDataset.id,
      datasetName: recommendedDataset.name,
      datasetFingerprint: recommendedDataset.fingerprint,
      backtestCode: recommendedDataset.strategyTemplate,
    })
    toast.info(`Recommended ${recommendedDataset.name} for ${templateCategory}`)
  }, [templateCategory])

  const handleStrategyCodeChange = (code: string) => {
    setStrategyCode(code)
    onSessionChange?.({ backtestCode: code })
  }

  const handleFileUpload = async (symbol: string, file: File) => {
    try {
      const normalizedSymbol = symbol.trim().toUpperCase()
      if (!normalizedSymbol) {
        toast.error('Enter a symbol before importing data')
        return
      }
      const data = await readImportedData(file)
      const nextDataFiles = { ...dataFiles, [normalizedSymbol]: data }
      const nextDataset = buildCustomDataset(selectedDataset, nextDataFiles, normalizedSymbol, file.name)
      setDataFiles(nextDataFiles)
      setSelectedDataset(nextDataset)
      setConfig(current => ({
        ...current,
        startDate: nextDataset.startDate ? new Date(nextDataset.startDate) : current.startDate,
        endDate: nextDataset.endDate ? new Date(nextDataset.endDate) : current.endDate,
      }))
      setImportSymbol(normalizedSymbol)
      onSessionChange?.({
        datasetId: nextDataset.id,
        datasetName: nextDataset.name,
        datasetFingerprint: nextDataset.fingerprint,
      })
      toast.success(`Imported ${normalizedSymbol} ${file.name.toLowerCase().endsWith('.csv') ? 'CSV' : 'JSON'} data`)
    } catch (error) {
      toast.error(error instanceof SyntaxError ? 'Import failed: invalid JSON or CSV structure' : `Failed to import ${symbol.trim() || 'symbol'} data`)
    }
  }

  const handleRun = async (options: { notify?: boolean } = {}) => {
    const { notify = true } = options
    const preRunDiagnostics = validateBacktestInputs(config, strategyCode, dataFiles)
    setDiagnostics(preRunDiagnostics)

    if (preRunDiagnostics.some(diagnostic => diagnostic.severity === 'error')) {
      setActiveTab('results')
      toast.error('Backtest blocked by validation errors')
      return
    }

    setIsRunning(true)
    try {
      const backtestResult = await onRun(config, strategyCode, dataFiles, selectedDataset)
      const runDiagnostics = [...preRunDiagnostics, ...(backtestResult.diagnostics ?? [])]
      const runRecord: BacktestRunRecord = {
        id: `backtest-${Date.now()}`,
        strategyId,
        strategyName,
        timestamp: Date.now(),
        config,
        strategyCode,
        datasetId: selectedDataset?.id,
        datasetName: selectedDataset?.name ?? 'Custom upload',
        datasetFingerprint,
        normalizedFieldMap: backtestResult.normalizedFieldMap,
        inputDiagnostics: backtestResult.inputDiagnostics,
        orderEvents: backtestResult.orderEvents,
        positionSnapshots: backtestResult.positionSnapshots,
        runSignature,
        strategyVersion,
        result: backtestResult,
        diagnostics: runDiagnostics,
        freshness: 'current',
      }

      setResult(backtestResult)
      setDiagnostics(runDiagnostics)
      setActiveRunRecord(runRecord)
      setLastRunSignature(runSignature)
      saveBacktestRunRecord(runRecord)
      setRunHistory(listBacktestRunRecords())
      setActiveTab('results')
      onSessionChange?.({
        activeRunId: runRecord.id,
        datasetId: selectedDataset?.id,
        datasetName: runRecord.datasetName,
        datasetFingerprint,
        backtestCode: strategyCode,
        lastRunSignature: runSignature,
      })
      if (notify) toast.success('Backtest complete')
    } catch (error) {
      const errorDiagnostic = createDiagnostic(
        'error',
        error instanceof Error ? error.message : 'Backtest failed with an unknown error.',
        'run-exception'
      )
      setDiagnostics([...preRunDiagnostics, errorDiagnostic])
      setActiveTab('results')
      toast.error('Backtest failed')
    } finally {
      setIsRunning(false)
    }
  }

  const handleExportRun = () => {
    if (!activeRunRecord) {
      toast.info('Run the backtest before exporting proof.')
      return
    }
    downloadJSON(
      {
        ...activeRunRecord,
        freshness: resultIsStale ? 'stale' : 'current',
        exportedAt: new Date().toISOString(),
      },
      `backtest-proof-${activeRunRecord.id}.json`
    )
    toast.success('Backtest proof exported')
  }

  useEffect(() => {
    const autoRun = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await handleRun({ notify: false })
    }
    autoRun()
  }, [])

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-2xl font-semibold tracking-tight">Research Workstation</h2>
              {selectedDataset && (
                <Badge variant="outline" className="h-6">
                  {selectedDataset.category}
                </Badge>
              )}
              {result && (
                <Badge variant={resultIsStale ? 'outline' : 'default'} className="h-6">
                  {resultIsStale ? 'Stale proof' : 'Current proof'}
                </Badge>
              )}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {selectedDataset
                ? selectedDataset.description
                : 'Custom strategy using uploaded JSON market data.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => handleRun()} disabled={isRunning} size="lg">
              <PlayCircle size={20} className="mr-2" weight="fill" />
              {isRunning ? 'Running...' : 'Run Backtest'}
            </Button>
            <Button onClick={handleExportRun} disabled={!activeRunRecord} size="lg" variant="outline">
              <Download size={18} className="mr-2" />
              Export Proof
            </Button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <div className="rounded-md border bg-background p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Universe</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {activeUniverse.length > 0 ? activeUniverse.map(symbol => (
                <Badge key={symbol} variant="secondary" className="h-6">
                  {symbol}
                </Badge>
              )) : (
                <span className="text-sm text-muted-foreground">No symbols loaded</span>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Data Window</div>
            <div className="mt-1 text-sm font-medium">
              {formatDateInput(config.startDate) || 'open'} to {formatDateInput(config.endDate) || 'open'}
            </div>
            <div className="text-xs text-muted-foreground">{loadedRows.toLocaleString()} rows / {selectedDataset?.provenance.provider ?? 'custom'} provider</div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Decision Lens</div>
            <div className="mt-1 text-sm font-medium">{selectedDataset?.useCase ?? 'Custom signal logic'}</div>
            <div className="text-xs text-muted-foreground">{riskAssumptions}</div>
          </div>

          <div className="rounded-md border bg-background p-3">
            <div className="text-xs font-medium uppercase text-muted-foreground">Proof State</div>
            <div className="mt-1 text-sm font-medium">{runStatus}</div>
            <div className="text-xs text-muted-foreground">
              {result ? `${formatCurrency(result.metrics.Final)} final value` : 'Run once to validate behavior'}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid h-11 w-full grid-cols-4">
          <TabsTrigger value="config">1 Configure</TabsTrigger>
          <TabsTrigger value="data">2 Validate Data</TabsTrigger>
          <TabsTrigger value="strategy">3 Run Proof</TabsTrigger>
          <TabsTrigger value="results">4 Explain</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution Assumptions</CardTitle>
              <CardDescription>Set the capital, date window, costs, liquidity, and slippage model that every strategy result must clear.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="start-capital">Starting Capital ($)</Label>
                <Input
                  id="start-capital"
                  type="number"
                  value={config.startCapital}
                  onChange={(e) => updateConfig({ startCapital: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="transaction-cost">Transaction Cost (decimal)</Label>
                <Input
                  id="transaction-cost"
                  type="number"
                  step="0.0001"
                  value={config.transactionCost}
                  onChange={(e) => updateConfig({ transactionCost: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={formatDateInput(config.startDate)}
                  onChange={(e) => updateConfig({ startDate: e.target.value ? new Date(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">End Date</Label>
                <Input
                  id="end-date"
                  type="date"
                  value={formatDateInput(config.endDate)}
                  onChange={(e) => updateConfig({ endDate: e.target.value ? new Date(e.target.value) : undefined })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="volume-cap">Volume Cap (%)</Label>
                <Input
                  id="volume-cap"
                  type="number"
                  step="0.01"
                  value={config.volumeCapPct}
                  onChange={(e) => updateConfig({ volumeCapPct: parseFloat(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slippage-model">Slippage Model</Label>
                <Select
                  value={config.slippageModel}
                  onValueChange={(v: 'fixed' | 'adaptive' | 'custom') => updateConfig({ slippageModel: v })}
                >
                  <SelectTrigger id="slippage-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fixed">Fixed</SelectItem>
                    <SelectItem value="adaptive">Adaptive (based on ADV)</SelectItem>
                    <SelectItem value="custom">Custom Function</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Database size={20} />
                    Dataset & Provenance Manager
                  </CardTitle>
                  <CardDescription>Audit fixture and imported market data before running strategy proof.</CardDescription>
                </div>
                <Badge variant={activeFreshness.variant} className="w-fit">
                  {activeFreshness.label} / {activeFreshness.detail}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-4">
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <PlugsConnected size={14} />
                    Source
                  </div>
                  <div className="mt-1 text-sm font-medium">{selectedDataset?.provenance.source ?? 'Custom upload'}</div>
                  <div className="text-xs text-muted-foreground">{selectedDataset?.provenance.provider ?? 'custom'} provider</div>
                  <div className="mt-2 truncate font-mono text-[11px] text-muted-foreground" title={selectedDataset?.fingerprint}>
                    {selectedDataset?.fingerprint ? `fp ${selectedDataset.fingerprint.slice(0, 40)}...` : 'no fingerprint'}
                  </div>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <CalendarBlank size={14} />
                    Date Range
                  </div>
                  <div className="mt-1 text-sm font-medium">
                    {formatShortDate(datasetAnalysis.startDate ?? selectedDataset?.startDate)} to {formatShortDate(datasetAnalysis.endDate ?? selectedDataset?.endDate)}
                  </div>
                  <div className="text-xs text-muted-foreground">as of {selectedDataset?.provenance.asOf ? formatShortDate(selectedDataset.provenance.asOf.slice(0, 10)) : 'unknown'}</div>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <Rows size={14} />
                    Row Counts
                  </div>
                  <div className="mt-1 text-sm font-medium">{loadedRows.toLocaleString()} rows</div>
                  <div className="text-xs text-muted-foreground">{Object.keys(dataFiles).length} symbols / {datasetAnalysis.fields.length} fields</div>
                </div>
                <div className="rounded-md border bg-background p-3">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
                    <CheckCircle size={14} />
                    Template Fit
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {(selectedDataset?.compatibleTemplateCategories ?? ['Custom']).map(category => (
                      <Badge key={category} variant="secondary" className="h-5 text-[10px]">
                        {category}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)]">
                <div className="rounded-lg border bg-background p-4">
                  <div className="flex items-center gap-2 font-medium">
                    <TableIcon size={16} />
                    Fixture Catalog
                  </div>
                  <div className="mt-3 space-y-2">
                    {datasets.map((dataset) => {
                      const isSelected = selectedDataset?.id === dataset.id
                      return (
                        <button
                          key={dataset.id}
                          type="button"
                          className={cn(
                            'w-full rounded-md border p-3 text-left transition-colors hover:border-accent/50',
                            isSelected && 'border-accent bg-accent/5'
                          )}
                          onClick={() => loadDataset(dataset.id)}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-sm">{dataset.name}</span>
                            {isSelected && <Badge className="h-5 text-[10px]">ACTIVE</Badge>}
                            <Badge variant="outline" className="h-5 text-[10px]">{dataset.category}</Badge>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1">
                            {dataset.symbols.map(symbol => (
                              <Badge key={symbol} variant="secondary" className="h-5 text-[10px]">
                                {symbol}
                              </Badge>
                            ))}
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-1 text-xs text-muted-foreground">
                            <span>{Object.values(dataset.rowCounts).reduce((sum, count) => sum + count, 0).toLocaleString()} rows</span>
                            <span>{dataset.fields.length} fields</span>
                            <span className="col-span-2">{dataset.startDate} to {dataset.endDate}</span>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-lg border bg-background p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center gap-2 font-medium">
                        <Rows size={16} />
                        Active Dataset Rows
                      </div>
                      <Badge variant="outline" className="w-fit">{selectedDataset?.name ?? 'Custom dataset'}</Badge>
                    </div>
                    <div className="mt-3 overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Rows</TableHead>
                            <TableHead>Fields</TableHead>
                            <TableHead>Missing Fields</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {Object.keys(dataFiles).map(symbol => (
                            <TableRow key={symbol}>
                              <TableCell className="font-semibold">{symbol}</TableCell>
                              <TableCell>{(datasetAnalysis.rowCounts[symbol] ?? 0).toLocaleString()}</TableCell>
                              <TableCell>{datasetAnalysis.symbolFields[symbol]?.length ?? 0}</TableCell>
                              <TableCell>
                                {datasetAnalysis.missingFields[symbol]?.length ? (
                                  <div className="flex flex-wrap gap-1">
                                    {datasetAnalysis.missingFields[symbol].map(field => (
                                      <Badge key={field} variant="outline" className="h-5 text-[10px]">
                                        {field}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-muted-foreground">none</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                    <div className="rounded-lg border bg-background p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <WarningCircle size={16} />
                        Missing Fields
                      </div>
                      <div className="mt-3 space-y-2 text-sm">
                        {missingFieldEntries.length === 0 ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <CheckCircle size={16} className="text-success" weight="fill" />
                            No date, close, or volume gaps detected.
                          </div>
                        ) : missingFieldEntries.map(([symbol, fields]) => (
                          <div key={symbol} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-2">
                            <span className="font-medium">{symbol}</span>
                            <span className="text-xs text-muted-foreground">{fields.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-lg border bg-background p-4">
                      <div className="flex items-center gap-2 font-medium">
                        <BracketsCurly size={16} />
                        Import CSV/JSON
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(120px,0.35fr)_minmax(0,0.65fr)]">
                        <div className="space-y-2">
                          <Label htmlFor="dataset-import-symbol">Symbol</Label>
                          <Input
                            id="dataset-import-symbol"
                            value={importSymbol}
                            onChange={(event) => setImportSymbol(event.target.value)}
                            placeholder="AAPL"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="dataset-import-file">File</Label>
                          <Input
                            id="dataset-import-file"
                            type="file"
                            accept=".json,.csv,application/json,text/csv"
                            onChange={(event) => {
                              const file = event.target.files?.[0]
                              if (file) handleFileUpload(importSymbol, file)
                              event.currentTarget.value = ''
                            }}
                          />
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1"><FileCsv size={14} /> CSV</span>
                        <span className="inline-flex items-center gap-1"><BracketsCurly size={14} /> JSON</span>
                        <span className="inline-flex items-center gap-1"><Upload size={14} /> replaces matching symbol</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <StrategyCodeHelper code={strategyCode} />
          <Card>
            <CardHeader>
              <CardTitle>Decision Logic</CardTitle>
              <CardDescription>Write the rule that turns the active dataset into buy, sell, or hold decisions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {selectedDataset && (
                <div className="grid grid-cols-1 gap-3 rounded-lg border bg-muted/30 p-3 text-sm md:grid-cols-3">
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Dataset</Label>
                    <div className="font-medium">{selectedDataset.name}</div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Signal Intent</Label>
                    <div className="font-medium">{selectedDataset.useCase}</div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase text-muted-foreground">Tradable Symbols</Label>
                    <div className="font-mono text-xs">{selectedDataset.symbols.join(', ')}</div>
                  </div>
                </div>
              )}
              <Textarea
                value={strategyCode}
                onChange={(e) => handleStrategyCodeChange(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Enter your strategy code..."
              />
              <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
                <Label className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <BookOpen size={16} className="text-accent" />
                  Strategy Return Contract
                </Label>
                <p className="text-xs text-muted-foreground">
                  Return <code>{'{ action: "buy" | "sell" | "hold", symbol, reason }'}</code>. Buy/sell signals without a symbol are reported as diagnostics.
                </p>
              </div>
            </CardContent>
          </Card>
          <CommonMistakesGuide />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {currentDiagnostics.length > 0 && (
            <Card className="border-warning/50 bg-warning/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <WarningCircle size={18} className="text-warning" weight="fill" />
                  Run Diagnostics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentDiagnostics.map(diagnostic => (
                  <div key={`${diagnostic.id}-${diagnostic.symbol ?? ''}-${diagnostic.date ?? ''}`} className="flex items-start gap-2 text-sm">
                    <Badge variant={diagnostic.severity === 'error' ? 'destructive' : 'outline'} className="mt-0.5">
                      {diagnostic.severity}
                    </Badge>
                    <div>
                      {diagnostic.message}
                      {diagnostic.symbol && <span className="text-muted-foreground"> ({diagnostic.symbol})</span>}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result ? (
            <>
              {resultIsStale && (
                <Card className="border-warning/50 bg-warning/5">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">Proof needs rerun</div>
                      <p className="text-sm text-muted-foreground">Data, logic, or execution assumptions changed after the last backtest.</p>
                    </div>
                    <Button onClick={() => handleRun()} disabled={isRunning} size="sm">
                      <PlayCircle size={16} className="mr-2" weight="fill" />
                      Rerun
                    </Button>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Result Summary</CardTitle>
                  <CardDescription>
                    {selectedDataset?.useCase ?? 'Custom strategy'} / {selectedDataset?.name ?? 'Custom data'} / {resultIsStale ? 'stale proof' : 'current proof'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                  <MetricCard title="Total Return" value={formatPct(result.metrics.totalReturn)} positive={result.metrics.totalReturn >= 0} />
                  <MetricCard title="Max Drawdown" value={formatPct(result.metrics.MaxDD)} positive={false} />
                  <MetricCard title="Trades" value={String(result.trades.length)} />
                  <MetricCard title="Final Value" value={formatCurrency(result.metrics.Final)} />
                </CardContent>
              </Card>

              <EquityCurveChart data={result.equity} startCapital={config.startCapital} />

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <MetricCard title="CAGR" value={formatPct(result.metrics.CAGR)} positive={result.metrics.CAGR >= 0} />
                <MetricCard title="Sharpe Ratio" value={Number.isFinite(result.metrics.Sharpe) ? result.metrics.Sharpe.toFixed(2) : 'n/a'} icon="equals" />
                <MetricCard title="Volatility" value={formatPct(result.metrics.Vol)} />
                <MetricCard title="Trades/Year" value={Number.isFinite(result.metrics.Trades_Yr) ? result.metrics.Trades_Yr.toFixed(1) : 'n/a'} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Explainability</CardTitle>
                  <CardDescription>
                    Signal reasons, skipped conditions, and assumptions used to produce this proof.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Signal Reasons</Label>
                    <div className="mt-2 space-y-1 text-sm">
                      {reasonCounts.length > 0 ? reasonCounts.map(([reason, count]) => (
                        <div key={reason} className="flex justify-between gap-3">
                          <span className="truncate">{reason}</span>
                          <span className="font-mono">{count}</span>
                        </div>
                      )) : (
                        <span className="text-muted-foreground">No trades were generated.</span>
                      )}
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Execution Friction</Label>
                    <p className="mt-2 text-sm font-medium">{riskAssumptions}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Date window: {formatDateInput(config.startDate) || 'open'} to {formatDateInput(config.endDate) || 'open'}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Data Warnings</Label>
                    <p className="mt-2 text-sm font-medium">
                      {diagnostics.filter(d => d.severity !== 'info').length} diagnostics
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">{selectedDataset?.provenance.notes}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TableIcon size={20} />
                    Trade History
                  </CardTitle>
                  <CardDescription>{result.trades.length} trades executed</CardDescription>
                </CardHeader>
                <CardContent>
                  {result.trades.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                      No trades were executed. Review signal reasons and diagnostics before treating this as a valid hold-only strategy.
                    </div>
                  ) : (
                    <ScrollArea className="h-[300px]">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Symbol</TableHead>
                            <TableHead>Shares</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead>Exec Price</TableHead>
                            <TableHead>Slippage</TableHead>
                            <TableHead>Reason</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {result.trades.map((trade, i) => (
                            <TableRow key={`${trade.date.toISOString()}-${trade.symbol}-${i}`}>
                              <TableCell className="font-mono text-xs">{trade.date.toLocaleDateString()}</TableCell>
                              <TableCell><Badge variant={trade.action === 'buy' ? 'default' : 'secondary'}>{trade.action}</Badge></TableCell>
                              <TableCell className="font-semibold">{trade.symbol}</TableCell>
                              <TableCell>{trade.shares.toLocaleString()}</TableCell>
                              <TableCell className="font-mono text-xs">${trade.price.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs">${trade.executionPrice.toFixed(2)}</TableCell>
                              <TableCell className="font-mono text-xs">{(trade.slippage * 100).toFixed(2)}%</TableCell>
                              <TableCell className="text-xs text-muted-foreground">{trade.reason}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex h-64 items-center justify-center">
                <div className="space-y-2 text-center">
                  <ChartLine size={48} className="mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No current proof. Configure data and run a backtest.</p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClockCounterClockwise size={18} />
                Run History
              </CardTitle>
              <CardDescription>Browser-local proof records for this workstation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {runHistory.length === 0 ? (
                <div className="text-sm text-muted-foreground">No saved run records yet.</div>
              ) : runHistory.slice(0, 5).map(record => (
                <div key={record.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                  <div>
                    <div className="font-medium">{record.datasetName}</div>
                    <div className="text-xs text-muted-foreground">{new Date(record.timestamp).toLocaleString()} / {formatPct(record.result.metrics.totalReturn)} / {record.result.trades.length} trades</div>
                  </div>
                  <Badge variant={record.id === activeRunRecord?.id ? 'default' : 'outline'}>
                    {record.id === activeRunRecord?.id ? 'active' : 'saved'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function MetricCard({
  title,
  value,
  positive,
  icon,
}: {
  title: string
  value: string
  positive?: boolean
  icon?: 'equals'
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          {icon === 'equals' ? (
            <Equals size={20} className="text-muted-foreground" />
          ) : positive == null ? (
            <FloppyDisk size={20} className="text-muted-foreground" />
          ) : positive ? (
            <TrendUp size={20} className="text-success" />
          ) : (
            <TrendDown size={20} className="text-destructive" />
          )}
          <span className="text-2xl font-semibold">{value}</span>
        </div>
      </CardContent>
    </Card>
  )
}
