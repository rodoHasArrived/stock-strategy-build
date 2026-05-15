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
  BookOpen,
  ChartLine,
  ClockCounterClockwise,
  Download,
  Equals,
  FloppyDisk,
  PlayCircle,
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
} from '@/lib/types'
import { toast } from 'sonner'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { CommonMistakesGuide, StrategyCodeHelper } from '@/components/StrategyCodeHelper'
import { cn } from '@/lib/utils'
import { fixtureStrategyDataProvider } from '@/lib/strategyDataProvider'
import { downloadJSON, listBacktestRunRecords, saveBacktestRunRecord } from '@/lib/persistence'

interface BacktestBuilderProps {
  onRun: (config: BacktestConfig, strategyCode: string, dataFiles: Record<string, any>) => Promise<BacktestResult>
  strategyId?: string
  strategyName?: string
  templateCategory?: string
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
  templateCategory,
  onRunRecordChange,
}: BacktestBuilderProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    startCapital: 1000,
    startDate: defaultDataset?.startDate ? new Date(defaultDataset.startDate) : undefined,
    endDate: defaultDataset?.endDate ? new Date(defaultDataset.endDate) : undefined,
    transactionCost: 0.003,
    volumeCapPct: 0.25,
    slippageModel: 'adaptive',
  })
  const [selectedDataset, setSelectedDataset] = useState<StrategyDataset | null>(defaultDataset ?? null)
  const [strategyCode, setStrategyCode] = useState(defaultDataset?.strategyTemplate ?? '')
  const [dataFiles, setDataFiles] = useState<Record<string, any>>(defaultDataset?.data ?? {})
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [activeRunRecord, setActiveRunRecord] = useState<BacktestRunRecord | null>(null)
  const [runHistory, setRunHistory] = useState<BacktestRunRecord[]>(() => listBacktestRunRecords())
  const [diagnostics, setDiagnostics] = useState<BacktestDiagnostic[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null)

  const loadedRows = Object.values(dataFiles).reduce((total, data) => total + getRowCount(data), 0)
  const activeUniverse = selectedDataset?.symbols ?? Object.keys(dataFiles)
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
    toast.info(`Recommended ${recommendedDataset.name} for ${templateCategory}`)
  }, [templateCategory])

  const handleFileUpload = async (symbol: string, file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setDataFiles(prev => ({ ...prev, [symbol]: data }))
      setSelectedDataset(current => current ? { ...current, category: 'custom', fingerprint: `custom-${Date.now()}` } : current)
      toast.success(`Loaded ${symbol} data`)
    } catch {
      toast.error(`Failed to load ${symbol} data`)
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
      const backtestResult = await onRun(config, strategyCode, dataFiles)
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
          <TabsTrigger value="config">1 Define</TabsTrigger>
          <TabsTrigger value="data">2 Data</TabsTrigger>
          <TabsTrigger value="strategy">3 Logic</TabsTrigger>
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
              <CardTitle>Provider-Ready Fixture Data</CardTitle>
              <CardDescription>Choose fixture-backed datasets shaped like a future AMX provider response.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {datasets.map((dataset) => {
                  const isSelected = selectedDataset?.id === dataset.id
                  return (
                    <button
                      key={dataset.id}
                      type="button"
                      className={cn(
                        'rounded-lg border p-4 text-left transition-colors hover:border-accent/50',
                        isSelected && 'border-accent bg-accent/5'
                      )}
                      onClick={() => loadDataset(dataset.id)}
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-sm">{dataset.name}</span>
                        {isSelected && <Badge className="h-5 text-[10px]">ACTIVE</Badge>}
                        <Badge variant="outline" className="h-5 text-[10px]">{dataset.category}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{dataset.description}</p>
                      <div className="mt-3 flex flex-wrap gap-1">
                        {dataset.symbols.map(symbol => (
                          <Badge key={symbol} variant="secondary" className="h-5 text-[10px]">
                            {symbol}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <div>Rows: {Object.values(dataset.rowCounts).reduce((sum, count) => sum + count, 0).toLocaleString()}</div>
                        <div>Fields: {dataset.fields.length}</div>
                        <div className="sm:col-span-2">Template fit: {dataset.compatibleTemplateCategories.join(', ')}</div>
                      </div>
                    </button>
                  )
                })}
              </div>

              {selectedDataset && (
                <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium">
                    <TableIcon size={16} />
                    Active Dataset Provenance
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
                    <div><span className="text-muted-foreground">Provider:</span> {selectedDataset.provenance.provider}</div>
                    <div><span className="text-muted-foreground">Source:</span> {selectedDataset.provenance.source}</div>
                    <div><span className="text-muted-foreground">Window:</span> {selectedDataset.startDate} to {selectedDataset.endDate}</div>
                    <div><span className="text-muted-foreground">Fingerprint:</span> <code className="text-xs">{selectedDataset.fingerprint.slice(0, 48)}...</code></div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-base">Custom Upload</Label>
                <div className="mt-3 grid grid-cols-1 gap-4">
                  {activeUniverse.map(symbol => (
                    <div key={symbol} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <Label>{symbol} Data</Label>
                        <Badge variant="secondary">{getRowCount(dataFiles[symbol]).toLocaleString()} rows</Badge>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <Input
                          type="file"
                          accept=".json"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileUpload(symbol, file)
                          }}
                        />
                        <Button variant="outline" size="sm">
                          <Upload size={16} className="mr-2" />
                          Upload
                        </Button>
                      </div>
                    </div>
                  ))}
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
                onChange={(e) => setStrategyCode(e.target.value)}
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
