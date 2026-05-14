import { useState } from 'react'
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
import { PlayCircle, TrendUp, TrendDown, Equals, Upload, ChartLine, Table as TableIcon, Download } from '@phosphor-icons/react'
import { BacktestResult, BacktestConfig } from '@/lib/types'
import { toast } from 'sonner'
import { EquityCurveChart } from '@/components/EquityCurveChart'
import paData from '@/assets/data/PCG-PA_daily_bars.json'
import pbData from '@/assets/data/PCG-PB_daily_bars.json'

interface BacktestBuilderProps {
  onRun: (config: BacktestConfig, strategyCode: string, dataFiles: Record<string, any>) => Promise<BacktestResult>
}

export function BacktestBuilder({ onRun }: BacktestBuilderProps) {
  const [config, setConfig] = useState<BacktestConfig>({
    startCapital: 1000,
    transactionCost: 0.003,
    volumeCapPct: 0.25,
    slippageModel: 'adaptive'
  })

  const [strategyCode, setStrategyCode] = useState(`// Define your strategy logic
// Available: DataFrame, readJSON, toDatetime, toNumeric
// Return { action: 'buy' | 'sell' | 'hold', symbol: string, shares?: number, reason?: string }

const LOOKBACK = 60
const MIN_LB = 20

const spreadMA = df.rolling(LOOKBACK, MIN_LB).mean('YieldSpread')
const spreadSD = df.rolling(LOOKBACK, MIN_LB).std('YieldSpread')
const Z = (row.YieldSpread - spreadMA[index]) / spreadSD[index]

if (Z < -0.25) {
  return { action: 'buy', symbol: 'PB', reason: 'Z-score below threshold' }
} else if (Z > 0.75) {
  return { action: 'sell', symbol: 'PB', reason: 'Z-score above threshold' }
}

return { action: 'hold' }
`)

  const [dataFiles, setDataFiles] = useState<Record<string, any>>({})
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

  const handleLoadSampleData = () => {
    setDataFiles({
      PA: paData,
      PB: pbData
    })
    toast.success('Sample data loaded for PA and PB')
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
              <CardDescription>Upload JSON files with daily bars for your securities</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-accent/5">
                <div>
                  <p className="font-medium">PCG Preferred Stock Sample Data</p>
                  <p className="text-sm text-muted-foreground">2023 daily bars for PCG-PA and PCG-PB</p>
                </div>
                <Button onClick={handleLoadSampleData} variant="default" size="sm">
                  <Download size={16} className="mr-2" />
                  Load Sample Data
                </Button>
              </div>

              <div className="grid grid-cols-1 gap-4">
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
