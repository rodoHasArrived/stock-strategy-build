import { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { ArrowDown, ArrowRight, Plus, Trash } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface TransitionRule {
  id: string
  condition?: string
  action: 'next' | 'goto' | 'stop' | 'loop'
  target?: number
  label?: string
}

interface TransitionEditorProps {
  fromCell: number
  toCell?: number
  rules: TransitionRule[]
  onRulesChange: (rules: TransitionRule[]) => void
  cellCount: number
}

export function TransitionEditor({ fromCell, toCell, rules, onRulesChange, cellCount }: TransitionEditorProps) {
  const [mode, setMode] = useState<'simple' | 'advanced'>('simple')

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

  const generateCode = () => {
    return rules.map(rule => {
      if (!rule.condition) {
        if (rule.action === 'next') return 'next'
        if (rule.action === 'stop') return 'stop'
        if (rule.action === 'goto' && rule.target != null) return `goto ${rule.target}`
        return ''
      }

      const action = rule.action === 'next' ? 'next' : 
                    rule.action === 'stop' ? 'stop' :
                    rule.action === 'goto' && rule.target != null ? `goto ${rule.target}` : 'next'
      
      return `if ${rule.condition}:\n  ${action}`
    }).filter(Boolean).join('\n')
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
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'simple' | 'advanced')}>
            <TabsList className="h-8">
              <TabsTrigger value="simple" className="text-xs">Simple</TabsTrigger>
              <TabsTrigger value="advanced" className="text-xs">Advanced</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <TabsContent value="simple" className="mt-0 space-y-3">
          {rules.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              No transition rules defined. Add a rule to control flow.
            </div>
          ) : (
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <Card key={rule.id} className="p-3 bg-background">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-xs">
                        Rule {index + 1}
                      </Badge>
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
                            <SelectItem value="stop">Stop</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {rule.action === 'goto' && (
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
                                  Cell {i}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
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
          <ArrowRight size={16} className="text-muted-foreground" />
        </div>
      </div>
    </Card>
  )
}
