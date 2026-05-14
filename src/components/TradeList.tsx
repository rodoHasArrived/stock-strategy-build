import { Trade, TradeAction, TradeReason } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { TrendUp, TrendDown, Minus, Download, FileText } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { useState } from 'react'

interface TradeListProps {
  trades: Trade[]
  onExport?: () => void
}

const actionColors: Record<TradeAction, string> = {
  buy: 'bg-success/10 text-success border-success/30',
  sell: 'bg-destructive/10 text-destructive border-destructive/30',
  hold: 'bg-muted text-muted-foreground border-border',
  reduce: 'bg-warning/10 text-warning border-warning/30',
  increase: 'bg-accent/10 text-accent border-accent/30'
}

const actionIcons: Record<TradeAction, React.ReactNode> = {
  buy: <TrendUp size={14} weight="fill" />,
  sell: <TrendDown size={14} weight="fill" />,
  hold: <Minus size={14} />,
  reduce: <TrendDown size={14} />,
  increase: <TrendUp size={14} />
}

const reasonLabels: Record<TradeReason, string> = {
  BUY_HIGH_SCORE: 'Top yield score',
  SELL_FAILED_RATING: 'Failed rating threshold',
  SELL_DURATION_LIMIT: 'Duration limit exceeded',
  HOLD_WITHIN_TOLERANCE: 'Within target range',
  REDUCE_ISSUER_EXPOSURE: 'Reduce issuer concentration',
  REDUCE_SECTOR_EXPOSURE: 'Reduce sector concentration',
  INCREASE_TO_TARGET: 'Increase to target weight',
  REBALANCE: 'Portfolio rebalance',
  OPTIMIZATION: 'Optimization result'
}

export function TradeList({ trades, onExport }: TradeListProps) {
  const [filter, setFilter] = useState<TradeAction | 'all'>('all')

  const filteredTrades = filter === 'all'
    ? trades
    : trades.filter(t => t.action === filter)

  const tradeCounts = trades.reduce((acc, trade) => {
    acc[trade.action] = (acc[trade.action] || 0) + 1
    return acc
  }, {} as Record<TradeAction, number>)

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPrice = (value: number) => {
    return value.toFixed(2)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Trade Output
            </CardTitle>
            <CardDescription>
              Actionable trade recommendations with reason codes
            </CardDescription>
          </div>
          {onExport && (
            <Button onClick={onExport} size="sm" variant="outline">
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({trades.length})
          </Button>
          {(['buy', 'sell', 'hold', 'reduce', 'increase'] as TradeAction[]).map(action => (
            <Button
              key={action}
              variant={filter === action ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(action)}
              className={cn(
                filter === action && actionColors[action]
              )}
            >
              {actionIcons[action]}
              <span className="ml-1.5 capitalize">{action}</span>
              {tradeCounts[action] && <span className="ml-1">({tradeCounts[action]})</span>}
            </Button>
          ))}
        </div>

        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Security</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Reason</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTrades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No trades to display
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrades.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium font-mono text-sm">{trade.security}</div>
                        <div className="text-xs text-muted-foreground">{trade.cusip}</div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn('font-medium', actionColors[trade.action])}
                      >
                        <span className="mr-1.5">{actionIcons[trade.action]}</span>
                        {trade.action.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.quantity !== undefined ? formatCurrency(trade.quantity) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.price !== undefined ? formatPrice(trade.price) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {trade.score !== undefined ? (
                        <span className={cn(
                          trade.score >= 70 ? 'text-success' :
                          trade.score >= 40 ? 'text-warning' :
                          'text-destructive'
                        )}>
                          {trade.score.toFixed(1)}
                        </span>
                      ) : '—'}
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="text-sm font-medium">
                          {reasonLabels[trade.reason] || trade.reason}
                        </div>
                        {trade.reasonDetails && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {trade.reasonDetails}
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>

        {trades.length > 0 && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <h4 className="text-sm font-medium mb-2">Trade Summary</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Total Trades</div>
                <div className="text-lg font-semibold">{trades.length}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Buys</div>
                <div className="text-lg font-semibold text-success">{tradeCounts.buy || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Sells</div>
                <div className="text-lg font-semibold text-destructive">{tradeCounts.sell || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Holds</div>
                <div className="text-lg font-semibold text-muted-foreground">{tradeCounts.hold || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Adjustments</div>
                <div className="text-lg font-semibold">{(tradeCounts.reduce || 0) + (tradeCounts.increase || 0)}</div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
