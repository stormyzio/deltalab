import { BookOpen, Copy, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type CatalogJumpTarget =
  | { section: 'elements'; id: string }
  | { section: 'species'; id: string }
  | { section: 'solutions'; id: string }
  | { section: 'reactions'; id: string }
  | { section: 'vessels'; id: string }

export function MetricCell({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: string
  value: string
  mono?: boolean
  valueClassName?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10.5px] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 break-words text-foreground',
          mono && 'font-mono text-[11.5px] tabular-nums',
          valueClassName,
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function QuickActions({
  onOpenCatalog,
  onDuplicate,
  onDelete,
}: {
  onOpenCatalog: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onOpenCatalog}
            aria-label="Voir dans le catalogue"
          >
            <BookOpen className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Voir dans le catalogue</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDuplicate}
            aria-label="Dupliquer"
          >
            <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Dupliquer (⌘D)</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onDelete}
            className="hover:text-red-400"
            aria-label="Supprimer"
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Supprimer (X)</TooltipContent>
      </Tooltip>
    </div>
  )
}
