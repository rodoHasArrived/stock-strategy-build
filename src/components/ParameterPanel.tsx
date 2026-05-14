import { useState } from 'react'
import { Parameter } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash, Sliders } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'

interface ParameterPanelProps {
  parameters: Parameter[]
  onParametersChange: (parameters: Parameter[]) => void
}

export function ParameterPanel({ parameters, onParametersChange }: ParameterPanelProps) {
  const [newParam, setNewParam] = useState({
    name: '',
    type: 'number' as 'number' | 'text' | 'boolean',
    value: '' as string | number,
    description: ''
  })

  const addParameter = () => {
    if (!newParam.name) return

    const param: Parameter = {
      id: `param-${Date.now()}`,
      name: newParam.name,
      type: newParam.type,
      value: newParam.type === 'number' ? parseFloat(String(newParam.value)) || 0 : newParam.value,
      description: newParam.description
    }

    onParametersChange([...parameters, param])
    setNewParam({ name: '', type: 'number', value: '', description: '' })
  }

  const updateParameter = (id: string, value: number | string) => {
    onParametersChange(
      parameters.map(p =>
        p.id === id ? { ...p, value } : p
      )
    )
  }

  const removeParameter = (id: string) => {
    onParametersChange(parameters.filter(p => p.id !== id))
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sliders size={20} weight="duotone" />
          Parameters
        </CardTitle>
        <CardDescription>
          Define reusable values referenced as ${'{name}'} in formulas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {parameters.map((param) => (
              <Card key={param.id} className="p-3">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Label className="font-mono text-sm">${'{' + param.name + '}'}</Label>
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                          {param.type}
                        </Badge>
                      </div>
                      {param.description && (
                        <p className="text-xs text-muted-foreground mt-1">{param.description}</p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removeParameter(param.id)}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash size={14} />
                    </Button>
                  </div>
                  <Input
                    type={param.type === 'number' ? 'number' : 'text'}
                    value={param.value}
                    onChange={(e) => updateParameter(param.id, param.type === 'number' ? parseFloat(e.target.value) : e.target.value)}
                    className="h-8 font-mono"
                  />
                </div>
              </Card>
            ))}
          </div>
        </ScrollArea>

        <div className="space-y-3 pt-3 border-t">
          <h4 className="text-sm font-medium">Add New Parameter</h4>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="param-name" className="text-xs">Name</Label>
              <Input
                id="param-name"
                placeholder="fundingCost"
                value={newParam.name}
                onChange={(e) => setNewParam({ ...newParam, name: e.target.value })}
                className="h-8"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="param-type" className="text-xs">Type</Label>
                <Select
                  value={newParam.type}
                  onValueChange={(value: 'number' | 'text' | 'boolean') =>
                    setNewParam({ ...newParam, type: value })
                  }
                >
                  <SelectTrigger id="param-type" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="boolean">Boolean</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="param-value" className="text-xs">Default Value</Label>
                <Input
                  id="param-value"
                  type={newParam.type === 'number' ? 'number' : 'text'}
                  placeholder={newParam.type === 'number' ? '0' : 'value'}
                  value={newParam.value}
                  onChange={(e) => setNewParam({ ...newParam, value: e.target.value })}
                  className="h-8"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="param-desc" className="text-xs">Description (optional)</Label>
              <Input
                id="param-desc"
                placeholder="Cost of financing (%)"
                value={newParam.description}
                onChange={(e) => setNewParam({ ...newParam, description: e.target.value })}
                className="h-8"
              />
            </div>
            <Button onClick={addParameter} size="sm" className="w-full">
              <Plus size={16} weight="bold" className="mr-1" />
              Add Parameter
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
