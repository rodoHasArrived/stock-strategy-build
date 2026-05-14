import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Info, Warning, CheckCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'

interface CodeIssue {
  type: 'error' | 'warning' | 'info'
  line?: number
  message: string
  suggestion?: string
  example?: string
}

interface StrategyCodeHelperProps {
  code: string
  issues?: CodeIssue[]
}

export function StrategyCodeHelper({ code, issues: providedIssues }: StrategyCodeHelperProps) {
  const detectIssues = (): CodeIssue[] => {
    const detectedIssues: CodeIssue[] = []
    const lines = code.split('\n')

    lines.forEach((line, idx) => {
      const trimmed = line.trim()
      
      if (trimmed.includes('row.') && !trimmed.includes('df.data.forEach') && !trimmed.includes('forEach')) {
        detectedIssues.push({
          type: 'error',
          line: idx + 1,
          message: '⚠️ Accessing "row" directly will cause errors',
          suggestion: 'Use df.getColumn() or access through market data object',
          example: `const value = marketData.PA_Close  // Instead of: row.PA_Close`
        })
      }

      if (trimmed.includes('[index]') && !trimmed.includes('df.getColumn')) {
        detectedIssues.push({
          type: 'warning',
          line: idx + 1,
          message: 'Array access with [index] may fail',
          suggestion: 'Ensure the array exists and index is valid',
          example: `const arr = df.getColumn('Close')\nif (arr && index < arr.length) {\n  const value = arr[index]\n}`
        })
      }

      if (trimmed.includes('df.rolling') && !trimmed.includes('if')) {
        detectedIssues.push({
          type: 'info',
          line: idx + 1,
          message: 'Rolling calculations may return undefined for early periods',
          suggestion: 'Check for valid values before using',
          example: `const ma = df.rolling(20, 10).mean('Close')\nif (ma && ma[index] != null) {\n  // Use ma[index]\n}`
        })
      }

      if (trimmed.match(/return\s*{/) && !trimmed.includes('action')) {
        detectedIssues.push({
          type: 'warning',
          line: idx + 1,
          message: 'Signal return should include "action" property',
          suggestion: 'Always return { action: "buy" | "sell" | "hold", ... }',
          example: `return { action: 'buy', symbol: 'PA', reason: 'Signal detected' }`
        })
      }
    })

    return detectedIssues
  }

  const allIssues = [...detectIssues(), ...(providedIssues || [])]
  const errors = allIssues.filter(i => i.type === 'error')
  const warnings = allIssues.filter(i => i.type === 'warning')
  const infos = allIssues.filter(i => i.type === 'info')

  if (allIssues.length === 0) {
    return (
      <Alert className="border-accent/30 bg-accent/5">
        <CheckCircle size={18} className="text-accent" weight="fill" />
        <AlertTitle>Code looks good!</AlertTitle>
        <AlertDescription>No issues detected in your strategy code.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <XCircle size={18} className="text-destructive" weight="fill" />
              {errors.length} Error{errors.length > 1 ? 's' : ''} Found
            </CardTitle>
            <CardDescription>These will likely cause your backtest to fail</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {errors.map((issue, idx) => (
              <div key={idx} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  {issue.line && (
                    <Badge variant="destructive" className="text-[10px] h-5">
                      Line {issue.line}
                    </Badge>
                  )}
                  <p className="text-sm flex-1">{issue.message}</p>
                </div>
                {issue.suggestion && (
                  <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
                )}
                {issue.example && (
                  <pre className="text-xs bg-background/50 p-2 rounded border font-mono overflow-x-auto">
                    {issue.example}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {warnings.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Warning size={18} className="text-warning" weight="fill" />
              {warnings.length} Warning{warnings.length > 1 ? 's' : ''}
            </CardTitle>
            <CardDescription>These might cause issues during execution</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {warnings.map((issue, idx) => (
              <div key={idx} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  {issue.line && (
                    <Badge variant="outline" className="text-[10px] h-5 border-warning text-warning">
                      Line {issue.line}
                    </Badge>
                  )}
                  <p className="text-sm flex-1">{issue.message}</p>
                </div>
                {issue.suggestion && (
                  <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
                )}
                {issue.example && (
                  <pre className="text-xs bg-background/50 p-2 rounded border font-mono overflow-x-auto">
                    {issue.example}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {infos.length > 0 && (
        <Card className="border-accent/30 bg-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info size={18} className="text-accent" weight="fill" />
              {infos.length} Tip{infos.length > 1 ? 's' : ''}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {infos.map((issue, idx) => (
              <div key={idx} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                <div className="flex items-start gap-2">
                  {issue.line && (
                    <Badge variant="outline" className="text-[10px] h-5 border-accent text-accent">
                      Line {issue.line}
                    </Badge>
                  )}
                  <p className="text-sm flex-1">{issue.message}</p>
                </div>
                {issue.suggestion && (
                  <p className="text-xs text-muted-foreground">💡 {issue.suggestion}</p>
                )}
                {issue.example && (
                  <pre className="text-xs bg-background/50 p-2 rounded border font-mono overflow-x-auto">
                    {issue.example}
                  </pre>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export function CommonMistakesGuide() {
  const mistakes = [
    {
      title: 'Using "row" directly',
      wrong: 'const price = row.PA_Close',
      right: 'const price = marketData.PA_Close',
      explanation: 'The marketData object is passed to your strategy function, not individual rows.'
    },
    {
      title: 'Accessing array without bounds check',
      wrong: 'const value = arr[index]',
      right: 'const value = arr && index < arr.length ? arr[index] : null',
      explanation: 'Always check that arrays exist and index is valid before accessing.'
    },
    {
      title: 'Missing rolling calculation validation',
      wrong: 'const ma = rolling.mean("Close")[index]',
      right: 'const maArr = rolling.mean("Close")\nconst ma = maArr && maArr[index] != null ? maArr[index] : null',
      explanation: 'Rolling calculations may be undefined for early periods in the data.'
    },
    {
      title: 'Incorrect return format',
      wrong: 'return "buy"',
      right: 'return { action: "buy", symbol: "PA", reason: "Signal detected" }',
      explanation: 'Always return an object with action, symbol, and reason properties.'
    },
    {
      title: 'Not handling null/undefined data',
      wrong: 'if (value > threshold)',
      right: 'if (value != null && value > threshold)',
      explanation: 'Market data may be missing for certain dates. Always check for null/undefined.'
    }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Info size={20} className="text-accent" weight="duotone" />
          Common Mistakes & How to Avoid Them
        </CardTitle>
        <CardDescription>Reference guide for writing reliable strategy code</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {mistakes.map((mistake, idx) => (
          <div key={idx} className="space-y-2 pb-4 border-b last:border-0 last:pb-0">
            <h4 className="font-medium text-sm">{mistake.title}</h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Badge variant="destructive" className="text-[10px] h-5">❌ Wrong</Badge>
                <pre className="text-xs bg-destructive/5 border border-destructive/20 p-2 rounded font-mono overflow-x-auto">
                  {mistake.wrong}
                </pre>
              </div>
              <div className="space-y-1">
                <Badge variant="default" className="text-[10px] h-5">✓ Correct</Badge>
                <pre className="text-xs bg-accent/5 border border-accent/20 p-2 rounded font-mono overflow-x-auto">
                  {mistake.right}
                </pre>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{mistake.explanation}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
