import { CellPurpose, CodeCell } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowRight, CheckCircle, Circle, Lock, Plus, WarningCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface StrategyBlueprintProps {
  cells: CodeCell[]
  highlightedCell?: number
  onCellClick?: (index: number) => void
  onAddPurpose?: (purpose: CellPurpose) => void
}

const requiredStages: Array<{ purpose: CellPurpose; label: string; contract: string; gate: string }> = [
  { purpose: 'universe', label: 'Universe', contract: 'Filtered universe', gate: 'Universe exists before enrichment' },
  { purpose: 'data', label: 'Data', contract: 'Enriched dataset', gate: 'Required fields are populated' },
  { purpose: 'ranking', label: 'Signal', contract: 'Score or ranked candidates', gate: 'Candidates have comparable scores' },
  { purpose: 'risk', label: 'Risk', contract: 'Risk pass/fail', gate: 'Risk checks pass before sizing' },
  { purpose: 'portfolio', label: 'Portfolio', contract: 'Selected holdings', gate: 'Weights are allocation-ready' },
  { purpose: 'trade', label: 'Output', contract: 'Trade signal or target allocation', gate: 'Decision is emitted to backtest' },
]

const stageMatches = (cell: CodeCell, purpose: CellPurpose) => {
  if (purpose === 'ranking') return ['ranking', 'calculation', 'condition'].includes(cell.purpose)
  if (purpose === 'trade') return ['trade', 'allocation'].includes(cell.purpose)
  return cell.purpose === purpose
}

export function StrategyBlueprint({ cells, highlightedCell, onCellClick, onAddPurpose }: StrategyBlueprintProps) {
  const stageCells = requiredStages.map(stage => {
    const cell = cells.find(item => stageMatches(item, stage.purpose))
    return { stage, cell }
  })
  const completeCount = stageCells.filter(({ cell }) => cell?.contract).length
  const definedCount = stageCells.filter(({ cell }) => Boolean(cell)).length

  return (
    <Card className="h-full overflow-hidden">
      <CardHeader className="border-b pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Strategy Blueprint</CardTitle>
            <p className="text-xs text-muted-foreground">Execution order, required gates, and expected output contracts.</p>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">{definedCount}/{requiredStages.length} stages</Badge>
            <Badge variant={completeCount === requiredStages.length ? 'default' : 'outline'}>
              {completeCount}/{requiredStages.length} gates ready
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="h-full overflow-auto p-4">
        <div className="mb-4 rounded-lg border bg-muted/25 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <ArrowRight size={14} />
            Execution Order
          </div>
          <ol className="grid grid-cols-1 gap-2 md:grid-cols-3 2xl:grid-cols-6">
            {stageCells.map(({ stage, cell }, stageIndex) => {
              const isHighlighted = cell && highlightedCell === cell.index
              const isGateReady = Boolean(cell?.contract)

              return (
                <li key={stage.purpose} className="min-w-0">
                  <button
                    type="button"
                    disabled={!cell}
                    onClick={() => cell && onCellClick?.(cell.index)}
                    className={cn(
                      'flex h-full w-full items-center gap-2 rounded-md border bg-card px-3 py-2 text-left transition-colors',
                      cell && 'hover:border-accent hover:bg-accent/5',
                      isHighlighted && 'border-accent ring-2 ring-accent/20',
                      !cell && 'cursor-default border-dashed bg-muted/20'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                        isGateReady && 'border-success bg-success text-success-foreground',
                        cell && !isGateReady && 'border-warning bg-warning/20 text-warning-foreground',
                        !cell && 'border-border bg-muted text-muted-foreground'
                      )}
                    >
                      {stageIndex + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{stage.label}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {cell ? `Cell ${cell.index}` : 'Add required step'}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ol>
        </div>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
          {stageCells.map(({ stage, cell }, stageIndex) => {
            const contractName = cell?.contract?.description ?? stage.contract
            const isHighlighted = cell && highlightedCell === cell.index
            const previousStage = stageIndex === 0 ? 'Start' : requiredStages[stageIndex - 1].label
            const nextStage = stageIndex === requiredStages.length - 1 ? 'Finish' : requiredStages[stageIndex + 1].label
            const gateState = !cell ? 'Missing step' : cell.contract ? 'Gate ready' : 'Needs contract'

            return (
              <div
                key={stage.purpose}
                className={cn(
                  'rounded-lg border bg-card p-4 transition-colors',
                  isHighlighted && 'border-accent ring-2 ring-accent/25',
                  !cell && 'border-dashed bg-muted/20'
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">Step {stageIndex + 1}</Badge>
                      <div className="font-medium">{stage.label}</div>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">{contractName}</div>
                  </div>
                  {cell ? (
                    cell.contract ? <CheckCircle size={18} weight="fill" className="text-success" /> : <WarningCircle size={18} weight="fill" className="text-warning" />
                  ) : (
                    <Circle size={18} className="text-muted-foreground" />
                  )}
                </div>

                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div className="rounded-md border bg-muted/20 p-2">
                    <div className="mb-1 text-[10px] font-semibold uppercase text-muted-foreground">Runs</div>
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate">{previousStage}</span>
                      <ArrowRight size={12} className="shrink-0 text-muted-foreground" />
                      <span className="truncate">{nextStage}</span>
                    </div>
                  </div>
                  <div className="rounded-md border bg-muted/20 p-2">
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-muted-foreground">
                      <Lock size={11} />
                      Gate
                    </div>
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <span className="truncate">{stage.gate}</span>
                      <Badge
                        variant={cell?.contract ? 'default' : 'outline'}
                        className={cn(
                          'h-5 text-[10px]',
                          cell && !cell.contract && 'border-warning text-warning'
                        )}
                      >
                        {gateState}
                      </Badge>
                    </div>
                  </div>
                </div>

                {cell ? (
                  <Button
                    variant="ghost"
                    className="mt-3 h-auto w-full justify-start px-2 py-2 text-left"
                    onClick={() => onCellClick?.(cell.index)}
                  >
                    <div>
                      <div className="text-sm font-medium">Cell {cell.index}: {cell.label ?? cell.purpose}</div>
                      <div className="mt-1 line-clamp-2 font-mono text-xs text-muted-foreground">{cell.code || 'No code defined'}</div>
                    </div>
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => onAddPurpose?.(stage.purpose)}
                  >
                    <Plus size={14} className="mr-2" />
                    Add {stage.label}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
