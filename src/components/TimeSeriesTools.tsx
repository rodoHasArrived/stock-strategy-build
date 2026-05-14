import { useState } from 'react'
import { TimeSeriesConfig, TimeWindow, RollingCalculation } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ClockCounterClockwise, TrendUp, ChartLine } from '@phosphor-icons/react'

interface TimeSeriesToolsProps {
  onGenerateCode: (config: TimeSeriesConfig) => void
}

const timeWindows: { value: TimeWindow; label: string; days?: number }[] = [
  { value: '1M', label: '1 Month', days: 30 },
  { value: '3M', label: '3 Months', days: 90 },
  { value: '6M', label: '6 Months', days: 180 },
  { value: '1Y', label: '1 Year', days: 365 },
  { value: 'custom', label: 'Custom' }
]

const rollingCalculations: { value: RollingCalculation; label: string; description: string; formula: string }[] = [
  {
    value: 'rolling_average',
    label: 'Rolling Average',
    description: 'Average value over time window',
    formula: 'rolling_avg(field, window)'
  },
  {
    value: 'rolling_volatility',
    label: 'Rolling Volatility',
    description: 'Standard deviation over time window',
    formula: 'rolling_std(field, window)'
  },
  {
    value: 'rolling_yield',
    label: 'Rolling Yield',
    description: 'Average yield over time window',
    formula: 'rolling_avg(yield, window)'
  },
  {
    value: 'rolling_spread',
    label: 'Rolling Spread',
    description: 'Average spread over time window',
    formula: 'rolling_avg(spread, window)'
  },
  {
    value: 'rolling_return',
    label: 'Rolling Return',
    description: 'Total return over time window',
    formula: '(current_price / price_at_start) - 1'
  },
  {
    value: 'price_momentum',
    label: 'Price Momentum',
    description: 'Price change relative to historical price',
    formula: '(current_price / historical_price) - 1'
  },
  {
    value: 'spread_change',
    label: 'Spread Change',
    description: 'Change in spread over time window',
    formula: 'current_spread - historical_spread'
  }
]

const commonFields = [
  { value: 'price', label: 'Price' },
  { value: 'yield', label: 'Yield' },
  { value: 'spread', label: 'Spread' },
  { value: 'duration', label: 'Duration' },
  { value: 'volume', label: 'Volume' },
  { value: 'return', label: 'Return' }
]

export function TimeSeriesTools({ onGenerateCode }: TimeSeriesToolsProps) {
  const [config, setConfig] = useState<TimeSeriesConfig>({
    window: '3M',
    calculation: 'price_momentum',
    field: 'price'
  })

  const handleGenerate = () => {
    onGenerateCode(config)
  }

  const selectedWindow = timeWindows.find(w => w.value === config.window)
  const selectedCalc = rollingCalculations.find(c => c.value === config.calculation)
  const actualDays = config.window === 'custom' ? config.customDays : selectedWindow?.days

  const generateCodePreview = () => {
    const calc = selectedCalc
    if (!calc) return ''

    const days = actualDays || 90
    
    if (calc.value === 'price_momentum') {
      return `price_momentum_${config.window.toLowerCase()} = current_price / price_${days}_days_ago - 1`
    }
    
    if (calc.value === 'spread_change') {
      return `spread_change_${config.window.toLowerCase()} = current_spread - spread_${days}_days_ago`
    }

    if (calc.value === 'rolling_return') {
      return `rolling_return_${config.window.toLowerCase()} = (current_price / price_${days}_days_ago) - 1`
    }

    return `${config.calculation}(${config.field}, ${days})`
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ClockCounterClockwise size={20} className="text-accent" />
          Time-Series Analysis
        </CardTitle>
        <CardDescription>
          Configure historical windows and rolling calculations
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="lookback-window" className="text-sm font-medium">Lookback Window</Label>
            <Select
              value={config.window}
              onValueChange={(value) => setConfig({ ...config, window: value as TimeWindow })}
            >
              <SelectTrigger id="lookback-window">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {timeWindows.map(window => (
                  <SelectItem key={window.value} value={window.value}>
                    {window.label}
                    {window.days && <span className="ml-2 text-muted-foreground">({window.days} days)</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {config.window === 'custom' && (
            <div className="space-y-2">
              <Label htmlFor="custom-days" className="text-sm">Custom Days</Label>
              <Input
                id="custom-days"
                type="number"
                value={config.customDays || 90}
                onChange={(e) => setConfig({ ...config, customDays: parseInt(e.target.value) || 90 })}
                placeholder="Enter number of days"
                min="1"
                step="1"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="calculation" className="text-sm font-medium">Rolling Calculation</Label>
            <Select
              value={config.calculation}
              onValueChange={(value) => setConfig({ ...config, calculation: value as RollingCalculation })}
            >
              <SelectTrigger id="calculation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {rollingCalculations.map(calc => (
                  <SelectItem key={calc.value} value={calc.value}>
                    {calc.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedCalc && (
              <p className="text-xs text-muted-foreground mt-1">{selectedCalc.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="field" className="text-sm font-medium">Data Field</Label>
            <Select
              value={config.field}
              onValueChange={(value) => setConfig({ ...config, field: value })}
            >
              <SelectTrigger id="field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {commonFields.map(field => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        <div className="p-4 rounded-lg bg-muted/50 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium">Code Preview</h4>
            <Badge variant="secondary" className="font-mono text-xs">
              {actualDays || 90} days
            </Badge>
          </div>
          <div className="p-3 rounded bg-background border font-mono text-sm">
            {generateCodePreview()}
          </div>
          {selectedCalc && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Formula:</span> {selectedCalc.formula}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 rounded-lg bg-accent/5 border border-accent/20">
          <div className="flex items-start gap-2">
            <TrendUp size={16} className="text-accent mt-0.5" />
            <div>
              <div className="text-xs font-medium">Example: Price Momentum</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Current price / price 3 months ago - 1
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <ChartLine size={16} className="text-accent mt-0.5" />
            <div>
              <div className="text-xs font-medium">Example: Spread Change</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Current spread - spread 3 months ago
              </div>
            </div>
          </div>
        </div>

        <Button onClick={handleGenerate} className="w-full">
          Generate Time-Series Code
        </Button>
      </CardContent>
    </Card>
  )
}
