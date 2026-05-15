import { CellContract, ValidationResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { CheckCircle, XCircle, Warning, ArrowRight, ListChecks } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CellContractDisplayProps {
  contract: CellContract
  validationResult?: ValidationResult
  compact?: boolean
}

export function CellContractDisplay({ contract, validationResult, compact = false }: CellContractDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {contract.description && (
          <Badge variant="secondary" className="max-w-full truncate text-xs">
            {contract.description}
          </Badge>
        )}
        {contract.inputs.length > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <ArrowRight size={12} className="text-primary" />
            {contract.inputs.length} input{contract.inputs.length > 1 ? 's' : ''}
          </Badge>
        )}
        {contract.outputs.length > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <ArrowRight size={12} className="text-accent rotate-180" />
            {contract.outputs.length} output{contract.outputs.length > 1 ? 's' : ''}
          </Badge>
        )}
        {contract.validation.length > 0 && (
          <Badge variant="outline" className="text-xs gap-1">
            <ListChecks size={12} className="text-secondary" />
            {contract.validation.length} rule{contract.validation.length > 1 ? 's' : ''}
          </Badge>
        )}
        <Badge variant="secondary" className="text-xs">
          {contract.failureBehavior}
        </Badge>
        {contract.tags?.slice(0, 2).map(tag => (
          <Badge key={tag} variant="outline" className="text-xs">
            #{tag}
          </Badge>
        ))}
        {validationResult && !validationResult.valid && (
          <Badge variant="destructive" className="text-xs gap-1">
            <XCircle size={12} weight="fill" />
            {validationResult.errors.length} error{validationResult.errors.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>
    )
  }

  return (
    <Card className="p-3 bg-accent/5 border-accent/30">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold">Contract</h4>
          {validationResult && (
            <div className="flex items-center gap-1">
              {validationResult.valid ? (
                <Badge variant="outline" className="gap-1 text-xs">
                  <CheckCircle size={12} weight="fill" className="text-green-600" />
                  Valid
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1 text-xs">
                  <XCircle size={12} weight="fill" />
                  {validationResult.errors.length} Error{validationResult.errors.length > 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          )}
        </div>

        {contract.description && (
          <p className="text-xs text-muted-foreground">{contract.description}</p>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <div className="font-medium mb-1.5 flex items-center gap-1">
              <ArrowRight size={12} className="text-primary" />
              Inputs ({contract.inputs.length})
            </div>
            <div className="space-y-1">
              {contract.inputs.map((input, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={cn("font-mono", input.required && "font-semibold")}>
                    {input.name}
                  </span>
                  <Badge variant="outline" className="text-xs h-5">
                    {input.type}
                  </Badge>
                </div>
              ))}
              {contract.inputs.length === 0 && (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>

          <div>
            <div className="font-medium mb-1.5 flex items-center gap-1">
              <ArrowRight size={12} className="text-accent rotate-180" />
              Outputs ({contract.outputs.length})
            </div>
            <div className="space-y-1">
              {contract.outputs.map((output, i) => (
                <div key={i} className="flex items-center justify-between">
                  <span className={cn("font-mono", output.required && "font-semibold")}>
                    {output.name}
                  </span>
                  <Badge variant="outline" className="text-xs h-5">
                    {output.type}
                  </Badge>
                </div>
              ))}
              {contract.outputs.length === 0 && (
                <span className="text-muted-foreground">None</span>
              )}
            </div>
          </div>
        </div>

        {(contract.requiredContext.length > 0 || contract.requiredFields.length > 0) && (
          <>
            <Separator />
            <div className="space-y-1.5">
              {contract.requiredContext.length > 0 && (
                <div>
                  <div className="font-medium text-xs mb-1">Required Context:</div>
                  <div className="flex gap-1 flex-wrap">
                    {contract.requiredContext.map((ctx, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {ctx}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              {contract.requiredFields.length > 0 && (
                <div>
                  <div className="font-medium text-xs mb-1">Required Fields:</div>
                  <div className="flex gap-1 flex-wrap">
                    {contract.requiredFields.map((field, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {contract.validation.length > 0 && (
          <>
            <Separator />
            <div>
              <div className="font-medium text-xs mb-1.5 flex items-center gap-1">
                <ListChecks size={12} className="text-secondary" />
                Validation Rules ({contract.validation.length})
              </div>
              <div className="space-y-1">
                {contract.validation.map((rule, i) => (
                  <div key={rule.id} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {rule.type}
                    </Badge>
                    {rule.message && (
                      <span className="text-xs text-muted-foreground">{rule.message}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">On Failure:</span>
          <Badge variant="secondary">{contract.failureBehavior}</Badge>
        </div>

        {contract.tags && contract.tags.length > 0 && (
          <div className="flex gap-1 flex-wrap pt-1">
            {contract.tags.map((tag, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}

        {validationResult && validationResult.errors.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="font-medium text-xs text-destructive flex items-center gap-1">
                <XCircle size={12} weight="fill" />
                Validation Errors
              </div>
              {validationResult.errors.map((error, i) => (
                <div key={i} className="text-xs text-destructive bg-destructive/10 p-1.5 rounded">
                  <span className="font-mono">{error.field}</span>: {error.message}
                </div>
              ))}
            </div>
          </>
        )}

        {validationResult && validationResult.warnings.length > 0 && (
          <>
            <Separator />
            <div className="space-y-1">
              <div className="font-medium text-xs text-warning flex items-center gap-1">
                <Warning size={12} weight="fill" />
                Warnings
              </div>
              {validationResult.warnings.map((warning, i) => (
                <div key={i} className="text-xs text-warning bg-warning/10 p-1.5 rounded">
                  <span className="font-mono">{warning.field}</span>: {warning.message}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Card>
  )
}
