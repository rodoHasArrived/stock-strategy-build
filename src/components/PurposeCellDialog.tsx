import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { CellPurpose, CodeCell } from '@/lib/types'
import { createPurposeCell, PURPOSE_OPTIONS } from '@/lib/strategyDesign'
import { Plus, SquaresFour } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface PurposeCellDialogProps {
  nextIndex: number
  onAddCell: (cell: CodeCell) => void
}

export function PurposeCellDialog({ nextIndex, onAddCell }: PurposeCellDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedPurpose, setSelectedPurpose] = useState<CellPurpose>('universe')

  const handleAdd = () => {
    onAddCell(createPurposeCell(nextIndex, selectedPurpose))
    setOpen(false)
    setSelectedPurpose('universe')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="default" variant="outline">
          <Plus size={18} className="mr-2" />
          <span className="text-sm">Add Cell</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SquaresFour size={22} className="text-accent" weight="duotone" />
            Add Purpose-Specific Cell
          </DialogTitle>
          <DialogDescription>
            Choose the role this cell plays in the investment process. The app will add starter code and an output contract.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {PURPOSE_OPTIONS.map(option => (
            <button
              key={option.purpose}
              type="button"
              onClick={() => setSelectedPurpose(option.purpose)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors hover:border-accent/60',
                selectedPurpose === option.purpose && 'border-accent bg-accent/10'
              )}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">{option.label}</div>
                {selectedPurpose === option.purpose && <Badge>Selected</Badge>}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{option.description}</p>
            </button>
          ))}
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-3 text-sm">
            Cell {nextIndex} will be added as <span className="font-medium">{PURPOSE_OPTIONS.find(option => option.purpose === selectedPurpose)?.label}</span> with editable starter logic.
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleAdd}>Add Cell</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
