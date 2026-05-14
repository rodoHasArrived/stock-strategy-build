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
  Path
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
        return lines.join('\n')
      }

      if (!rule.condition) {
        if (rule.action === 'next') return 'next'
        if (rule.action === 'stop') return 'stop'
        if (rule.action === 'goto' && rule.target != null) return `goto ${rule.target}`
        if (rule.action === 'while' && rule.target != null) return `while ${rule.condition || 'true'}: goto ${rule.target}`
        return ''
      }

      const action = rule.action === 'next' ? 'next' : 
                    rule.action === 'stop' ? 'stop' :
                    rule.action === 'goto' && rule.target != null ? `goto ${rule.target}` :
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

        {(showVisualization && executionPaths.length > 0 || analysisWarnings.length > 0) && (
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
              {rules.map((rule, index) => (
                <Card key={rule.id} className="p-3 bg-background">
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
                        {rule.action === 'goto' && rule.target != null && rule.target <= fromCell && (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <ArrowBendUpLeft size={12} />
                            Backward
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
                            <SelectItem value="stop">Stop</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {(rule.action === 'goto' || rule.action === 'while') && (
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

                    {rule.action === 'goto' && rule.target != null && rule.target <= fromCell && (
                      <div className="space-y-2 pt-2 border-t border-warning/20 bg-warning/5 p-3 rounded-md">
                        <div className="flex items-start gap-2 mb-2">
                          <Warning size={16} className="text-warning mt-0.5 flex-shrink-0" weight="bold" />
                          <div>
                            <Label className="text-xs font-semibold text-warning-foreground">
                              Backward Jump Justification Required
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              Loops that jump backward must include a clear explanation to prevent infinite loops
                            </p>
                          </div>
                        </div>
                        <Textarea
                          placeholder="e.g., Iterating until portfolio risk < threshold, max 50 iterations"
                          value={rule.backwardJumpJustification || ''}
                          onChange={(e) => 
                            updateRule(rule.id, { backwardJumpJustification: e.target.value })
                          }
                          className="text-xs min-h-[60px] resize-none"
                          id={`backward-justification-${rule.id}`}
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
                          <Label className="text-xs text-muted-foreground">Max Iterations</Label>
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
                          <Label className="text-xs text-muted-foreground">Exit Condition (optional)</Label>
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
                        </div>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
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
