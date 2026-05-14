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
import { PlayCircle, TrendUp, TrendDown, Equals, Upload, ChartLine, Table as TableIcon, Download, Sparkle } from '@phosphor-icons/react'
import { BacktestResult, BacktestConfig } from '@/lib/types'
import { toast } from 'sonner'
import { EquityCurveChart } from '@/components/EquityCurveChart'
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

const LOOKBACK = 60
const MIN_LB = 20
const Z_ENTER_PB = 0.25
const Z_RETURN_PA = 0.75

// Calculate rolling mean and std dev of yield spread
const spreadMA = df.rolling(LOOKBACK, MIN_LB).mean('YieldSpread')
const spreadSD = df.rolling(LOOKBACK, MIN_LB).std('YieldSpread')
const Z = (row.YieldSpread - spreadMA[index]) / spreadSD[index]

// Determine target holding based on Z-score
if (state.holding === null || state.holding === 'PA') {
  if (Z < -Z_ENTER_PB) {
    return { action: 'buy', symbol: 'PB', reason: \`Z-score (\${Z.toFixed(2)}) < -\${Z_ENTER_PB}, switch to PB\` }
  }
} else if (state.holding === 'PB') {
  if (Z > Z_RETURN_PA) {
    return { action: 'buy', symbol: 'PA', reason: \`Z-score (\${Z.toFixed(2)}) > \${Z_RETURN_PA}, switch to PA\` }
  }
}

return { action: 'hold', reason: \`Z-score (\${Z.toFixed(2)}) within range\` }`
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

const SPREAD_THRESHOLD = 2.5  // percentage points
const VOLATILITY_LOOKBACK = 20

// Calculate yield spread
const igYield = row.IG_CORP_Yield
const hyYield = row.HY_CORP_Yield
const spread = hyYield - igYield

// Calculate spread volatility
const spreadVol = df.rolling(VOLATILITY_LOOKBACK, 10).std('Spread')

// Risk-off when spread widening, risk-on when spread tightening
if (spread > SPREAD_THRESHOLD && spreadVol[index] > 0.5) {
  return { action: 'buy', symbol: 'IG_CORP', reason: \`Spread (\${spread.toFixed(2)}%) above threshold, flight to quality\` }
} else if (spread < 1.5 && spreadVol[index] < 0.3) {
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

const LOOKBACK_SHORT = 20
const LOOKBACK_LONG = 60
const ROTATION_THRESHOLD = 0.02  // 2% outperformance

// Calculate short-term and long-term relative performance
const momReturn20 = (row.MOMENTUM_Close - df.getColumn('MOMENTUM_Close')[index - LOOKBACK_SHORT]) / df.getColumn('MOMENTUM_Close')[index - LOOKBACK_SHORT]
const valReturn20 = (row.VALUE_Close - df.getColumn('VALUE_Close')[index - LOOKBACK_SHORT]) / df.getColumn('VALUE_Close')[index - LOOKBACK_SHORT]
const relPerf = momReturn20 - valReturn20

// Calculate trend strength
const momMA = df.rolling(LOOKBACK_LONG, 20).mean('MOMENTUM_Close')
const valMA = df.rolling(LOOKBACK_LONG, 20).mean('VALUE_Close')
const momTrend = (row.MOMENTUM_Close - momMA[index]) / momMA[index]
const valTrend = (row.VALUE_Close - valMA[index]) / valMA[index]

// Rotate to stronger factor
if (relPerf > ROTATION_THRESHOLD && momTrend > 0) {
  return { action: 'buy', symbol: 'MOMENTUM', reason: \`Momentum outperforming by \${(relPerf*100).toFixed(2)}%\` }
} else if (relPerf < -ROTATION_THRESHOLD && valTrend > 0) {
  return { action: 'buy', symbol: 'VALUE', reason: \`Value outperforming by \${(Math.abs(relPerf)*100).toFixed(2)}%\` }
}

return { action: 'hold', reason: 'No clear factor advantage' }`
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

const VOLATILITY_LOOKBACK = 30
const HIGH_VOL_THRESHOLD = 0.015  // 1.5% daily vol
const MOMENTUM_LOOKBACK = 60

// Calculate market volatility (using TECH as proxy)
const techReturns = df.getColumn('TECH_Close').map((p, i, arr) => i > 0 ? (p - arr[i-1]) / arr[i-1] : 0)
const volatility = techReturns.slice(-VOLATILITY_LOOKBACK).reduce((sum, r) => sum + r*r, 0) / VOLATILITY_LOOKBACK
const dailyVol = Math.sqrt(volatility)

// Calculate relative momentum
const techMom = (row.TECH_Close - df.getColumn('TECH_Close')[index - MOMENTUM_LOOKBACK]) / df.getColumn('TECH_Close')[index - MOMENTUM_LOOKBACK]
const utilMom = (row.UTIL_Close - df.getColumn('UTIL_Close')[index - MOMENTUM_LOOKBACK]) / df.getColumn('UTIL_Close')[index - MOMENTUM_LOOKBACK]

// High volatility = defensive, low volatility = growth
if (dailyVol > HIGH_VOL_THRESHOLD) {
  return { action: 'buy', symbol: 'UTIL', reason: \`High volatility (\${(dailyVol*100).toFixed(2)}%), defensive posture\` }
} else if (dailyVol < 0.008 && techMom > utilMom) {
  return { action: 'buy', symbol: 'TECH', reason: \`Low volatility (\${(dailyVol*100).toFixed(2)}%), growth posture\` }
}

return { action: 'hold', reason: \`Volatility (\${(dailyVol*100).toFixed(2)}%) in neutral range\` }`
  }
]

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

  const handleRun = async () => {
    setIsRunning(true)
    try {
      const backtestResult = await onRun(config, strategyCode, dataFiles)
      setResult(backtestResult)
      setActiveTab('results')
      toast.success('Backtest complete')
    } catch (error) {
      toast.error(`Backtest failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsRunning(false)
    }
  }

  useEffect(() => {
    const autoRun = async () => {
      await new Promise(resolve => setTimeout(resolve, 500))
      await handleRun()
    }
    autoRun()
  }, [])

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
          <Card>
            <CardHeader>
              <CardTitle>Strategy Code</CardTitle>
              <CardDescription>Write Python-style strategy logic using DataFrame operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={strategyCode}
                onChange={(e) => setStrategyCode(e.target.value)}
                className="font-mono text-sm min-h-[400px]"
                placeholder="Enter your strategy code..."
              />
              <div className="border-t pt-4">
                <Label className="text-sm font-medium">Available APIs:</Label>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted rounded">
                    <code className="text-accent">DataFrame</code> - pandas-like data structure
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <code className="text-accent">readJSON(data)</code> - load JSON to DataFrame
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <code className="text-accent">df.rolling(window, minPeriods)</code> - rolling window
                  </div>
                  <div className="p-2 bg-muted rounded">
                    <code className="text-accent">df.merge(other, on, how)</code> - join DataFrames
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
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
    </div>
  )
}
