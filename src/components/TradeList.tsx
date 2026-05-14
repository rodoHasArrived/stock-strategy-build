import { useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import { AllCommunityModule, ModuleRegistry, type ColDef } from 'ag-grid-community'
import { Trade, TradeAction, TradeReason } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Download, FileText, Minus, TrendDown, TrendUp } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

ModuleRegistry.registerModules([AllCommunityModule])

interface TradeListProps {
  trades: Trade[]
  onExport?: () => void
}

const actionColors: Record<TradeAction, string> = {
  buy: 'bg-success/10 text-success border-success/30',
  sell: 'bg-destructive/10 text-destructive border-destructive/30',
  hold: 'bg-muted text-muted-foreground border-border',
  reduce: 'bg-warning/10 text-warning border-warning/30',
  increase: 'bg-accent/10 text-accent border-accent/30',
}

const actionIcons: Record<TradeAction, React.ReactNode> = {
  buy: <TrendUp size={14} weight="fill" />,
  sell: <TrendDown size={14} weight="fill" />,
  hold: <Minus size={14} />,
  reduce: <TrendDown size={14} />,
  increase: <TrendUp size={14} />,
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
  OPTIMIZATION: 'Optimization result',
}

const pageSizeOptions = [25, 50, 100]

const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
}).format(value)

const formatPrice = (value: number) => value.toFixed(2)

export function TradeList({ trades, onExport }: TradeListProps) {
  const [filter, setFilter] = useState<TradeAction | 'all'>('all')
  const [search, setSearch] = useState('')
  const [pageSize, setPageSize] = useState(pageSizeOptions[0])

  const tradeCounts = useMemo(() => trades.reduce((acc, trade) => {
    acc[trade.action] = (acc[trade.action] || 0) + 1
    return acc
  }, {} as Record<TradeAction, number>), [trades])

  const filteredTrades = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    return trades.filter((trade) => {
      if (filter !== 'all' && trade.action !== filter) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      return [
        trade.security,
        trade.cusip,
        reasonLabels[trade.reason] || trade.reason,
        trade.reasonDetails,
        trade.action,
      ].some((value) => value?.toLowerCase().includes(normalizedSearch))
    })
  }, [filter, search, trades])

  const columnDefs = useMemo<ColDef<Trade>[]>(() => [
    {
      field: 'security',
      headerName: 'Security',
      minWidth: 220,
      flex: 1.3,
      cellRenderer: ({ data }) => (
        <div className="py-2">
          <div className="font-mono text-sm font-medium text-foreground">{data?.security}</div>
          <div className="text-xs text-muted-foreground">{data?.cusip}</div>
        </div>
      ),
    },
    {
      field: 'action',
      headerName: 'Action',
      minWidth: 140,
      maxWidth: 160,
      cellRenderer: ({ value }) => value ? (
        <Badge variant="outline" className={cn('font-medium', actionColors[value])}>
          <span className="mr-1.5">{actionIcons[value]}</span>
          {value.toUpperCase()}
        </Badge>
      ) : '—',
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      minWidth: 140,
      maxWidth: 170,
      type: 'numericColumn',
      valueFormatter: ({ value }) => value !== undefined ? formatCurrency(value) : '—',
      cellClass: 'font-mono',
    },
    {
      field: 'price',
      headerName: 'Price',
      minWidth: 100,
      maxWidth: 120,
      type: 'numericColumn',
      valueFormatter: ({ value }) => value !== undefined ? formatPrice(value) : '—',
      cellClass: 'font-mono',
    },
    {
      field: 'score',
      headerName: 'Score',
      minWidth: 110,
      maxWidth: 130,
      type: 'numericColumn',
      cellRenderer: ({ value }) => {
        if (value === undefined) return '—'
        const scoreColor = value >= 70 ? 'text-success' : value >= 40 ? 'text-warning' : 'text-destructive'
        return <span className={cn('font-mono font-semibold', scoreColor)}>{value.toFixed(1)}</span>
      },
    },
    {
      field: 'reason',
      headerName: 'Reason',
      minWidth: 240,
      flex: 1.4,
      cellRenderer: ({ data }) => (
        <div className="py-2">
          <div className="text-sm font-medium text-foreground">{data ? reasonLabels[data.reason] || data.reason : '—'}</div>
          {data?.reasonDetails && (
            <div className="text-xs text-muted-foreground">{data.reasonDetails}</div>
          )}
        </div>
      ),
    },
  ], [])

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText size={20} className="text-accent" />
              Trade Output
            </CardTitle>
            <CardDescription>
              AG Grid now handles result virtualization and paging for larger trade sets.
            </CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search security, CUSIP, or reason..."
              className="w-full min-w-[220px] xl:w-[280px]"
            />
            <div className="flex items-center gap-2">
              {pageSizeOptions.map((option) => (
                <Button
                  key={option}
                  variant={pageSize === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPageSize(option)}
                >
                  {option}/page
                </Button>
              ))}
            </div>
            {onExport && (
              <Button onClick={onExport} size="sm" variant="outline">
                <Download size={16} className="mr-2" />
                Export CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter('all')}
          >
            All ({trades.length})
          </Button>
          {(['buy', 'sell', 'hold', 'reduce', 'increase'] as TradeAction[]).map((action) => (
            <Button
              key={action}
              variant={filter === action ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(action)}
              className={cn(filter === action && actionColors[action])}
            >
              {actionIcons[action]}
              <span className="ml-1.5 capitalize">{action}</span>
              {tradeCounts[action] && <span className="ml-1">({tradeCounts[action]})</span>}
            </Button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="ag-theme-quartz trade-grid h-[600px] w-full">
            <AgGridReact<Trade>
              rowData={filteredTrades}
              columnDefs={columnDefs}
              defaultColDef={{
                sortable: true,
                resizable: true,
                suppressMovable: true,
              }}
              animateRows
              pagination
              paginationPageSize={pageSize}
              paginationPageSizeSelector={pageSizeOptions}
              rowHeight={72}
              suppressCellFocus
              suppressColumnVirtualisation={false}
              overlayNoRowsTemplate="<span class='text-sm text-muted-foreground'>No trades to display</span>"
            />
          </div>
        </div>

        {trades.length > 0 && (
          <div className="rounded-lg border border-border bg-muted/50 p-4">
            <h4 className="mb-2 text-sm font-medium">Trade Summary</h4>
            <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-5">
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
