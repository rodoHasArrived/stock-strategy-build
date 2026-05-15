import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Strategy, StrategySetupDraft } from '@/lib/types'
import { createStrategyFromDraft, defaultStrategySetupDraft } from '@/lib/strategyDesign'
import { FlowArrow, Sparkle } from '@phosphor-icons/react'

interface StrategySetupWizardProps {
  onCreateStrategy: (strategy: Strategy) => void
}

export function StrategySetupWizard({ onCreateStrategy }: StrategySetupWizardProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<StrategySetupDraft>(() => defaultStrategySetupDraft())

  const updateDraft = (updates: Partial<StrategySetupDraft>) => {
    setDraft(current => ({ ...current, ...updates }))
  }

  const handleCreate = () => {
    onCreateStrategy(createStrategyFromDraft(draft))
    setOpen(false)
    setDraft(defaultStrategySetupDraft())
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sparkle size={16} className="mr-2" weight="duotone" />
          Setup Wizard
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FlowArrow size={22} className="text-accent" weight="duotone" />
            Strategy Setup Wizard
          </DialogTitle>
          <DialogDescription>
            Generate an editable starter workflow with purpose-specific cells, parameters, and output contracts.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Strategy family</Label>
            <Select value={draft.family} onValueChange={(value: StrategySetupDraft['family']) => updateDraft({ family: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed-income-yield">Fixed-income yield</SelectItem>
                <SelectItem value="equity-momentum">Equity momentum</SelectItem>
                <SelectItem value="allocation">Target allocation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Asset universe</Label>
            <Select value={draft.universe} onValueChange={(value: StrategySetupDraft['universe']) => updateDraft({ universe: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="investment-grade">Investment-grade credit</SelectItem>
                <SelectItem value="equity-factors">Equity factors</SelectItem>
                <SelectItem value="multi-asset">Multi-asset sleeves</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Dataset fit</Label>
            <Select value={draft.datasetFit} onValueChange={(value: StrategySetupDraft['datasetFit']) => updateDraft({ datasetFit: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fixture">Use bundled fixture fit</SelectItem>
                <SelectItem value="custom">Custom data later</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Output mode</Label>
            <Select value={draft.outputMode} onValueChange={(value: StrategySetupDraft['outputMode']) => updateDraft({ outputMode: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trade-signal">Buy/sell/hold signal</SelectItem>
                <SelectItem value="target-allocation">Target allocation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Rebalance cadence</Label>
            <Select value={draft.rebalanceCadence} onValueChange={(value: StrategySetupDraft['rebalanceCadence']) => updateDraft({ rebalanceCadence: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="flex h-full items-center justify-between gap-4 p-4">
              <div>
                <Label>Risk controls</Label>
                <p className="mt-1 text-xs text-muted-foreground">Include a dedicated risk pass/fail stage before final output.</p>
              </div>
              <Switch
                checked={draft.includeRiskControls}
                onCheckedChange={(checked) => updateDraft({ includeRiskControls: checked })}
              />
            </CardContent>
          </Card>
        </div>

        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-3 text-sm font-medium">Generated workflow</div>
          <div className="flex flex-wrap gap-2">
            {['Universe', 'Data', draft.family === 'equity-momentum' ? 'Calculation' : 'Ranking', draft.includeRiskControls ? 'Risk' : null, 'Portfolio', draft.outputMode === 'target-allocation' ? 'Allocation' : 'Trade']
              .filter(Boolean)
              .map(step => (
                <Badge key={String(step)} variant="secondary">{step}</Badge>
              ))}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleCreate}>Create Strategy</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
