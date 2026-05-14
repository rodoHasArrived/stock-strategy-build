import { useState, useEffect } from 'react'
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
import { PlayCircle, TrendUp, TrendDown, Equals, Upload, ChartLine, Table as TableIcon, Download, Sparkle, BookOpen } from '@phosphor-icons/react'
import { BacktestResult, BacktestConfig } from '@/lib/types'
import { toast } from 'sonner'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import { StrategyCodeHelper, CommonMistakesGuide } from '@/components/StrategyCodeHelper'
import { cn } from '@/lib/utils'
import paData from '@/assets/data/PCG-PA_daily_bars.json'
import pbData from '@/assets/data/PCG-PB_daily_bars.json'
import igCorpData from '@/assets/data/ig-corp-bond.json'
import hyCorpData from '@/assets/data/hy-corp-bond.json'
import momentumData from '@/assets/data/momentum-equity.json'
import valueData from '@/assets/data/value-equity.json'
import techData from '@/assets/data/tech-sector.json'
import utilData from '@/assets/data/util-sector.json'

interface BacktestBuilderProps {
  onRun: (config: BacktestConfig, strategyCode: string, dataFiles: Record<string, any>) => Promise<BacktestResult>
}

interface SampleDataset {
  name: string
  description: string
  securities: string[]
  period: string
  dataType: string
  useCase: string
  coupons?: Record<string, number>
  data: Record<string, any>
  strategyTemplate: string
  category: 'fixed-income' | 'equity' | 'sector' | 'factor'
}

const sampleDatasets: SampleDataset[] = [
  {
    name: 'PCG Preferreds (PA/PB)',
    description: 'Pacific Gas & Electric preferred stocks with quarterly dividends - ideal for yield spread strategies',
    securities: ['PA', 'PB'],
    period: '2023 full year',
    dataType: 'Daily bars with volume',
    useCase: 'Mean reversion, yield spread trading',
    category: 'fixed-income',
    coupons: { PA: 1.50, PB: 1.375 },
    data: { PA: paData, PB: pbData },
    strategyTemplate: `// Z-score Mean Reversion Strategy
// Switches between PA and PB based on yield spread Z-score

// IMPORTANT: df contains only 1 row (current date's data)
// Access market data via df.data[0]
const marketData = df.data[0]

// Strategy parameters
const LOOKBACK = 60
const MIN_LB = 20
const Z_ENTER_PB = 0.25
const Z_RETURN_PA = 0.75

// Calculate yield spread (would normally pre-calculate in data prep)
const paYield = marketData.PA_Yield
const pbYield = marketData.PB_Yield
const yieldSpread = paYield - pbYield

// For demo purposes, using simple threshold logic
// In production, pre-calculate Z-scores in your data pipeline
const holding = state.positions?.PA > 0 ? 'PA' : state.positions?.PB > 0 ? 'PB' : null

// Simple spread-based rotation (replace with actual Z-score when available)
if (holding === null || holding === 'PA') {
  if (yieldSpread < -0.2) {
    return { action: 'buy', symbol: 'PB', reason: \`Spread (\${yieldSpread.toFixed(3)}) favors PB\` }
  }
} else if (holding === 'PB') {
  if (yieldSpread > 0.2) {
    return { action: 'buy', symbol: 'PA', reason: \`Spread (\${yieldSpread.toFixed(3)}) favors PA\` }
  }
}

return { action: 'hold', reason: \`Spread (\${yieldSpread.toFixed(3)}) neutral\` }`
  },
  {
    name: 'Corporate Bond Spread',
    description: 'Investment grade vs high yield corporate bonds - test credit spread strategies and flight to quality',
    securities: ['IG_CORP', 'HY_CORP'],
    period: '2022-2023',
    dataType: 'Daily prices + fundamentals',
    useCase: 'Credit spread analysis, duration management',
    category: 'fixed-income',
    coupons: { IG_CORP: 4.25, HY_CORP: 6.75 },
    data: { IG_CORP: igCorpData, HY_CORP: hyCorpData },
    strategyTemplate: `// Credit Spread Strategy
// Switch between IG and HY bonds based on spread levels

// Access current market data
const marketData = df.data[0]

// Strategy parameters  
const SPREAD_THRESHOLD = 2.5  // percentage points

// Calculate yield spread
const igYield = marketData.IG_CORP_Yield || 0
const hyYield = marketData.HY_CORP_Yield || 0
const spread = hyYield - igYield

// Determine current holding
const holding = state.positions?.IG_CORP > 0 ? 'IG_CORP' : 
                state.positions?.HY_CORP > 0 ? 'HY_CORP' : null

// Risk-off when spread widening, risk-on when spread tightening
if (spread > SPREAD_THRESHOLD && holding !== 'IG_CORP') {
  return { action: 'buy', symbol: 'IG_CORP', reason: \`Spread (\${spread.toFixed(2)}%) above threshold, flight to quality\` }
} else if (spread < 1.5 && holding !== 'HY_CORP') {
  return { action: 'buy', symbol: 'HY_CORP', reason: \`Spread (\${spread.toFixed(2)}%) compressed, risk-on\` }
}

return { action: 'hold', reason: \`Spread (\${spread.toFixed(2)}%) in neutral zone\` }`
  },
  {
    name: 'Momentum vs Value Factor',
    description: 'Large cap momentum stocks vs value stocks - test factor rotation and style timing strategies',
    securities: ['MOMENTUM', 'VALUE'],
    period: '2023',
    dataType: 'Daily OHLCV',
    useCase: 'Momentum strategies, factor rotation',
    category: 'factor',
    data: { MOMENTUM: momentumData, VALUE: valueData },
    strategyTemplate: `// Factor Rotation Strategy
// Rotate between momentum and value based on relative performance

// Access current market data
const marketData = df.data[0]

// Strategy parameters
const ROTATION_THRESHOLD = 0.05  // 5% difference to trigger rotation

// Get current prices
const momClose = marketData.MOMENTUM_Close || 0
const valClose = marketData.VALUE_Close || 0

// Determine current holding
const holding = state.positions?.MOMENTUM > 0 ? 'MOMENTUM' : 
                state.positions?.VALUE > 0 ? 'VALUE' : null

// Simple price comparison for rotation
// In production, pre-calculate normalized returns in your data pipeline
const priceRatio = momClose / valClose

// Rotate based on relative strength
if (priceRatio > 1.05 && holding !== 'MOMENTUM') {
  return { action: 'buy', symbol: 'MOMENTUM', reason: \`Momentum stronger (ratio: \${priceRatio.toFixed(2)})\` }
} else if (priceRatio < 0.95 && holding !== 'VALUE') {
  return { action: 'buy', symbol: 'VALUE', reason: \`Value stronger (ratio: \${priceRatio.toFixed(2)})\` }
}

return { action: 'hold', reason: \`Price ratio \${priceRatio.toFixed(2)} in neutral zone\` }`
  },
  {
    name: 'Sector Rotation (Tech/Utilities)',
    description: 'Technology and utilities sector ETFs - test defensive vs growth allocation based on market regime',
    securities: ['TECH', 'UTIL'],
    period: '2023',
    dataType: 'Daily prices',
    useCase: 'Sector rotation, defensive vs growth allocation',
    category: 'sector',
    data: { TECH: techData, UTIL: utilData },
    strategyTemplate: `// Sector Rotation Strategy
// Rotate between growth (Tech) and defensive (Utilities) sectors

// Access current market data
const marketData = df.data[0]

// Get current prices
const techClose = marketData.TECH_Close || 0
const utilClose = marketData.UTIL_Close || 0

// Determine current holding
const holding = state.positions?.TECH > 0 ? 'TECH' : 
                state.positions?.UTIL > 0 ? 'UTIL' : null

// Simple relative strength rotation
// In production, calculate volatility regime and momentum in data pipeline
const techUtilRatio = techClose / utilClose

// Rotate based on relative performance
if (techUtilRatio > 2.0 && holding !== 'TECH') {
  return { action: 'buy', symbol: 'TECH', reason: \`Tech outperforming (ratio: \${techUtilRatio.toFixed(2)})\` }
} else if (techUtilRatio < 1.5 && holding !== 'UTIL') {
  return { action: 'buy', symbol: 'UTIL', reason: \`Utilities defensive (ratio: \${techUtilRatio.toFixed(2)})\` }
}

return { action: 'hold', reason: \`Tech/Util ratio \${techUtilRatio.toFixed(2)} neutral\` }`
  }
]

const getRowCount = (data: unknown) => {
  if (Array.isArray(data)) return data.length
  if (data && typeof data === 'object' && Array.isArray((data as { data?: unknown[] }).data)) {
    return (data as { data: unknown[] }).data.length
  }
  return 0
}

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

const formatPct = (value: number) => `${value.toFixed(2)}%`

export function BacktestBuilder({ onRun }: BacktestBuilderProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    startCapital: 1000,
    transactionCost: 0.003,
    volumeCapPct: 0.25,
    slippageModel: 'adaptive'
  })

  const [strategyCode, setStrategyCode] = useState(sampleDatasets[0].strategyTemplate)

  const [dataFiles, setDataFiles] = useState<Record<string, any>>(sampleDatasets[0].data)
  const [selectedDataset, setSelectedDataset] = useState<SampleDataset | null>(sampleDatasets[0])
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [activeTab, setActiveTab] = useState('config')
  const [lastRunSignature, setLastRunSignature] = useState<string | null>(null)

  const activeUniverse = selectedDataset?.securities ?? Object.keys(dataFiles)
  const loadedRows = Object.values(dataFiles).reduce((total, data) => total + getRowCount(data), 0)
  const runSignature = JSON.stringify({
    config,
    strategyCode,
    symbols: Object.keys(dataFiles).sort(),
    rows: Object.entries(dataFiles)
      .map(([symbol, data]) => [symbol, getRowCount(data)] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  })
  const resultIsStale = Boolean(result && lastRunSignature !== runSignature)
  const runStatus = isRunning
    ? 'Running backtest'
    : result
      ? resultIsStale
        ? 'Needs rerun after edits'
        : `${result.trades.length} trades, ${formatPct(result.metrics.totalReturn)} total return`
      : 'Ready to run'
  const riskAssumptions = [
    `${(config.transactionCost * 100).toFixed(2)}% cost`,
    `${(config.volumeCapPct * 100).toFixed(0)}% volume cap`,
    `${config.slippageModel} slippage`,
  ].join(' / ')

  const handleFileUpload = async (symbol: string, file: File) => {
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      setDataFiles(prev => ({ ...prev, [symbol]: data }))
      toast.success(`Loaded ${symbol} data`)
    } catch (error) {
      toast.error(`Failed to load ${symbol} data`)
    }
  }

  const updateConfig = (updates: Partial<BacktestConfig>) => {
    setConfig(c => ({ ...c, ...updates }))
  }

  const loadDataset = (dataset: SampleDataset) => {
    setDataFiles(dataset.data)
    setStrategyCode(dataset.strategyTemplate)
    setSelectedDataset(dataset)
    toast.success(`Loaded ${dataset.name}`)
  }

  const handleRun = async (options: { notify?: boolean } = {}) => {
    const { notify = true } = options
    setIsRunning(true)
    try {
      const backtestResult = await onRun(config, strategyCode, dataFiles)
      setResult(backtestResult)
      setLastRunSignature(runSignature)
      setActiveTab('results')
      if (notify) {
        toast.success('Backtest complete')
      }
    } catch (error) {
      toast.error(`Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
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
              <h2 className="text-2xl font-semibold tracking-tight">Strategy Cockpit</h2>
              {selectedDataset && (
                <Badge variant="outline" className="h-6">
                  {selectedDataset.category}
                </Badge>
              )}
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              {selectedDataset
                ? selectedDataset.description
                : 'Custom strategy using uploaded JSON market data.'}
            </p>
          </div>
          <Button onClick={() => handleRun()} disabled={isRunning} size="lg" className="self-start">
            <PlayCircle size={20} className="mr-2" weight="fill" />
            {isRunning ? 'Running...' : 'Run Backtest'}
          </Button>
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
              {selectedDataset?.period ?? 'Custom upload'}
            </div>
            <div className="text-xs text-muted-foreground">{loadedRows.toLocaleString()} loaded rows</div>
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
          <TabsTrigger value="config">1 Setup</TabsTrigger>
          <TabsTrigger value="data">2 Data</TabsTrigger>
          <TabsTrigger value="strategy">3 Logic</TabsTrigger>
          <TabsTrigger value="results">4 Proof</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Execution Assumptions</CardTitle>
              <CardDescription>Set the capital, cost, liquidity, and slippage model that every strategy result must clear.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="start-capital">Starting Capital ($)</Label>
                  <Input
                    id="start-capital"
                    type="number"
                    value={config.startCapital}
                    onChange={(e) => updateConfig({ startCapital: parseFloat(e.target.value) })}
                  />
                  <p className="text-xs text-muted-foreground">Baseline portfolio value used for all reported returns.</p>
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
                  <p className="text-xs text-muted-foreground">Applied on each trade before performance metrics are calculated.</p>
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
                  <p className="text-xs text-muted-foreground">Maximum participation rate allowed against daily volume.</p>
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
                  <p className="text-xs text-muted-foreground">Controls how execution price differs from observed close.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Data Sources</CardTitle>
              <CardDescription>Choose from sample datasets or upload your own JSON files</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <Label className="text-base flex items-center gap-2">
                  <Sparkle size={18} weight="fill" className="text-accent" />
                  Example Datasets
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sampleDatasets.map((dataset, idx) => {
                    const isSelected = selectedDataset?.name === dataset.name
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "border rounded-lg p-4 space-y-3 hover:border-accent/50 transition-colors cursor-pointer",
                          isSelected && "border-accent bg-accent/5"
                        )}
                        role="button"
                        tabIndex={0}
                        onClick={() => loadDataset(dataset)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' && event.key !== ' ') return
                          event.preventDefault()
                          loadDataset(dataset)
                        }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm">{dataset.name}</p>
                              {isSelected && (
                                <Badge variant="default" className="text-[9px] h-4 px-1">
                                  ACTIVE
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-[9px] h-4 px-1">
                                {dataset.category}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{dataset.description}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dataset.securities.map(sec => (
                            <Badge key={sec} variant="secondary" className="text-[10px] h-5">
                              {sec}
                            </Badge>
                          ))}
                        </div>
                        <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                          <div>Period: {dataset.period}</div>
                          <div>Rows: {Object.values(dataset.data).reduce((total, data) => total + getRowCount(data), 0).toLocaleString()}</div>
                          <div className="sm:col-span-2">Strategy fit: {dataset.useCase}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {selectedDataset && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-2 flex items-center gap-2">
                    <TableIcon size={16} />
                    Active Dataset Summary
                  </Label>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      <div className="text-muted-foreground">Name:</div>
                      <div className="font-medium">{selectedDataset.name}</div>
                      
                      <div className="text-muted-foreground">Category:</div>
                      <div>
                        <Badge variant="outline" className="text-[10px] h-5">
                          {selectedDataset.category}
                        </Badge>
                      </div>
                      
                      <div className="text-muted-foreground">Securities:</div>
                      <div className="font-mono text-xs">{selectedDataset.securities.join(', ')}</div>
                      
                      <div className="text-muted-foreground">Period:</div>
                      <div>{selectedDataset.period}</div>
                      
                      {selectedDataset.coupons && (
                        <>
                          <div className="text-muted-foreground">Coupons:</div>
                          <div className="font-mono text-xs">
                            {Object.entries(selectedDataset.coupons).map(([sec, rate]) => 
                              `${sec}: $${rate}`
                            ).join(', ')}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <Label className="text-base">Custom Upload</Label>
                <div className="grid grid-cols-1 gap-4 mt-3">
                  {['PA', 'PB'].map(symbol => (
                    <div key={symbol} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>{symbol} Data</Label>
                        {dataFiles[symbol] && (
                          <Badge variant="secondary">
                            {Array.isArray(dataFiles[symbol]) ? dataFiles[symbol].length : 
                             dataFiles[symbol].data?.length || 0} rows
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-2">
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

              <div className="border-t pt-4">
                <Label className="text-sm text-muted-foreground">Expected JSON Format:</Label>
                <pre className="mt-2 p-4 bg-muted rounded text-xs overflow-x-auto">
{`[
  {
    "SessionDate": "2024-01-01",
    "Close": 25.50,
    "Volume": 150000
  },
  ...
]`}
                </pre>
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
                    <div className="font-mono text-xs">{selectedDataset.securities.join(', ')}</div>
                  </div>
                </div>
              )}
              <Textarea
                value={strategyCode}
                onChange={(e) => setStrategyCode(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
                placeholder="Enter your strategy code..."
              />
              <div className="border-t pt-4 space-y-3">
                <div>
                  <Label className="text-sm font-medium">Available to Your Strategy:</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 bg-muted rounded">
                      <code className="text-accent">df</code> - DataFrame with 1 row (current date's data)
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <code className="text-accent">state</code> - {`{ cash, positions, date }`}
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <code className="text-accent">marketData</code> - Access via df.data[0] or use variables
                    </div>
                    <div className="p-2 bg-muted rounded">
                      <code className="text-accent">index</code> - Current position in data (use carefully)
                    </div>
                  </div>
                </div>
                
                <div className="bg-accent/10 border border-accent/30 rounded-lg p-3">
                  <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                    <BookOpen size={16} className="text-accent" />
                    Quick Reference - Accessing Data Safely
                  </Label>
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Badge variant="destructive" className="text-[10px] mb-1">❌ Don't</Badge>
                        <pre className="bg-background/70 p-2 rounded font-mono">row.PA_Close</pre>
                      </div>
                      <div>
                        <Badge variant="default" className="text-[10px] mb-1">✓ Do</Badge>
                        <pre className="bg-background/70 p-2 rounded font-mono">{`const data = df.data[0]
const price = data.PA_Close`}</pre>
                      </div>
                    </div>
                    <p className="text-muted-foreground italic">The backtest engine passes each date's market data in df.data[0]. Always extract it first or use column access methods.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <CommonMistakesGuide />
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {result ? (
            <>
              <Card className="bg-accent/5 border-accent/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ChartLine size={24} className="text-accent" weight="duotone" />
                    Equity Curve Visualization
                  </CardTitle>
                  <CardDescription>Interactive chart showing portfolio value evolution over the backtest period</CardDescription>
                </CardHeader>
              </Card>
              
              <EquityCurveChart data={result.equity} startCapital={config.startCapital} />

              {resultIsStale && (
                <Card className="border-warning/50 bg-warning/5">
                  <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">Proof needs rerun</div>
                      <p className="text-sm text-muted-foreground">
                        Data, logic, or execution assumptions changed after the last backtest.
                      </p>
                    </div>
                    <Button onClick={() => handleRun()} disabled={isRunning} size="sm">
                      <PlayCircle size={16} className="mr-2" weight="fill" />
                      Rerun
                    </Button>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 2xl:grid-cols-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">CAGR</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      {result.metrics.CAGR >= 0 ? (
                        <TrendUp size={20} className="text-accent" />
                      ) : (
                        <TrendDown size={20} className="text-destructive" />
                      )}
                      <span className="text-2xl font-semibold">{formatPct(result.metrics.CAGR)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Sharpe Ratio</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <Equals size={20} className="text-muted-foreground" />
                      <span className="text-2xl font-semibold">{result.metrics.Sharpe.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Max Drawdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <TrendDown size={20} className="text-destructive" />
                      <span className="text-2xl font-semibold">{formatPct(result.metrics.MaxDD)}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium">Final Value</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <ChartLine size={20} className="text-accent" />
                      <span className="text-2xl font-semibold">{formatCurrency(result.metrics.Final)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Strategy Readout</CardTitle>
                  <CardDescription>
                    Interpret the run against the selected thesis and execution assumptions.
                    {resultIsStale ? ' Current values reflect the previous run.' : ''}
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 text-sm md:grid-cols-3">
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Thesis Tested</Label>
                    <p className="mt-1 font-medium">{selectedDataset?.useCase ?? 'Custom strategy logic'}</p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Return Path</Label>
                    <p className="mt-1 font-medium">
                      {formatPct(result.metrics.totalReturn)} total return over {result.metrics.Years.toFixed(2)} years
                    </p>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-3">
                    <Label className="text-xs uppercase text-muted-foreground">Execution Friction</Label>
                    <p className="mt-1 font-medium">{riskAssumptions}</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>All Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <Label className="text-muted-foreground">Sortino Ratio</Label>
                      <div className="text-xl font-semibold">{result.metrics.Sortino.toFixed(2)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Calmar Ratio</Label>
                      <div className="text-xl font-semibold">{result.metrics.Calmar.toFixed(2)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Volatility</Label>
                      <div className="text-xl font-semibold">{result.metrics.Vol.toFixed(2)}%</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Trades/Year</Label>
                      <div className="text-xl font-semibold">{result.metrics.Trades_Yr.toFixed(1)}</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Total Return</Label>
                      <div className="text-xl font-semibold">{result.metrics.totalReturn.toFixed(2)}%</div>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Years</Label>
                      <div className="text-xl font-semibold">{result.metrics.Years.toFixed(2)}</div>
                    </div>
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
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">
                              {trade.date.toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant={trade.action === 'buy' ? 'default' : 'secondary'}>
                                {trade.action}
                              </Badge>
                            </TableCell>
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
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center space-y-2">
                  <ChartLine size={48} className="mx-auto text-muted-foreground" />
                  <p className="text-muted-foreground">No results yet. Configure and run a backtest.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
