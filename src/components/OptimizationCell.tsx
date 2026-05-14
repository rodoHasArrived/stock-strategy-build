import { OptimizationConfig, OptimizationObjective } from '@/lib/types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { Target, TrendUp, ShieldCheck, ChartLine, Function } from '@phosphor-icons/react'

interface OptimizationCellProps {
  config: OptimizationConfig
  onConfigChange: (config: OptimizationConfig) => void
}

const objectives: { value: OptimizationObjective; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'maximize_yield',
    label: 'Maximize Yield',
    icon: <TrendUp size={20} className="text-success" />,
    description: 'Find the highest yielding portfolio within constraints'
  },
  {
    value: 'maximize_return',
    label: 'Maximize Total Return',
    icon: <ChartLine size={20} className="text-accent" />,
    description: 'Optimize for total expected return including price appreciation'
  },
  {
    value: 'minimize_risk',
    label: 'Minimize Risk',
    icon: <ShieldCheck size={20} className="text-warning" />,
    description: 'Minimize portfolio volatility and downside risk'
  },
  {
    value: 'minimize_tracking_error',
    label: 'Minimize Tracking Error',
    icon: <Target size={20} className="text-chart-2" />,
    description: 'Stay as close as possible to benchmark composition'
  },
  {
    value: 'custom_score',
    label: 'Custom Score',
    icon: <Function size={20} className="text-primary" />,
    description: 'Use a custom optimization formula'
  }
]

const commonConstraints = [
  { id: 'duration', label: 'Duration limit', description: 'Portfolio duration <= max' },
  { id: 'issuer', label: 'Issuer concentration', description: 'Max exposure per issuer' },
  { id: 'sector', label: 'Sector exposure', description: 'Max exposure per sector' },
  { id: 'rating', label: 'Rating floor', description: 'Minimum credit rating' },
  { id: 'turnover', label: 'Turnover limit', description: 'Maximum portfolio turnover' },
  { id: 'position', label: 'Position weight', description: 'Max weight per position' },
  { id: 'liquidity', label: 'Liquidity requirement', description: 'Minimum liquidity score' }
]

export function OptimizationCell({ config, onConfigChange }: OptimizationCellProps) {
  const toggleConstraint = (constraintId: string) => {
    const newConstraints = config.constraints.includes(constraintId)
      ? config.constraints.filter(id => id !== constraintId)
      : [...config.constraints, constraintId]
    
    onConfigChange({ ...config, constraints: newConstraints })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target size={20} className="text-accent" />
          Portfolio Optimization
        </CardTitle>
        <CardDescription>
          Configure optimization objective and constraints
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-semibold">Optimization Objective</Label>
            <Badge variant={config.enabled ? 'default' : 'secondary'}>
              {config.enabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          <RadioGroup
            value={config.objective}
            onValueChange={(value) => onConfigChange({ ...config, objective: value as OptimizationObjective })}
          >
            <div className="space-y-3">
              {objectives.map(({ value, label, icon, description }) => (
                <div
                  key={value}
                  className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors cursor-pointer"
                  onClick={() => onConfigChange({ ...config, objective: value })}
                >
                  <RadioGroupItem value={value} id={value} className="mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {icon}
                      <Label htmlFor={value} className="font-medium cursor-pointer">
                        {label}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </RadioGroup>

          {config.objective === 'custom_score' && (
            <div className="space-y-2 pt-2">
              <Label htmlFor="custom-objective" className="text-sm">Custom Objective Formula</Label>
              <Textarea
                id="custom-objective"
                value={config.customObjective || ''}
                onChange={(e) => onConfigChange({ ...config, customObjective: e.target.value })}
                placeholder="e.g., 0.6 * yield + 0.3 * quality_score - 0.1 * duration"
                className="font-mono text-sm min-h-20"
              />
              <p className="text-xs text-muted-foreground">
                Define a custom scoring formula using available metrics
              </p>
            </div>
          )}
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-sm font-semibold">Constraints</Label>
          <div className="space-y-2">
            {commonConstraints.map(({ id, label, description }) => (
              <div
                key={id}
                className="flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/5 transition-colors"
              >
                <Checkbox
                  id={`constraint-${id}`}
                  checked={config.constraints.includes(id)}
                  onCheckedChange={() => toggleConstraint(id)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <Label htmlFor={`constraint-${id}`} className="font-medium cursor-pointer">
                    {label}
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Separator />

        <div className="space-y-4">
          <Label className="text-sm font-semibold">Secondary Objective (Optional)</Label>
          <Input
            value={config.secondaryObjective || ''}
            onChange={(e) => onConfigChange({ ...config, secondaryObjective: e.target.value })}
            placeholder="e.g., Minimize tracking error to benchmark"
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Define a secondary goal to optimize when primary objective is met
          </p>
        </div>

        {config.constraints.includes('turnover') && (
          <div className="space-y-2">
            <Label htmlFor="turnover-limit" className="text-sm">Turnover Limit (%)</Label>
            <Input
              id="turnover-limit"
              type="number"
              value={config.turnoverLimit || 10}
              onChange={(e) => onConfigChange({ ...config, turnoverLimit: parseFloat(e.target.value) || 10 })}
              className="w-32"
              step="1"
              min="0"
              max="100"
            />
            <p className="text-xs text-muted-foreground">
              Maximum portfolio turnover allowed
            </p>
          </div>
        )}

        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="text-sm font-medium mb-2">Optimization Preview</h4>
          <div className="text-xs text-muted-foreground space-y-1 font-mono">
            <div><span className="text-foreground">Objective:</span> {objectives.find(o => o.value === config.objective)?.label}</div>
            <div><span className="text-foreground">Constraints:</span> {config.constraints.length === 0 ? 'None' : config.constraints.join(', ')}</div>
            {config.secondaryObjective && (
              <div><span className="text-foreground">Secondary:</span> {config.secondaryObjective}</div>
            )}
            {config.constraints.includes('turnover') && (
              <div><span className="text-foreground">Turnover:</span> ≤ {config.turnoverLimit}%</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
