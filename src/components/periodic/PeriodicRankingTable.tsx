import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import type { ElementRecord } from '../../../shared/chemistry.ts'
import {
  CATEGORY_META,
  formatDensity,
  formatElementTempC,
  formatFrNumber,
} from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import type { RankingSortKey, SortDir } from './periodic-helpers'

function RankTh({
  label,
  colKey,
  activeKey,
  dir,
  onSort,
  align = 'left',
  className,
}: {
  label: string
  colKey: RankingSortKey
  activeKey: RankingSortKey
  dir: SortDir
  onSort: (k: RankingSortKey) => void
  align?: 'left' | 'right'
  className?: string
}) {
  const isActive = activeKey === colKey
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
          isActive && 'text-foreground',
        )}
      >
        <span>{label}</span>
        {isActive ? (
          dir === 'asc' ? (
            <ArrowUp className="h-3 w-3 shrink-0" />
          ) : (
            <ArrowDown className="h-3 w-3 shrink-0" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 shrink-0 opacity-35" />
        )}
      </button>
    </th>
  )
}

interface PeriodicRankingTableProps {
  elements: ElementRecord[]
  selectedZ: number | null
  exactMatchZSet: Set<number>
  sortKey: RankingSortKey
  sortDir: SortDir
  onSort: (k: RankingSortKey) => void
  onSelectZ: (z: number) => void
}

export function PeriodicRankingTable({
  elements,
  selectedZ,
  exactMatchZSet,
  sortKey,
  sortDir,
  onSort,
  onSelectZ,
}: PeriodicRankingTableProps) {
  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <RankTh label="Z" colKey="atomicNumber" activeKey={sortKey} dir={sortDir} onSort={onSort} className="w-14 pl-4" />
          <th className="w-16 whitespace-nowrap px-2 py-2 font-medium">Sym.</th>
          <RankTh label="Élément" colKey="name" activeKey={sortKey} dir={sortDir} onSort={onSort} />
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium xl:table-cell">Configuration</th>
          <RankTh label="Masse" colKey="atomicMass" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
          <RankTh label="χ" colKey="electronegativity" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" />
          <RankTh label="Rayon" colKey="atomicRadiusPm" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="hidden md:table-cell" />
          <RankTh label="E. ion." colKey="ionizationEnergyKjMol" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="hidden lg:table-cell" />
          <RankTh label="Fusion" colKey="meltingPointC" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="hidden sm:table-cell" />
          <RankTh label="Densité" colKey="densityGPerCm3" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="hidden lg:table-cell" />
          <RankTh label="Découv." colKey="discoveryYear" activeKey={sortKey} dir={sortDir} onSort={onSort} align="right" className="hidden pr-4 xl:table-cell" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {elements.map((el) => {
          const isSel = selectedZ === el.atomicNumber
          const isExact = exactMatchZSet.has(el.atomicNumber)
          const cat = CATEGORY_META[el.category]
          return (
            <tr
              key={el.atomicNumber}
              onClick={() => onSelectZ(el.atomicNumber)}
              className={cn(
                isExact
                  ? 'bg-sky-500/15 hover:bg-sky-500/20'
                  : isSel
                    ? 'bg-accent/80'
                    : 'hover:bg-accent/40',
              )}
            >
              <td className="whitespace-nowrap py-2 pl-4 pr-2 font-mono text-[11px] tabular-nums text-muted-foreground">
                {el.atomicNumber}
              </td>
              <td className="whitespace-nowrap px-2 py-2">
                <span
                  className={cn(
                    'inline-flex items-center gap-1.5 font-semibold',
                    isExact ? 'text-sky-300' : 'text-foreground',
                  )}
                  style={!isExact ? { color: cat.accentHex } : undefined}
                >
                  {el.symbol}
                </span>
              </td>
              <td className="px-3 py-2 text-zinc-200">{el.nameFr}</td>
              <td className="hidden whitespace-nowrap px-3 py-2 font-mono text-[10.5px] text-muted-foreground xl:table-cell">
                {el.electronConfiguration}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-zinc-200">
                {formatFrNumber(el.atomicMass, 3)}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {el.electronegativity !== null ? formatFrNumber(el.electronegativity, 2) : '—'}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground md:table-cell">
                {el.atomicRadiusPm !== null ? `${el.atomicRadiusPm} pm` : '—'}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground lg:table-cell">
                {el.ionizationEnergyKjMol !== null
                  ? formatFrNumber(el.ionizationEnergyKjMol, 0)
                  : '—'}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                {formatElementTempC(el.meltingPointC)}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-right font-mono text-[11px] tabular-nums text-muted-foreground lg:table-cell">
                {el.densityGPerCm3 !== null
                  ? formatDensity(el.densityGPerCm3, el.defaultState)
                  : '—'}
              </td>
              <td className="hidden whitespace-nowrap py-2 pl-3 pr-4 text-right font-mono text-[11px] tabular-nums text-muted-foreground xl:table-cell">
                {el.discoveryYear ?? 'Antiq.'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
