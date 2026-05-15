import { DesignPreviewResult } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle, WarningCircle, XCircle, Table as TableIcon } from '@phosphor-icons/react'

interface DesignPreviewRowsProps {
  preview: DesignPreviewResult
}

export function DesignPreviewRows({ preview }: DesignPreviewRowsProps) {
  const statusIcon = (() => {
    switch (preview.status) {
      case 'ready':
        return <CheckCircle size={14} weight="fill" className="text-success" />
      case 'error':
        return <XCircle size={14} weight="fill" className="text-destructive" />
      case 'blocked':
        return <WarningCircle size={14} weight="fill" className="text-warning" />
      default:
        return <TableIcon size={14} className="text-muted-foreground" />
    }
  })()

  return (
    <div className="overflow-hidden rounded-md border border-border bg-muted/20">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium">
          {statusIcon}
          <span>Design-time preview</span>
        </div>
        <Badge variant={preview.status === 'ready' ? 'default' : 'outline'} className="text-[10px]">
          {preview.status}
        </Badge>
      </div>
      <div className="px-3 py-2 text-xs text-muted-foreground">{preview.message}</div>
      {preview.rows.length > 0 && (
        <div className="max-h-52 overflow-auto border-t bg-background/60">
          <Table>
            <TableHeader>
              <TableRow>
                {preview.columns.map(column => (
                  <TableHead key={column} className="h-8 whitespace-nowrap text-xs">{column}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.rows.slice(0, 5).map((row, index) => (
                <TableRow key={index}>
                  {preview.columns.map(column => (
                    <TableCell key={column} className="max-w-40 truncate py-2 text-xs">
                      {String(row[column] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
