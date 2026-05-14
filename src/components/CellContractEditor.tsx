import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switc
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
  contract?: CellContract
  onClose: () => void

  inputs: [],
  requiredContext: [],
  validation: [],

})
const dataTypes: DataType
const validationTypes = ['range', 'pattern',
export function CellC


    setLocalContract({ ...localContract, input

    const newO
    setLocalContract({

    const newVali
    setLocalContract({ ...

    setLoc
  

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

    })
    setLocalContract({
  const handleSave = ()
      outputs: [...localContract.outputs, { name: '', type: 'any', required: false }]
  }
  }

  const addValidation = () => {
          <div>
      ...localContract,
              Define types, validation, and execution behavior
    })
  }

              Cancel
    setLocalContract({
              <Check si
      inputs: localContract.inputs.filter((_, i) => i !== index)
      
   

  const removeOutput = (index: number) => {
    setLocalContract({
      ...localContract,
      outputs: localContract.outputs.filter((_, i) => i !== index)
    })
  }

              <Button size="sm" variant="outlin
    setLocalContract({
              </Button>
      validation: localContract.validation.filter((_, i) => i !== index)
      
   

  const handleSave = () => {
    onChange(localContract)
    onClose()
  }

          
    <Card className="border-2 border-accent/50">
                      </div>
        <div className="flex items-center justify-between">
               
            <CardTitle className="text-lg">Cell Contract</CardTitle>
            <CardDescription className="text-xs mt-1">
              Define types, validation, and execution behavior
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              <X size={16} className="mr-1" />
              Cancel
                     
            <Button size="sm" onClick={handleSave}>
                        
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
                Ad
            
            <ScrollArea className="h-64 pr-3">
              <div className="space-y-3">
                {localContract.inputs.map((input, index) => (
                  <Card key={index} className="p-3 bg-muted/30">
                      <div className="flex item
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
                            <
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
                        placehold
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
            <div class
                <Plus size={
                        placeholder="Description (optional)"
                        value={input.description || ''}
                        onChange={(e) => handleInputChange(index, { description: e.target.value })}
                        className="h-8 text-xs"
                      />
                    </div>
                  </Card>
                   
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
                       
            </div>
            
            <ScrollArea className="h-64 pr-3">
                            onChange={(e)
                {localContract.outputs.map((output, index) => (
                  <Card key={index} className="p-3 bg-muted/30">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Input
                          placeholder="Field name"
                          value={output.name}
                          onChange={(e) => handleOutputChange(index, { name: e.target.value })}
                          className="flex-1 h-8 mr-2"
                      )}
                        <Button size="sm" variant="ghost" onClick={() => removeOutput(index)}>
                        placeholder="Error me
                        </Button>
                        clas
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">Type</Label>
                          <Select
                )}
                            onValueChange={(value: DataType) => handleOutputChange(index, { type: value })}
          </TabsContent>
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











































































































































































































