import { useState } from 'react'
import { Condition, ConditionOperator, ConditionLogic } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash, DotsSixVertical } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { FieldPicker } from '@/components/FieldPicker'

interface VisualBuilderProps {
  conditions: Condition[]
  onConditionsChange: (conditions: Condition[]) => void
}

const DATA_FIELDS = [
  { value: 'PRICE', label: 'Price', type: 'number' },
  { value: 'YIELD', label: 'Yield', type: 'number' },
  { value: 'COUPON', label: 'Coupon', type: 'number' },
  { value: 'DURATION', label: 'Duration', type: 'number' },
  { value: 'SPREAD', label: 'Spread', type: 'number' },
  { value: 'RATING', label: 'Rating', type: 'text' },
  { value: 'SECTOR', label: 'Sector', type: 'text' },
  { value: 'MATURITY', label: 'Maturity', type: 'text' },
]

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: '>', label: '>' },
  { value: '<', label: '<' },
  { value: '>=', label: '>=' },
  { value: '<=', label: '<=' },
  { value: '=', label: '=' },
  { value: '!=', label: '!=' },
  { value: 'between', label: 'between' },
]

export function VisualBuilder({ conditions, onConditionsChange }: VisualBuilderProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null)

  const addCondition = () => {
    const newCondition: Condition = {
      id: `cond-${Date.now()}`,
      field: 'PRICE',
      operator: '>',
      value: 100,
      logic: conditions.length > 0 ? 'AND' : undefined,
    }
    onConditionsChange([...conditions, newCondition])
  }

  const updateCondition = (index: number, updates: Partial<Condition>) => {
    const newConditions = [...conditions]
    newConditions[index] = { ...newConditions[index], ...updates }
    onConditionsChange(newConditions)
  }

  const deleteCondition = (index: number) => {
    const newConditions = conditions.filter((_, i) => i !== index)
    if (newConditions.length > 0 && newConditions[0].logic) {
      newConditions[0] = { ...newConditions[0], logic: undefined }
    }
    onConditionsChange(newConditions)
  }

  const handleDragStart = (index: number) => {
    setDraggedIndex(index)
  }

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedIndex === null || draggedIndex === index) return

    const newConditions = [...conditions]
    const draggedItem = newConditions[draggedIndex]
    newConditions.splice(draggedIndex, 1)
    newConditions.splice(index, 0, draggedItem)

    if (newConditions[0].logic) {
      newConditions[0] = { ...newConditions[0], logic: undefined }
    }
    if (newConditions.length > 1 && !newConditions[1].logic) {
      newConditions[1] = { ...newConditions[1], logic: 'AND' }
    }

    onConditionsChange(newConditions)
    setDraggedIndex(index)
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
  }

  const getFieldType = (field: string) => {
    return DATA_FIELDS.find(f => f.value === field)?.type || 'number'
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Conditions</h4>
        <Button
          size="sm"
          variant="outline"
          onClick={addCondition}
        >
          <Plus size={16} className="mr-1" />
          Add Condition
        </Button>
      </div>

      {conditions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground mb-3">
            No conditions yet. Add conditions to filter securities.
          </p>
          <Button onClick={addCondition} variant="outline">
            <Plus size={16} className="mr-2" />
            Add First Condition
          </Button>
        </Card>
      ) : (
        <div className="space-y-2">
          {conditions.map((condition, index) => (
            <div key={condition.id} className="space-y-2">
              {index > 0 && condition.logic && (
                <div className="flex items-center gap-2 pl-4">
                  <div className="h-4 w-px bg-border" />
                  <Select
                    value={condition.logic}
                    onValueChange={(value: ConditionLogic) => 
                      updateCondition(index, { logic: value })
                    }
                  >
                    <SelectTrigger className="w-20 h-7 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AND">AND</SelectItem>
                      <SelectItem value="OR">OR</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Card
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className={cn(
                  'p-3 cursor-move transition-all hover:shadow-md',
                  draggedIndex === index && 'opacity-50',
                )}
              >
                <div className="flex items-start gap-2">
                  <div className="mt-2 cursor-grab active:cursor-grabbing">
                    <DotsSixVertical size={20} className="text-muted-foreground" />
                  </div>

                  <div className="flex-1 grid grid-cols-[1fr_auto_1fr] gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Field
                      </label>
                      <FieldPicker
                        value={condition.field}
                        onSelect={(field) => updateCondition(index, { field: field.function })}
                        placeholder="Select field..."
                        triggerClassName="h-9 w-full"
                      />
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Operator
                      </label>
                      <Select
                        value={condition.operator}
                        onValueChange={(value: ConditionOperator) => 
                          updateCondition(index, { operator: value })
                        }
                      >
                        <SelectTrigger className="h-9 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {OPERATORS.map(op => (
                            <SelectItem key={op.value} value={op.value}>
                              {op.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        Value
                      </label>
                      <div className="flex gap-2">
                        <Input
                          type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                          value={condition.value}
                          onChange={(e) => {
                            const value = getFieldType(condition.field) === 'number'
                              ? parseFloat(e.target.value) || 0
                              : e.target.value
                            updateCondition(index, { value })
                          }}
                          className="h-9"
                          placeholder="Value"
                        />
                        {condition.operator === 'between' && (
                          <Input
                            type={getFieldType(condition.field) === 'number' ? 'number' : 'text'}
                            value={condition.value2 || ''}
                            onChange={(e) => {
                              const value2: number | string = getFieldType(condition.field) === 'number'
                                ? parseFloat(e.target.value) || 0
                                : e.target.value
                              updateCondition(index, { value2 })
                            }}
                            className="h-9"
                            placeholder="Max"
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteCondition(index)}
                    className="mt-6"
                  >
                    <Trash size={16} className="text-destructive" />
                  </Button>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}

      {conditions.length > 0 && (
        <Card className="p-3 bg-muted/50">
          <div className="text-xs font-mono text-muted-foreground">
            <span className="text-foreground font-semibold">Generated Code:</span>
            <pre className="mt-2 whitespace-pre-wrap">
              {conditions.map((c, i) => {
                const logic = i > 0 && c.logic ? ` ${c.logic.toLowerCase()} ` : ''
                const condition = c.operator === 'between'
                  ? `${c.field}(cusip) >= ${c.value} and ${c.field}(cusip) <= ${c.value2}`
                  : `${c.field}(cusip) ${c.operator} ${typeof c.value === 'string' ? `"${c.value}"` : c.value}`
                return `${i > 0 ? '\n' : ''}${logic}${condition}`
              }).join('')}
            </pre>
          </div>
        </Card>
      )}
    </div>
  )
}
