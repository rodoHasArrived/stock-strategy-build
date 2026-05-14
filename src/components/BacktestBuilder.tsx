import { useState, useEffect, useCallback } from 'react'
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
  quickStartRequest?: number
  compactDefault?: boolean
  onSummary?: (summary: { finalValue: number; cagr: number; trades: number; error?: string }) => void
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

export function BacktestBuilder({ onRun, quickStartRequest = 0, compactDefault = true, onSummary }: BacktestBuilderProps) {
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
  const [showAdvanced, setShowAdvanced] = useState(!compactDefault)
  const [runError, setRunError] = useState<string | null>(null)

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

  const handleRun = useCallback(async () => {
    setIsRunning(true)
    setRunError(null)
    try {
      const backtestResult = await onRun(config, strategyCode, dataFiles)
      setResult(backtestResult)
      setActiveTab('results')
      onSummary?.({
        finalValue: backtestResult.metrics.Final,
        cagr: backtestResult.metrics.CAGR,
        trades: backtestResult.trades.length,
      })
      toast.success('Backtest complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setRunError(message)
      onSummary?.({
        finalValue: 0,
        cagr: 0,
        trades: 0,
        error: message,
      })
      toast.error(`Backtest failed: ${message}`)
    } finally {
      setIsRunning(false)
    }
  }, [onRun, config, strategyCode, dataFiles, onSummary])

  useEffect(() => {
    if (!compactDefault) return
    // Quick mode prioritizes first-value realization by auto-running once on mount.
    const autoRun = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await handleRun()
    }
    void autoRun()
  }, [compactDefault, handleRun])

  useEffect(() => {
    if (quickStartRequest <= 0) return
    const starter = sampleDatasets[0]
    setSelectedDataset(starter)
    setDataFiles(starter.data)
    setStrategyCode(starter.strategyTemplate)
    setShowAdvanced(false)
    setActiveTab('results')
    void handleRun()
  }, [quickStartRequest, handleRun])

  const errorRecovery = (() => {
    if (!runError) return null
    const lowered = runError.toLowerCase()
    if (lowered.includes('json') || lowered.includes('column') || lowered.includes('data')) {
      return { type: 'data', recommendation: 'Check dataset shape and required columns in Data Sources.', targetTab: 'data' }
    }
    if (lowered.includes('syntax') || lowered.includes('unexpected') || lowered.includes('referenceerror')) {
      return { type: 'code', recommendation: 'Fix strategy code syntax/variables in Strategy Code.', targetTab: 'strategy' }
    }
    return { type: 'config', recommendation: 'Validate numeric inputs and slippage settings in Configuration.', targetTab: 'config' }
  })()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Backtest Builder</h2>
          <p className="text-sm text-muted-foreground">Python-style strategy backtesting with pandas operations</p>
        </div>
        <Button onClick={handleRun} disabled={isRunning} size="lg">
          <PlayCircle size={20} className="mr-2" weight="fill" />
          {isRunning ? 'Running...' : 'Run Backtest'}
        </Button>
      </div>

      <Card className="border-accent/30 bg-accent/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkle size={18} className="text-accent" />
            Quick Backtest
          </CardTitle>
          <CardDescription>
            Minimal inputs for first value. Use “More settings” for full advanced controls.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Dataset</Label>
              <Select
                value={selectedDataset?.name}
                onValueChange={(value) => {
                  const dataset = sampleDatasets.find((item) => item.name === value)
                  if (!dataset) return
                  setSelectedDataset(dataset)
                  setDataFiles(dataset.data)
                  setStrategyCode(dataset.strategyTemplate)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dataset" />
                </SelectTrigger>
                <SelectContent>
                  {sampleDatasets.map((dataset) => (
                    <SelectItem key={dataset.name} value={dataset.name}>
                      {dataset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Starting Capital</Label>
              <Input
                type="number"
                value={config.startCapital}
                onChange={(e) => setConfig(c => ({ ...c, startCapital: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleRun} disabled={isRunning} className="w-full">
                <PlayCircle size={18} className="mr-2" weight="fill" />
                {isRunning ? 'Running...' : 'Quick Run'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAdvanced((current) => !current)}>
              {showAdvanced ? 'Hide settings' : 'More settings'}
            </Button>
            {result && (
              <Badge variant="secondary">
                Final ${result.metrics.Final.toFixed(2)} · CAGR {result.metrics.CAGR.toFixed(2)}%
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {errorRecovery && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="pt-4">
            <div className="text-sm font-medium text-destructive">Backtest failed ({errorRecovery.type})</div>
            <p className="text-sm text-muted-foreground mt-1">{errorRecovery.recommendation}</p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setActiveTab(errorRecovery.targetTab)}>
                Open {errorRecovery.targetTab}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRunError(null)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {showAdvanced && (
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="config">Configuration</TabsTrigger>
          <TabsTrigger value="data">Data Sources</TabsTrigger>
          <TabsTrigger value="strategy">Strategy Code</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        <TabsContent value="config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Backtest Configuration</CardTitle>
              <CardDescription>Set initial capital, costs, and slippage parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start-capital">Starting Capital ($)</Label>
                  <Input
                    id="start-capital"
                    type="number"
                    value={config.startCapital}
                    onChange={(e) => setConfig(c => ({ ...c, startCapital: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="transaction-cost">Transaction Cost (decimal)</Label>
                  <Input
                    id="transaction-cost"
                    type="number"
                    step="0.0001"
                    value={config.transactionCost}
                    onChange={(e) => setConfig(c => ({ ...c, transactionCost: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="volume-cap">Volume Cap (%)</Label>
                  <Input
                    id="volume-cap"
                    type="number"
                    step="0.01"
                    value={config.volumeCapPct}
                    onChange={(e) => setConfig(c => ({ ...c, volumeCapPct: parseFloat(e.target.value) }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slippage-model">Slippage Model</Label>
                  <Select
                    value={config.slippageModel}
                    onValueChange={(v: 'fixed' | 'adaptive' | 'custom') => setConfig(c => ({ ...c, slippageModel: v }))}
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
                          "border rounded-lg p-4 space-y-2 hover:border-accent/50 transition-colors cursor-pointer",
                          isSelected && "border-accent bg-accent/5"
                        )}
                        onClick={() => {
                          setDataFiles(dataset.data)
                          setStrategyCode(dataset.strategyTemplate)
                          setSelectedDataset(dataset)
                          toast.success(`Loaded ${dataset.name}`)
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
                        <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                          <div>Period: {dataset.period}</div>
                          <div>Use case: {dataset.useCase}</div>
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
              <CardTitle>Strategy Code</CardTitle>
              <CardDescription>Write strategy logic - your function receives (df, state) where df is a DataFrame with 1 row of market data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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

              <div className="grid grid-cols-4 gap-4">
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
                      <span className="text-2xl font-semibold">{result.metrics.CAGR.toFixed(2)}%</span>
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
                      <span className="text-2xl font-semibold">{result.metrics.MaxDD.toFixed(2)}%</span>
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
                      <span className="text-2xl font-semibold">${result.metrics.Final.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>

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
      )}
    </div>
  )
}
