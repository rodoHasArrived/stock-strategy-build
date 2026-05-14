import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Switch } from '@/components/ui/switch'
import { Plus, Trash, Check, X } from '@phosphor-icons/react'
import { CellContract, TypedField, ValidationRule, DataType, FailureBehavior } from '@/lib/types'

interface CellContractEditorProps {
  contract?: CellContract
  onChange: (contract: CellContract) => void
  onClose: () => void
}

const defaultContract = (): CellContract => ({
  inputs: [],
  outputs: [],
  requiredContext: [],
  requiredFields: [],
  validation: [],
  failureBehavior: 'halt'
})

const dataTypes: DataType[] = ['string', 'number', 'boolean', 'array', 'object', 'dataframe', 'series', 'any']
const failureBehaviors: FailureBehavior[] = ['halt', 'skip', 'retry', 'default', 'warn']
const validationTypes = ['range', 'pattern', 'custom', 'required', 'type', 'length'] as const

export function CellContractEditor({ contract, onChange, onClose }: CellContractEditorProps) {
  const [localContract, setLocalContract] = useState<CellContract>(contract || defaultContract())

  const handleInputChange = (index: number, field: Partial<TypedField>) => {
    const newInputs = [...localContract.inputs]
    newInputs[index] = { ...newInputs[index], ...field }
    setLocalContract({ ...localContract, inputs: newInputs })
  }

  const handleOutputChange = (index: number, field: Partial<TypedField>) => {
    const newOutputs = [...localContract.outputs]
    newOutputs[index] = { ...newOutputs[index], ...field }
    setLocalContract({ ...localContract, outputs: newOutputs })
  }

  const handleValidationChange = (index: number, rule: Partial<ValidationRule>) => {
    const newValidation = [...localContract.validation]
    newValidation[index] = { ...newValidation[index], ...rule }
    setLocalContract({ ...localContract, validation: newValidation })
  }

  const addInput = () => {
    setLocalContract({
      ...localContract,
      inputs: [...localContract.inputs, { name: '', type: 'any', required: false }]
    })
  }

  const addOutput = () => {
    setLocalContract({
      ...localContract,
      outputs: [...localContract.outputs, { name: '', type: 'any', required: false }]
    })
  }

  const addValidation = () => {
    setLocalContract({
      ...localContract,
      validation: [...localContract.validation, { id: `rule-${Date.now()}`, type: 'required', message: '' }]
    })
  }

  const removeInput = (index: number) => {
    setLocalContract({
      ...localContract,
      inputs: localContract.inputs.filter((_, i) => i !== index)
    })
  }

  const removeOutput = (index: number) => {
    setLocalContract({
      ...localContract,
      outputs: localContract.outputs.filter((_, i) => i !== index)
    })
  }

  const removeValidation = (index: number) => {
    setLocalContract({
      ...localContract,
      validation: localContract.validation.filter((_, i) => i !== index)
    })
  }

  const handleSave = () => {
    onChange(localContract)
    onClose()
  }

  return (
    <Card className="border-2 border-accent/50">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Cell Contract</CardTitle>
            <CardDescription className="text-xs mt-1">
              Define types, validation, and execution behavior
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              <X size={16} className="mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              <Check size={16} className="mr-1" />
              Save
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="inputs" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inputs">Inputs</TabsTrigger>
            <TabsTrigger value="outputs">Outputs</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="behavior">Behavior</TabsTrigger>
          </TabsList>

          <TabsContent value="inputs" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Input Fields</Label>
              <Button size="sm" variant="outline" onClick={addInput}>
                <Plus size={14} className="mr-1" />
                Add Input
              </Button>
            </div>
            
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-3">
                {localContract.inputs.map((input, index) => (
                  <Card key={index} className="p-3 bg-muted/30">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          placeholder="Field name"
                          value={input.name}
                          onChange={(e) => handleInputChange(index, { name: e.target.value })}
                          className="flex-1 h-8 mr-2"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeInput(index)}>
                          <Trash size={14} />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={input.type}
                            onValueChange={(value: DataType) => handleInputChange(index, { type: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dataTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-5">
                          <Switch
                            checked={input.required}
                            onCheckedChange={(checked) => handleInputChange(index, { required: checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      
                      <Input
                        placeholder="Description (optional)"
                        value={input.description || ''}
                        onChange={(e) => handleInputChange(index, { description: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </Card>
                ))}
                
                {localContract.inputs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No inputs defined. Click "Add Input" to start.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="outputs" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Output Fields</Label>
              <Button size="sm" variant="outline" onClick={addOutput}>
                <Plus size={14} className="mr-1" />
                Add Output
              </Button>
            </div>
            
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-3">
                {localContract.outputs.map((output, index) => (
                  <Card key={index} className="p-3 bg-muted/30">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          placeholder="Field name"
                          value={output.name}
                          onChange={(e) => handleOutputChange(index, { name: e.target.value })}
                          className="flex-1 h-8 mr-2"
                        />
                        <Button size="sm" variant="ghost" onClick={() => removeOutput(index)}>
                          <Trash size={14} />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                            value={output.type}
                            onValueChange={(value: DataType) => handleOutputChange(index, { type: value })}
                          >
                            <SelectTrigger className="h-8">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {dataTypes.map((type) => (
                                <SelectItem key={type} value={type}>
                                  {type}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        <div className="flex items-center gap-2 pt-5">
                          <Switch
                            checked={output.required}
                            onCheckedChange={(checked) => handleOutputChange(index, { required: checked })}
                          />
                          <Label className="text-xs">Required</Label>
                        </div>
                      </div>
                      
                      <Input
                        placeholder="Description (optional)"
                        value={output.description || ''}
                        onChange={(e) => handleOutputChange(index, { description: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </Card>
                ))}
                
                {localContract.outputs.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No outputs defined. Click "Add Output" to start.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="validation" className="space-y-3 mt-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Validation Rules</Label>
              <Button size="sm" variant="outline" onClick={addValidation}>
                <Plus size={14} className="mr-1" />
                Add Rule
              </Button>
            </div>
            
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-3">
                {localContract.validation.map((rule, index) => (
                  <Card key={index} className="p-3 bg-muted/30">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Select
                          value={rule.type}
                          onValueChange={(value) => handleValidationChange(index, { type: value as any })}
                        >
                          <SelectTrigger className="flex-1 h-8 mr-2">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {validationTypes.map((type) => (
                              <SelectItem key={type} value={type}>
                                {type}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button size="sm" variant="ghost" onClick={() => removeValidation(index)}>
                          <Trash size={14} />
                        </Button>
                      </div>
                      
                      <Input
                        placeholder="Error message"
                        value={rule.message}
                        onChange={(e) => handleValidationChange(index, { message: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </Card>
                ))}
                
                {localContract.validation.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    No validation rules defined. Click "Add Rule" to start.
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="behavior" className="space-y-3 mt-4">
            <div>
              <Label className="text-sm font-medium">Failure Behavior</Label>
              <p className="text-xs text-muted-foreground mb-3">
                How should the cell handle validation failures?
              </p>
              <Select
                value={localContract.failureBehavior}
                onValueChange={(value: FailureBehavior) => 
                  setLocalContract({ ...localContract, failureBehavior: value })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {failureBehaviors.map((behavior) => (
                    <SelectItem key={behavior} value={behavior}>
                      {behavior}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-sm font-medium">Required Context Variables</Label>
              <p className="text-xs text-muted-foreground mb-3">
                Variables that must exist in context before execution
              </p>
              <Input
                placeholder="Comma-separated variable names"
                value={localContract.requiredContext?.join(', ') || ''}
                onChange={(e) => 
                  setLocalContract({ 
                    ...localContract, 
                    requiredContext: e.target.value.split(',').map(v => v.trim()).filter(Boolean)
                  })
                }
                className="h-9"
              />
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
