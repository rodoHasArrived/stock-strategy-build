import { ExecutionTrace, ExecutionStep } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle, ArrowRight, Clock } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface RunTraceViewerProps {
  trace: ExecutionTrace | null
  onStepClick?: (stepIndex: number) => void
}

export function RunTraceViewer({ trace, onStepClick }: RunTraceViewerProps) {
  if (!trace) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Execution Trace</CardTitle>
          <CardDescription>No execution history yet</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const formatTime = (ms: number) => {
    if (ms < 1) return `${(ms * 1000).toFixed(0)}μs`
    if (ms < 1000) return `${ms.toFixed(2)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              {trace.success ? (
                <CheckCircle size={16} className="text-success" weight="fill" />
              ) : (
                <XCircle size={16} className="text-destructive" weight="fill" />
              )}
              Execution Trace
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {trace.strategyName} • {new Date(trace.timestamp).toLocaleString()}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock size={14} />
            {formatTime(trace.totalExecutionTime)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="font-mono">
              Branch Path: {trace.branchPath.join(' → ')}
            </Badge>
            {Object.keys(trace.loopIterations).length > 0 && (
              <Badge variant="secondary" className="text-xs">
                Loops: {Object.keys(trace.loopIterations).length}
              </Badge>
            )}
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {trace.steps.map((step, index) => (
                <div key={index}>
                  <button
                    onClick={() => onStepClick?.(step.cellIndex)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-colors",
                      step.error
                        ? "border-destructive bg-destructive/5 hover:bg-destructive/10"
                        : "border-border hover:border-primary hover:bg-accent/5"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs font-mono">
                            Cell {step.cellIndex}
                          </Badge>
                          {step.cellLabel && (
                            <span className="text-xs font-medium truncate">
                              {step.cellLabel}
                            </span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto">
                            {formatTime(step.executionTime)}
                          </span>
                        </div>
                        
                        {step.error ? (
                          <div className="text-xs text-destructive font-mono mt-1">
                            {step.error}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                            {step.inputCount !== undefined && (
                              <span>Input: {step.inputCount} rows</span>
                            )}
                            {step.outputCount !== undefined && (
                              <span>Output: {step.outputCount} rows</span>
                            )}
                            {step.inputCount !== undefined && step.outputCount !== undefined && (
                              <Badge 
                                variant={step.outputCount >= step.inputCount ? "default" : "secondary"}
                                className="text-xs"
                              >
                                {step.outputCount >= step.inputCount ? '+' : ''}
                                {step.outputCount - step.inputCount}
                              </Badge>
                            )}
                            {step.reason && (
                              <span className="ml-auto font-mono truncate">
                                {step.reason}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                  
                  {index < trace.steps.length - 1 && (
                    <div className="flex justify-center my-1">
                      <ArrowRight size={14} className="text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>

          {Object.keys(trace.loopIterations).length > 0 && (
            <div className="pt-3 border-t">
              <div className="text-xs font-medium mb-2">Loop Iterations</div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(trace.loopIterations).map(([cellIndex, count]) => (
                  <div key={cellIndex} className="text-xs flex justify-between px-2 py-1 rounded bg-muted">
                    <span className="font-mono">Cell {cellIndex}</span>
                    <span className="text-muted-foreground">{count}×</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
