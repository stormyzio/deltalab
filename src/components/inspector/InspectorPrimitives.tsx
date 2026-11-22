import type { ReactNode } from 'react'
import { BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemText } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type CatalogJumpTarget =
  | { section: 'elements'; id: string }
  | { section: 'species'; id: string }
  | { section: 'solutions'; id: string }
  | { section: 'reactions'; id: string }
  | { section: 'vessels'; id: string }
  | { section: 'alloys'; id: string }

export function MetricCell({
  label,
  value,
  mono = false,
  valueClassName,
}: {
  label: ReactNode
  value: ReactNode
  mono?: boolean
  valueClassName?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[10.5px] text-muted-foreground">
        {typeof label === 'string' ? <ChemText value={label} /> : label}
      </dt>
      <dd
        className={cn(
          'mt-0.5 break-words text-foreground',
          mono && 'text-[11.5px] tabular-nums',
          valueClassName,
        )}
      >
        {typeof value === 'string' ? <ChemText value={value} /> : value}
      </dd>
    </div>
  )
}

export function QuickActions({ onOpenCatalog }: { onOpenCatalog: () => void }) {
  return (
    <div className="flex shrink-0 items-center">
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
    </div>
  )
}
