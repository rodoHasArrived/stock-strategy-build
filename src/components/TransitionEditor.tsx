import { useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { 
  ArrowDown, 
  ArrowRight, 
  Plus, 
  Trash, 
  ArrowBendUpLeft, 
  GitBranch, 
  ArrowsClockwise,
  Warning,
  Info,
  Path,
  CheckCircle,
  XCircle,
  Question,
  Bug
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { TransitionRule, ExecutionPath } from '@/lib/types'

interface TransitionEditorProps {
  fromCell: number
  toCell?: number
  rules: TransitionRule[]
  onRulesChange: (rules: TransitionRule[]) => void
  cellCount: number
}

const ROUTE_ACTION_LABELS: Record<TransitionRule['action'], { label: string; icon: React.ReactNode; color: string }> = {
  next: { label: 'Go to Next', icon: <ArrowRight size={14} />, color: '' },
  goto: { label: 'Go to Cell…', icon: <ArrowRight size={14} />, color: '' },
  loop: { label: 'Create Loop', icon: <ArrowsClockwise size={14} />, color: '' },
  while: { label: 'While Loop', icon: <ArrowsClockwise size={14} />, color: '' },
  for_each: { label: 'For Each', icon: <ArrowsClockwise size={14} />, color: 'text-accent' },
  retry: { label: 'Retry', icon: <ArrowBendUpLeft size={14} />, color: 'text-primary' },
  stop: { label: 'Stop', icon: <XCircle size={14} />, color: '' },
  pass: { label: 'Pass ✓', icon: <CheckCircle size={14} className="text-success" />, color: 'text-success' },
  fail: { label: 'Fail ✗', icon: <XCircle size={14} className="text-destructive" />, color: 'text-destructive' },
  missing_data: { label: 'Missing Data ?', icon: <Question size={14} className="text-warning" />, color: 'text-warning' },
  error: { label: 'Error ⚠', icon: <Bug size={14} className="text-destructive" />, color: 'text-destructive' },
  on_error: { label: 'On Error →', icon: <Bug size={14} />, color: 'text-destructive' },
}

export function TransitionEditor({ fromCell, toCell, rules, onRulesChange, cellCount }: TransitionEditorProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')
  const [showVisualization, setShowVisualization] = useState(true)

  const addRule = () => {
    const newRule: TransitionRule = {
      id: `rule-${Date.now()}`,
      action: 'next'
    }
    onRulesChange([...rules, newRule])
  }

  const updateRule = (id: string, updates: Partial<TransitionRule>) => {
    onRulesChange(rules.map(rule => rule.id === id ? { ...rule, ...updates } : rule))
  }

  const removeRule = (id: string) => {
    onRulesChange(rules.filter(rule => rule.id !== id))
  }

  const executionPaths = useMemo((): ExecutionPath[] => {
    const paths: ExecutionPath[] = []
    
    rules.forEach((rule) => {
      if (rule.action === 'next' && toCell != null) {
        paths.push({
          fromCell,
          toCell,
          condition: rule.condition,
          type: rule.condition ? 'conditional' : 'default'
        })
      } else if (rule.action === 'goto' && rule.target != null) {
        const isLoop = rule.target <= fromCell
        paths.push({
          fromCell,
          toCell: rule.target,
          condition: rule.condition,
          type: isLoop ? 'loop' : rule.condition ? 'branch' : 'default'
        })
      } else if (rule.action === 'loop' && rule.loopConfig) {
        paths.push({
          fromCell: rule.loopConfig.endCell,
          toCell: rule.loopConfig.startCell,
          condition: rule.loopConfig.exitCondition,
          type: 'loop'
        })
      }
    })

    if (paths.length === 0 && toCell != null) {
      paths.push({
        fromCell,
        toCell,
        type: 'default'
      })
    }

    return paths
  }, [rules, fromCell, toCell])

  const analysisWarnings = useMemo(() => {
    const warnings: string[] = []
    
    const loopPaths = executionPaths.filter(p => p.type === 'loop')
    if (loopPaths.length > 0) {
      const hasMaxIterations = rules.some(r => r.loopConfig?.maxIterations)
      if (!hasMaxIterations) {
        warnings.push('Loop detected without max iteration limit')
      }
      
      const hasExitCondition = rules.some(r => 
        r.loopConfig?.exitCondition && r.loopConfig.exitCondition.trim().length > 0
      )
      if (!hasExitCondition) {
        warnings.push('Loop detected without exit condition - infinite loop risk')
      }
    }

    const backwardJumps = rules.filter(r => 
      r.action === 'goto' && r.target != null && r.target <= fromCell
    )
    backwardJumps.forEach((rule) => {
      if (!rule.backwardJumpJustification || rule.backwardJumpJustification.trim().length === 0) {
        warnings.push(`Backward jump to cell ${rule.target} requires justification`)
      }
    })

    const branchPaths = executionPaths.filter(p => p.type === 'branch' || p.type === 'conditional')
    if (branchPaths.length > 3) {
      warnings.push('Multiple branch paths may increase complexity')
    }

    const targetsOutOfBounds = rules.filter(r => 
      r.action === 'goto' && r.target != null && (r.target < 0 || r.target >= cellCount)
    )
    if (targetsOutOfBounds.length > 0) {
      warnings.push('Some targets reference cells outside valid range')
    }

    return warnings
  }, [executionPaths, rules, cellCount, fromCell])

  // Backward-jump rules that are missing a justification — these are blocking errors
  const backwardJumpErrors = useMemo(() => {
    return rules.filter(r =>
      r.action === 'goto' &&
      r.target != null &&
      r.target <= fromCell &&
      !r.backwardJumpJustification?.trim()
    )
  }, [rules, fromCell])

  const generateCode = () => {
    return rules.map(rule => {
      if (rule.action === 'loop' && rule.loopConfig) {
        const lines = [`loop from ${rule.loopConfig.startCell} to ${rule.loopConfig.endCell}:`]
        if (rule.loopConfig.maxIterations) {
          lines.push(`  max_iterations: ${rule.loopConfig.maxIterations}`)
        }
        if (rule.loopConfig.exitCondition) {
          lines.push(`  exit_when: ${rule.loopConfig.exitCondition}`)
        }
        if (rule.loopConfig.iteratorVariable) {
          lines.push(`  iterator: ${rule.loopConfig.iteratorVariable}`)
        }
        return lines.join('\n')
      }

      if (rule.action === 'for_each' && rule.forEachConfig) {
        const lines = [`for each ${rule.forEachConfig.iteratorVariable} in ${rule.forEachConfig.collection}:`]
        lines.push(`  run cells ${rule.forEachConfig.startCell} to ${rule.forEachConfig.endCell}`)
        if (rule.forEachConfig.maxIterations) {
          lines.push(`  max_iterations: ${rule.forEachConfig.maxIterations}`)
        }
        return lines.join('\n')
      }

      if (rule.action === 'retry' && rule.retryConfig) {
        const lines = [`retry:`]
        lines.push(`  max_retries: ${rule.retryConfig.maxRetries}`)
        lines.push(`  backoff: ${rule.retryConfig.backoff}`)
        if (rule.retryConfig.condition) {
          lines.push(`  when: ${rule.retryConfig.condition}`)
        }
        return lines.join('\n')
      }

      if (!rule.condition) {
        if (rule.action === 'next') return 'next'
        if (rule.action === 'stop') return 'stop'
        if (rule.action === 'pass') return 'pass'
        if (rule.action === 'fail') return 'fail'
        if (rule.action === 'missing_data') return 'missing_data'
        if (rule.action === 'error') return 'error'
        if (rule.action === 'goto' && rule.target != null) return `goto ${rule.target}`
        if (rule.action === 'on_error' && rule.target != null) return `on_error: goto ${rule.target}`
        if (rule.action === 'while' && rule.target != null) return `while ${rule.condition || 'true'}: goto ${rule.target}`
        return ''
      }

      const action = rule.action === 'next' ? 'next' : 
                    rule.action === 'stop' ? 'stop' :
                    rule.action === 'pass' ? 'pass' :
                    rule.action === 'fail' ? 'fail' :
                    rule.action === 'missing_data' ? 'missing_data' :
                    rule.action === 'error' ? 'error' :
                    rule.action === 'goto' && rule.target != null ? `goto ${rule.target}` :
                    rule.action === 'on_error' && rule.target != null ? `on_error: goto ${rule.target}` :
                    rule.action === 'while' && rule.target != null ? `goto ${rule.target}` : 'next'
      
      return `if ${rule.condition}:\n  ${action}`
    }).filter(Boolean).join('\n')
  }

  const PathVisualization = ({ path }: { path: ExecutionPath }) => {
    const getPathColor = () => {
      switch (path.type) {
        case 'loop': return 'text-warning border-warning/30 bg-warning/5'
        case 'branch': return 'text-accent border-accent/30 bg-accent/5'
        case 'conditional': return 'text-primary border-primary/30 bg-primary/5'
        default: return 'text-muted-foreground border-border bg-muted/20'
      }
    }

    const getPathIcon = () => {
      switch (path.type) {
        case 'loop': return <ArrowsClockwise size={14} weight="bold" />
        case 'branch': return <GitBranch size={14} weight="bold" />
        case 'conditional': return <GitBranch size={14} />
        default: return <ArrowRight size={14} />
      }
    }

    return (
      <div className={cn('flex items-center gap-2 p-2 rounded-md border text-xs', getPathColor())}>
        {getPathIcon()}
        <div className="flex-1">
          <div className="font-mono font-semibold">
            Cell {path.fromCell} → Cell {path.toCell}
          </div>
          {path.condition && (
            <div className="text-xs opacity-75 mt-0.5 font-mono">
              when: {path.condition}
            </div>
          )}
        </div>
        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
          {path.type}
        </Badge>
      </div>
    )
  }

  return (
    <Card className="p-4 bg-accent/5 border-accent/20">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ArrowDown size={20} className="text-accent" weight="bold" />
            <span className="text-sm font-medium">
              Transition: Cell {fromCell} → {toCell ?? '?'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowVisualization(!showVisualization)}
              className="h-8 text-xs"
            >
              <Path size={14} className="mr-1" />
              {showVisualization ? 'Hide' : 'Show'} Paths
            </Button>
            <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
              <TabsList className="h-8">
                <TabsTrigger value="simple" className="text-xs">Simple</TabsTrigger>
                <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {showVisualization && executionPaths.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Path size={14} />
              Execution Paths
            </div>
            <div className="space-y-2">
              {executionPaths.map((path, idx) => (
                <PathVisualization key={idx} path={path} />
              ))}
            </div>
          </div>
        )}

        {backwardJumpErrors.length > 0 && (
          <div className="space-y-2">
            {backwardJumpErrors.map((rule) => (
              <div key={rule.id} className="flex items-start gap-2 p-2 rounded-md bg-destructive/10 border border-destructive/30 text-xs">
                <Warning size={14} className="text-destructive mt-0.5 flex-shrink-0" weight="bold" />
                <span className="text-destructive">
                  Backward jump to cell {rule.target} requires an explicit justification before it can be saved.
                </span>
              </div>
            ))}
          </div>
        )}

        {analysisWarnings.length > 0 && (
          <div className="space-y-2">
            {analysisWarnings.map((warning, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-md bg-warning/10 border border-warning/30 text-xs">
                <Warning size={14} className="text-warning mt-0.5 flex-shrink-0" weight="bold" />
                <span className="text-warning-foreground">{warning}</span>
              </div>
            ))}
          </div>
        )}

        {(showVisualization && executionPaths.length > 0 || analysisWarnings.length > 0 || backwardJumpErrors.length > 0) && (
          <Separator />
        )}

        <TabsContent value="simple" className="mt-0 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Info size={20} className="mx-auto mb-2 opacity-50" />
              No transition rules defined. Add a rule to control flow.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => {
                const isBackwardJump = rule.action === 'goto' && rule.target != null && rule.target <= fromCell
                const missingJustification = isBackwardJump && !rule.backwardJumpJustification?.trim()
                return (
                <Card key={rule.id} className={cn('p-3 bg-background', missingJustification && 'border-destructive')}>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          Rule {index + 1}
                        </Badge>
                        {rule.action === 'loop' && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <ArrowsClockwise size={12} />
                            Loop
                          </Badge>
                        )}
                        {rule.action === 'for_each' && (
                          <Badge variant="secondary" className="text-xs gap-1 bg-accent/20 text-accent-foreground">
                            <ArrowsClockwise size={12} />
                            For Each
                          </Badge>
                        )}
                        {rule.action === 'retry' && (
                          <Badge variant="secondary" className="text-xs gap-1 bg-primary/20 text-primary-foreground">
                            <ArrowBendUpLeft size={12} />
                            Retry
                          </Badge>
                        )}
                        {isBackwardJump && (
                          <Badge variant={missingJustification ? 'destructive' : 'secondary'} className="text-xs gap-1">
                            <ArrowBendUpLeft size={12} />
                            Backward
                          </Badge>
                        )}
                        {(rule.action === 'pass' || rule.action === 'fail' || rule.action === 'missing_data' || rule.action === 'error' || rule.action === 'on_error') && (
                          <Badge variant="outline" className={cn('text-xs gap-1', ROUTE_ACTION_LABELS[rule.action].color)}>
                            {ROUTE_ACTION_LABELS[rule.action].icon}
                            {rule.action.replace('_', ' ')}
                          </Badge>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeRule(rule.id)}
                      >
                        <Trash size={14} />
                      </Button>
                    </div>

                    {index > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">When</Label>
                        <Input
                          placeholder="e.g., current_yield >= 5.0"
                          value={rule.condition || ''}
                          onChange={(e) => updateRule(rule.id, { condition: e.target.value })}
                          className="text-sm font-mono"
                          id={`transition-condition-${rule.id}`}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-2">
                        <Label className="text-xs">Then</Label>
                        <Select
                          value={rule.action}
                          onValueChange={(value: TransitionRule['action']) => 
                            updateRule(rule.id, { action: value })
                          }
                        >
                          <SelectTrigger className="h-9 text-sm">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="next">Go to Next</SelectItem>
                            <SelectItem value="goto">Go to Cell...</SelectItem>
                            <SelectItem value="loop">Create Loop</SelectItem>
                            <SelectItem value="while">While Loop</SelectItem>
                            <SelectItem value="for_each">For Each</SelectItem>
                            <SelectItem value="retry">Retry</SelectItem>
                            <SelectItem value="on_error">On Error →</SelectItem>
                            <SelectItem value="stop">Stop</SelectItem>
                            <SelectItem value="pass">Pass ✓</SelectItem>
                            <SelectItem value="fail">Fail ✗</SelectItem>
                            <SelectItem value="missing_data">Missing Data ?</SelectItem>
                            <SelectItem value="error">Error ⚠</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(rule.action === 'goto' || rule.action === 'while' || rule.action === 'on_error') && (
                        <div className="space-y-2">
                          <Label className="text-xs">Target Cell</Label>
                          <Select
                            value={rule.target?.toString()}
                            onValueChange={(value) => 
                              updateRule(rule.id, { target: parseInt(value) })
                            }
                          >
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder="Select..." />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from({ length: cellCount }, (_, i) => (
                                <SelectItem key={i} value={i.toString()}>
                                  Cell {i} {i <= fromCell ? '(backward)' : '(forward)'}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>

                    {isBackwardJump && (
                      <div className="space-y-1 pt-2 border-t border-destructive/20">
                        <Label className="text-xs text-destructive font-semibold flex items-center gap-1">
                          <Warning size={12} weight="bold" />
                          Backward Jump Justification (required)
                        </Label>
                        <Input
                          placeholder="Why is this backward jump necessary?"
                          value={rule.backwardJumpJustification || ''}
                          onChange={(e) => updateRule(rule.id, { backwardJumpJustification: e.target.value })}
                          className={cn('h-8 text-xs', missingJustification && 'border-destructive focus-visible:ring-destructive')}
                          id={`backward-jump-justification-${rule.id}`}
                        />
                      </div>
                    )}

                    {rule.action === 'loop' && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs font-semibold">Loop Configuration</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start Cell</Label>
                            <Select
                              value={rule.loopConfig?.startCell?.toString() || fromCell.toString()}
                              onValueChange={(value) => 
                                updateRule(rule.id, { 
                                  loopConfig: { 
                                    ...rule.loopConfig,
                                    startCell: parseInt(value),
                                    endCell: rule.loopConfig?.endCell || fromCell,
                                    maxIterations: rule.loopConfig?.maxIterations || 100
                                  } 
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: fromCell + 1 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    Cell {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End Cell</Label>
                            <Select
                              value={rule.loopConfig?.endCell?.toString() || fromCell.toString()}
                              onValueChange={(value) => 
                                updateRule(rule.id, { 
                                  loopConfig: { 
                                    ...rule.loopConfig,
                                    startCell: rule.loopConfig?.startCell || fromCell,
                                    endCell: parseInt(value),
                                    maxIterations: rule.loopConfig?.maxIterations || 100
                                  } 
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: fromCell + 1 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    Cell {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground font-semibold">Max Iterations <span className="text-destructive">*</span></Label>
                          <Input
                            type="number"
                            placeholder="100"
                            value={rule.loopConfig?.maxIterations || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                loopConfig: { 
                                  ...rule.loopConfig,
                                  startCell: rule.loopConfig?.startCell || fromCell,
                                  endCell: rule.loopConfig?.endCell || fromCell,
                                  maxIterations: parseInt(e.target.value) || 100
                                } 
                              })
                            }
                            className="h-8 text-xs"
                            id={`loop-max-iterations-${rule.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground font-semibold">Exit Condition <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="e.g., error_count > 0"
                            value={rule.loopConfig?.exitCondition || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                loopConfig: { 
                                  ...rule.loopConfig,
                                  startCell: rule.loopConfig?.startCell || fromCell,
                                  endCell: rule.loopConfig?.endCell || fromCell,
                                  maxIterations: rule.loopConfig?.maxIterations || 100,
                                  exitCondition: e.target.value
                                } 
                              })
                            }
                            className="h-8 text-xs font-mono"
                            id={`loop-exit-condition-${rule.id}`}
                          />
                          {!rule.loopConfig?.exitCondition && (
                            <p className="text-[10px] text-destructive">Exit condition is required — loops without one will be refused at run time.</p>
                          )}
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Iterator Variable (optional)</Label>
                          <Input
                            placeholder="e.g., iteration_count"
                            value={rule.loopConfig?.iteratorVariable || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                loopConfig: { 
                                  ...rule.loopConfig,
                                  startCell: rule.loopConfig?.startCell || fromCell,
                                  endCell: rule.loopConfig?.endCell || fromCell,
                                  maxIterations: rule.loopConfig?.maxIterations || 100,
                                  iteratorVariable: e.target.value
                                } 
                              })
                            }
                            className="h-8 text-xs font-mono"
                            id={`loop-iterator-variable-${rule.id}`}
                          />
                        </div>
                      </div>
                    )}

                    {rule.action === 'for_each' && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs font-semibold">For Each Configuration</Label>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground font-semibold">Collection <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="e.g., securities, portfolios, sectors"
                            value={rule.forEachConfig?.collection || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                forEachConfig: { 
                                  ...rule.forEachConfig,
                                  collection: e.target.value,
                                  iteratorVariable: rule.forEachConfig?.iteratorVariable || 'item',
                                  startCell: rule.forEachConfig?.startCell || fromCell,
                                  endCell: rule.forEachConfig?.endCell || fromCell
                                } 
                              })
                            }
                            className="h-8 text-xs font-mono"
                            id={`foreach-collection-${rule.id}`}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground font-semibold">Iterator Variable <span className="text-destructive">*</span></Label>
                          <Input
                            placeholder="e.g., security, portfolio, sector"
                            value={rule.forEachConfig?.iteratorVariable || 'item'}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                forEachConfig: { 
                                  ...rule.forEachConfig,
                                  collection: rule.forEachConfig?.collection || '',
                                  iteratorVariable: e.target.value,
                                  startCell: rule.forEachConfig?.startCell || fromCell,
                                  endCell: rule.forEachConfig?.endCell || fromCell
                                } 
                              })
                            }
                            className="h-8 text-xs font-mono"
                            id={`foreach-iterator-${rule.id}`}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Start Cell</Label>
                            <Select
                              value={rule.forEachConfig?.startCell?.toString() || fromCell.toString()}
                              onValueChange={(value) => 
                                updateRule(rule.id, { 
                                  forEachConfig: { 
                                    ...rule.forEachConfig,
                                    collection: rule.forEachConfig?.collection || '',
                                    iteratorVariable: rule.forEachConfig?.iteratorVariable || 'item',
                                    startCell: parseInt(value),
                                    endCell: rule.forEachConfig?.endCell || fromCell
                                  } 
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: fromCell + 1 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    Cell {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">End Cell</Label>
                            <Select
                              value={rule.forEachConfig?.endCell?.toString() || fromCell.toString()}
                              onValueChange={(value) => 
                                updateRule(rule.id, { 
                                  forEachConfig: { 
                                    ...rule.forEachConfig,
                                    collection: rule.forEachConfig?.collection || '',
                                    iteratorVariable: rule.forEachConfig?.iteratorVariable || 'item',
                                    startCell: rule.forEachConfig?.startCell || fromCell,
                                    endCell: parseInt(value)
                                  } 
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {Array.from({ length: fromCell + 1 }, (_, i) => (
                                  <SelectItem key={i} value={i.toString()}>
                                    Cell {i}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Max Iterations (optional)</Label>
                          <Input
                            type="number"
                            placeholder="Unlimited"
                            value={rule.forEachConfig?.maxIterations || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                forEachConfig: { 
                                  ...rule.forEachConfig,
                                  collection: rule.forEachConfig?.collection || '',
                                  iteratorVariable: rule.forEachConfig?.iteratorVariable || 'item',
                                  startCell: rule.forEachConfig?.startCell || fromCell,
                                  endCell: rule.forEachConfig?.endCell || fromCell,
                                  maxIterations: parseInt(e.target.value) || undefined
                                } 
                              })
                            }
                            className="h-8 text-xs"
                            id={`foreach-max-iterations-${rule.id}`}
                          />
                        </div>
                      </div>
                    )}

                    {rule.action === 'retry' && (
                      <div className="space-y-2 pt-2 border-t">
                        <Label className="text-xs font-semibold">Retry Configuration</Label>
                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground font-semibold">Max Retries <span className="text-destructive">*</span></Label>
                            <Input
                              type="number"
                              placeholder="3"
                              value={rule.retryConfig?.maxRetries || ''}
                              onChange={(e) => 
                                updateRule(rule.id, { 
                                  retryConfig: { 
                                    ...rule.retryConfig,
                                    maxRetries: parseInt(e.target.value) || 3,
                                    backoff: rule.retryConfig?.backoff || 'linear'
                                  } 
                                })
                              }
                              className="h-8 text-xs"
                              id={`retry-max-${rule.id}`}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Backoff Strategy</Label>
                            <Select
                              value={rule.retryConfig?.backoff || 'linear'}
                              onValueChange={(value: 'linear' | 'exponential') => 
                                updateRule(rule.id, { 
                                  retryConfig: { 
                                    ...rule.retryConfig,
                                    maxRetries: rule.retryConfig?.maxRetries || 3,
                                    backoff: value
                                  } 
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="linear">Linear</SelectItem>
                                <SelectItem value="exponential">Exponential</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Retry Condition (optional)</Label>
                          <Input
                            placeholder="e.g., is_transient_error"
                            value={rule.retryConfig?.condition || ''}
                            onChange={(e) => 
                              updateRule(rule.id, { 
                                retryConfig: { 
                                  ...rule.retryConfig,
                                  maxRetries: rule.retryConfig?.maxRetries || 3,
                                  backoff: rule.retryConfig?.backoff || 'linear',
                                  condition: e.target.value
                                } 
                              })
                            }
                            className="h-8 text-xs font-mono"
                            id={`retry-condition-${rule.id}`}
                          />
                          <p className="text-[10px] text-muted-foreground">If specified, retry only when this condition is true</p>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
                )
              })}
            </div>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={addRule}
            className="w-full"
          >
            <Plus size={16} className="mr-2" />
            Add Rule
          </Button>
        </TabsContent>

        <TabsContent value="advanced" className="mt-0 space-y-3">
          <div className="space-y-2">
            <Label className="text-xs">Generated Code</Label>
            <div className="p-3 bg-muted rounded-md font-mono text-sm whitespace-pre-wrap border">
              {generateCode() || 'next'}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Switch to Simple mode to edit rules visually
          </div>
        </TabsContent>

        <div className="flex items-center justify-center pt-2">
          <ArrowDown size={16} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  )
}
