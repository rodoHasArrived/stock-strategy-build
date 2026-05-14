import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Shield,
  UserCircle,
  ClockCounterClockwise,
  CheckCircle,
  XCircle,
  Warning,
  PencilSimple,
  GitBranch,
  ArrowRight,
} from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { GovernanceConfig, ReviewStatus, AuditEntry } from '@/lib/types'

interface GovernancePanelProps {
  governance: GovernanceConfig
  onGovernanceChange: (config: GovernanceConfig) => void
  currentUser?: string
}

const REVIEW_STATUS_LABELS: Record<ReviewStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft: {
    label: 'Draft',
    color: 'bg-muted text-muted-foreground border-muted',
    icon: <PencilSimple size={13} />,
  },
  in_review: {
    label: 'In Review',
    color: 'bg-warning/10 text-warning border-warning/30',
    icon: <Warning size={13} />,
  },
  approved: {
    label: 'Approved',
    color: 'bg-success/10 text-success border-success/30',
    icon: <CheckCircle size={13} />,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-destructive/10 text-destructive border-destructive/30',
    icon: <XCircle size={13} />,
  },
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
}

export function GovernancePanel({ governance, onGovernanceChange, currentUser }: GovernancePanelProps) {
  const [reviewerInput, setReviewerInput] = useState('')
  const status = REVIEW_STATUS_LABELS[governance.reviewStatus]

  const addAuditEntry = (action: string, details?: string) => {
    const entry: AuditEntry = {
      id: `audit-${Date.now()}`,
      timestamp: Date.now(),
      actor: currentUser ?? 'unknown',
      action,
      details,
    }
    onGovernanceChange({
      ...governance,
      auditLog: [entry, ...(governance.auditLog ?? [])],
    })
  }

  const handleStatusChange = (value: ReviewStatus) => {
    const prev = governance.reviewStatus
    onGovernanceChange({ ...governance, reviewStatus: value })
    addAuditEntry(`Status changed: ${prev} → ${value}`)
  }

  const handleOwnerChange = (owner: string) => {
    onGovernanceChange({ ...governance, owner })
  }

  const handleAddReviewer = () => {
    const trimmed = reviewerInput.trim()
    if (!trimmed) return
    const current = governance.reviewers ?? []
    if (current.includes(trimmed)) return
    onGovernanceChange({ ...governance, reviewers: [...current, trimmed] })
    addAuditEntry(`Reviewer added: ${trimmed}`)
    setReviewerInput('')
  }

  const handleRemoveReviewer = (reviewer: string) => {
    const updated = (governance.reviewers ?? []).filter(r => r !== reviewer)
    onGovernanceChange({ ...governance, reviewers: updated })
    addAuditEntry(`Reviewer removed: ${reviewer}`)
  }

  const handleNoteChange = (note: string) => {
    onGovernanceChange({ ...governance, reviewNote: note })
  }

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield size={16} className="text-accent" weight="duotone" />
          Governance
          <span className="ml-auto">
            <Badge
              variant="outline"
              className={cn('text-xs flex items-center gap-1 px-2 py-0.5', status.color)}
            >
              {status.icon}
              {status.label}
            </Badge>
          </span>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Version indicator */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <GitBranch size={13} />
            Version {governance.version}
          </span>
          {governance.publishedAt && (
            <span>Published {formatTimestamp(governance.publishedAt)}</span>
          )}
        </div>

        {/* Review status */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Review Status</label>
          <Select value={governance.reviewStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(REVIEW_STATUS_LABELS) as ReviewStatus[]).map(s => (
                <SelectItem key={s} value={s} className="text-sm">
                  <span className="flex items-center gap-2">
                    {REVIEW_STATUS_LABELS[s].icon}
                    {REVIEW_STATUS_LABELS[s].label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Owner */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <UserCircle size={13} />
            Owner
          </label>
          <Input
            value={governance.owner ?? ''}
            onChange={e => handleOwnerChange(e.target.value)}
            placeholder="GitHub login or team"
            className="h-8 text-sm"
          />
        </div>

        {/* Reviewers */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Reviewers</label>
          <div className="flex gap-1.5">
            <Input
              value={reviewerInput}
              onChange={e => setReviewerInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddReviewer()}
              placeholder="Add reviewer"
              className="h-8 text-sm flex-1"
            />
            <Button size="sm" variant="outline" className="h-8 px-2" onClick={handleAddReviewer}>
              <ArrowRight size={14} />
            </Button>
          </div>
          {(governance.reviewers ?? []).length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {(governance.reviewers ?? []).map(r => (
                <Badge
                  key={r}
                  variant="secondary"
                  className="text-xs cursor-pointer hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => handleRemoveReviewer(r)}
                  title="Click to remove"
                >
                  {r} ×
                </Badge>
              ))}
            </div>
          )}
        </div>

        {/* Review note */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Review Note</label>
          <Textarea
            value={governance.reviewNote ?? ''}
            onChange={e => handleNoteChange(e.target.value)}
            placeholder="Approval notes, rejection reason, or review comments…"
            className="text-sm min-h-[60px] resize-none"
          />
        </div>

        {/* Audit log */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClockCounterClockwise size={13} />
            Audit Log
            <Badge variant="outline" className="ml-auto text-xs px-1.5 py-0">
              {(governance.auditLog ?? []).length}
            </Badge>
          </div>
          <ScrollArea className="h-40 rounded-md border border-border">
            <div className="p-2 space-y-1.5">
              {(governance.auditLog ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No audit entries yet</p>
              ) : (
                (governance.auditLog ?? []).map(entry => (
                  <div key={entry.id} className="text-xs space-y-0.5">
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span className="font-medium text-foreground">{entry.actor}</span>
                      <span>{formatTimestamp(entry.timestamp)}</span>
                    </div>
                    <div className="text-foreground/80">{entry.action}</div>
                    {entry.details && (
                      <div className="text-muted-foreground pl-2 border-l border-border">
                        {entry.details}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  )
}
