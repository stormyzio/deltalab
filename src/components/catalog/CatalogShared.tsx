import type { ReactNode } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChemText } from '@/components/ui/chem-text'

export type CatalogSection = 'species' | 'solutions' | 'reactions' | 'vessels' | 'alloys'
export type ReactionSubTab = 'named' | 'redox' | 'ks' | 'pka'
export type SortDir = 'asc' | 'desc'

export interface ReactionSpawnSetup {
  titleFr: string
  medium: 'aqueous' | 'gas' | 'solid' | 'any'
  reactants: Array<{ speciesId: string; stoichiometry: number }>
}

export function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'h-6 shrink-0 whitespace-nowrap rounded-md px-2 text-[11px] font-medium',
        active
          ? 'bg-accent text-foreground'
          : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}

export function SortTh({
  label,
  activeKey,
  colKey,
  dir,
  onSort,
  align = 'left',
  className,
}: {
  label: ReactNode
  activeKey: string
  colKey: string
  dir: SortDir
  onSort: (key: string) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const active = activeKey === colKey
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2 font-medium',
        align === 'right' && 'text-right',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        className={cn(
          'inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        <span>{typeof label === 'string' ? <ChemText value={label} /> : label}</span>
        {active ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" strokeWidth={1.7} />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" strokeWidth={1.7} />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-40" strokeWidth={1.5} />
        )}
      </button>
    </th>
  )
}
