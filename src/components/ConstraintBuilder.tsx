import { useState } from 'react'
import { PortfolioConstraint, ConstraintType, ConstraintLevel } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, Trash, Lock, Warning } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface ConstraintBuilderProps {
  constraints: PortfolioConstraint[]
  onConstraintsChange: (constraints: PortfolioConstraint[]) => void
}

const constraintLevels: { value: ConstraintLevel; label: string }[] = [
  { value: 'position', label: 'Position-level' },
  { value: 'issuer', label: 'Issuer-level' },
  { value: 'sector', label: 'Sector-level' },
  { value: 'credit', label: 'Credit-level' },
  { value: 'duration', label: 'Duration' },
  { value: 'liquidity', label: 'Liquidity' },
  { value: 'custom', label: 'Custom' }
]

const defaultConstraintsByLevel: Record<ConstraintLevel, Partial<PortfolioConstraint>[]> = {
  position: [
    { name: 'Max position weight', operator: '<=', value: 2.00, unit: '%' },
    { name: 'Minimum position size', operator: '>=', value: 250000, unit: '$' }
  ],
  issuer: [
    { name: 'Max issuer exposure', operator: '<=', value: 5.00, unit: '%' }
  ],
  sector: [
    { name: 'Max sector exposure', operator: '<=', value: 20.00, unit: '%' }
  ],
  credit: [
    { name: 'Minimum average rating', operator: '>=', value: 0, unit: 'rating' },
    { name: 'Maximum below-investment-grade exposure', operator: '<=', value: 0.00, unit: '%' }
  ],
  duration: [
    { name: 'Portfolio duration', operator: 'between', value: 4.0, value2: 6.0, unit: 'years' }
  ],
  liquidity: [
    { name: 'Minimum liquidity score', operator: '>=', value: 60, unit: 'score' }
  ],
  custom: []
}

export function ConstraintBuilder({ constraints, onConstraintsChange }: ConstraintBuilderProps) {
  const [selectedLevel, setSelectedLevel] = useState<ConstraintLevel>('position')

  const addConstraint = (level: ConstraintLevel) => {
    const templates = defaultConstraintsByLevel[level]
    const template = templates[0] || { name: 'New constraint', operator: '<=', value: 0, unit: '%' }
    
    const newConstraint: PortfolioConstraint = {
      id: `constraint-${Date.now()}`,
      name: template.name || 'New constraint',
      type: 'hard',
      level,
      operator: template.operator as PortfolioConstraint['operator'],
      value: template.value || 0,
      value2: template.value2,
      unit: template.unit,
      enabled: true
    }

    onConstraintsChange([...constraints, newConstraint])
  }

  const updateConstraint = (id: string, updates: Partial<PortfolioConstraint>) => {
    onConstraintsChange(
      constraints.map(c => c.id === id ? { ...c, ...updates } : c)
    )
  }

  const deleteConstraint = (id: string) => {
    onConstraintsChange(constraints.filter(c => c.id !== id))
  }

  const groupedConstraints = constraints.reduce((acc, constraint) => {
    if (!acc[constraint.level]) {
      acc[constraint.level] = []
    }
    acc[constraint.level].push(constraint)
    return acc
  }, {} as Record<ConstraintLevel, PortfolioConstraint[]>)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock size={20} className="text-accent" />
          Portfolio Constraints
        </CardTitle>
        <CardDescription>
          Define hard and soft constraints for portfolio construction
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Select value={selectedLevel} onValueChange={(v) => setSelectedLevel(v as ConstraintLevel)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {constraintLevels.map(level => (
                <SelectItem key={level.value} value={level.value}>
                  {level.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => addConstraint(selectedLevel)} size="sm">
            <Plus size={16} className="mr-2" />
            Add Constraint
          </Button>
        </div>

        <Separator />

        <div className="space-y-6">
          {constraintLevels.map(({ value: level, label }) => {
            const levelConstraints = groupedConstraints[level] || []
            if (levelConstraints.length === 0) return null

            return (
              <div key={level} className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground">{label}</h4>
                <div className="space-y-3">
                  {levelConstraints.map(constraint => (
                    <div
                      key={constraint.id}
                      className={cn(
                        'p-4 rounded-lg border bg-card transition-colors',
                        !constraint.enabled && 'opacity-50',
                        constraint.type === 'hard' ? 'border-destructive/30' : 'border-warning/30'
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-center gap-2">
                            <Input
                              value={constraint.name}
                              onChange={(e) => updateConstraint(constraint.id, { name: e.target.value })}
                              className="flex-1 h-8 text-sm"
                              placeholder="Constraint name"
                            />
                            <Badge
                              variant={constraint.type === 'hard' ? 'destructive' : 'secondary'}
                              className="whitespace-nowrap"
                            >
                              {constraint.type === 'hard' ? (
                                <><Lock size={12} className="mr-1" /> Hard</>
                              ) : (
                                <><Warning size={12} className="mr-1" /> Soft</>
                              )}
                            </Badge>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Operator</Label>
                              <Select
                                value={constraint.operator}
                                onValueChange={(v) => updateConstraint(constraint.id, { operator: v as PortfolioConstraint['operator'] })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value=">">Greater than (&gt;)</SelectItem>
                                  <SelectItem value="<">Less than (&lt;)</SelectItem>
                                  <SelectItem value=">=">Greater or equal (≥)</SelectItem>
                                  <SelectItem value="<=">Less or equal (≤)</SelectItem>
                                  <SelectItem value="=">Equal (=)</SelectItem>
                                  <SelectItem value="between">Between</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">
                                {constraint.operator === 'between' ? 'Min Value' : 'Value'}
                              </Label>
                              <Input
                                type="number"
                                value={constraint.value}
                                onChange={(e) => updateConstraint(constraint.id, { value: parseFloat(e.target.value) || 0 })}
                                className="h-8"
                                step="0.01"
                              />
                            </div>

                            {constraint.operator === 'between' && (
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">Max Value</Label>
                                <Input
                                  type="number"
                                  value={constraint.value2 || 0}
                                  onChange={(e) => updateConstraint(constraint.id, { value2: parseFloat(e.target.value) || 0 })}
                                  className="h-8"
                                  step="0.01"
                                />
                              </div>
                            )}

                            <div className="space-y-1.5">
                              <Label className="text-xs text-muted-foreground">Unit</Label>
                              <Select
                                value={constraint.unit || '%'}
                                onValueChange={(v) => updateConstraint(constraint.id, { unit: v as PortfolioConstraint['unit'] })}
                              >
                                <SelectTrigger className="h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="%">Percentage (%)</SelectItem>
                                  <SelectItem value="$">Dollar ($)</SelectItem>
                                  <SelectItem value="years">Years</SelectItem>
                                  <SelectItem value="score">Score</SelectItem>
                                  <SelectItem value="rating">Rating</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2">
                                <Label htmlFor={`type-${constraint.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                  Constraint Type:
                                </Label>
                                <Select
                                  value={constraint.type}
                                  onValueChange={(v) => updateConstraint(constraint.id, { type: v as ConstraintType })}
                                >
                                  <SelectTrigger id={`type-${constraint.id}`} className="h-7 w-24">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="hard">Hard</SelectItem>
                                    <SelectItem value="soft">Soft</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {constraint.type === 'soft' && (
                                <div className="flex items-center gap-2">
                                  <Label htmlFor={`penalty-${constraint.id}`} className="text-xs text-muted-foreground">
                                    Penalty:
                                  </Label>
                                  <Input
                                    id={`penalty-${constraint.id}`}
                                    type="number"
                                    value={constraint.penalty || 0}
                                    onChange={(e) => updateConstraint(constraint.id, { penalty: parseFloat(e.target.value) || 0 })}
                                    className="h-7 w-20"
                                    step="0.1"
                                  />
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <Switch
                                id={`enabled-${constraint.id}`}
                                checked={constraint.enabled}
                                onCheckedChange={(enabled) => updateConstraint(constraint.id, { enabled })}
                              />
                              <Label htmlFor={`enabled-${constraint.id}`} className="text-xs text-muted-foreground cursor-pointer">
                                Enabled
                              </Label>
                            </div>
                          </div>

                          {constraint.description && (
                            <p className="text-xs text-muted-foreground">{constraint.description}</p>
                          )}
                        </div>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteConstraint(constraint.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}

          {constraints.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Lock size={48} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">No constraints defined</p>
              <p className="text-xs mt-1">Add constraints to control portfolio construction</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
