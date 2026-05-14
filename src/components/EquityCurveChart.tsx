import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts'
import { TrendUp, TrendDown } from '@phosphor-icons/react'

interface EquityCurveChartProps {
  data: Array<{ date: Date; value: number; holding?: string; [key: string]: any }>
  startCapital: number
}

export function EquityCurveChart({ data, startCapital }: EquityCurveChartProps) {
  const chartData = data.map(point => ({
    date: point.date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    fullDate: point.date.toLocaleDateString(),
    value: point.value,
    holding: point.holding || 'Cash',
    returns: ((point.value - startCapital) / startCapital) * 100,
    drawdown: calculateDrawdown(data, point.date)
  }))

  function calculateDrawdown(equityData: typeof data, currentDate: Date): number {
    const pointsUpToCurrent = equityData.filter(p => p.date <= currentDate)
    if (pointsUpToCurrent.length === 0) return 0
    
    const peak = Math.max(...pointsUpToCurrent.map(p => p.value))
    const current = pointsUpToCurrent[pointsUpToCurrent.length - 1].value
    return ((current - peak) / peak) * 100
  }

  const finalValue = data[data.length - 1]?.value || startCapital
  const totalReturn = ((finalValue - startCapital) / startCapital) * 100
  const isPositive = totalReturn >= 0

  const maxDrawdown = Math.min(...chartData.map(d => d.drawdown))

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border p-3 rounded-lg shadow-lg">
          <p className="text-sm font-medium mb-2">{payload[0].payload.fullDate}</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Portfolio Value:</span>
              <span className="font-mono font-semibold">${payload[0].value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Return:</span>
              <span className={`font-mono font-semibold ${payload[0].payload.returns >= 0 ? 'text-accent' : 'text-destructive'}`}>
                {payload[0].payload.returns >= 0 ? '+' : ''}{payload[0].payload.returns.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Drawdown:</span>
              <span className="font-mono font-semibold text-destructive">
                {payload[0].payload.drawdown.toFixed(2)}%
              </span>
            </div>
            {payload[0].payload.holding && (
              <div className="flex items-center justify-between gap-4 pt-1 border-t border-border">
                <span className="text-muted-foreground">Holding:</span>
                <span className="font-semibold">{payload[0].payload.holding}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {isPositive ? (
                  <TrendUp size={24} className="text-accent" weight="duotone" />
                ) : (
                  <TrendDown size={24} className="text-destructive" weight="duotone" />
                )}
                Equity Curve
              </CardTitle>
              <CardDescription>Portfolio value over time with drawdown overlay</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Total Return</div>
              <div className={`text-2xl font-semibold ${isPositive ? 'text-accent' : 'text-destructive'}`}>
                {isPositive ? '+' : ''}{totalReturn.toFixed(2)}%
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.30 45)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="oklch(0.65 0.30 45)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.05 0.005 0 / 0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="oklch(0.35 0.003 0)"
                style={{ fontSize: '12px', fontFamily: 'var(--font-sans)' }}
              />
              <YAxis 
                stroke="oklch(0.35 0.003 0)"
                style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine 
                y={startCapital} 
                stroke="oklch(0.35 0.003 0)" 
                strokeDasharray="5 5" 
                label={{ value: 'Start', position: 'insideTopLeft', fill: 'oklch(0.35 0.003 0)', fontSize: 12 }}
              />
              <Area 
                type="monotone" 
                dataKey="value" 
                stroke="oklch(0.65 0.30 45)" 
                strokeWidth={2.5}
                fill="url(#colorValue)" 
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendDown size={20} className="text-destructive" weight="duotone" />
            Drawdown Chart
          </CardTitle>
          <CardDescription>Decline from peak equity value</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 p-3 bg-muted/50 rounded-lg flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Maximum Drawdown</span>
            <span className="text-xl font-semibold text-destructive">{maxDrawdown.toFixed(2)}%</span>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.05 0.005 0 / 0.1)" />
              <XAxis 
                dataKey="date" 
                stroke="oklch(0.35 0.003 0)"
                style={{ fontSize: '12px', fontFamily: 'var(--font-sans)' }}
              />
              <YAxis 
                stroke="oklch(0.35 0.003 0)"
                style={{ fontSize: '12px', fontFamily: 'var(--font-mono)' }}
                tickFormatter={(value) => `${value.toFixed(1)}%`}
                domain={[Math.min(maxDrawdown * 1.1, -0.1), 0]}
              />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke="oklch(0.35 0.003 0)" strokeDasharray="5 5" />
              <Line 
                type="monotone" 
                dataKey="drawdown" 
                stroke="oklch(0.55 0.35 15)" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  )
}
