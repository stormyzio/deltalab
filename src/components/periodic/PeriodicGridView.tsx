import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from 'react'
import { Search, X } from 'lucide-react'
import type { ElementCategory, ElementRecord } from '../../../shared/chemistry.ts'
import { getElementMassNumber } from '@/lib/chemistry-calc'
import { formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { ChemVar, ElectronConfig, Nuclide } from '@/components/ui/chem-text'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  type ColorOverlayMode,
  type PeriodicMetricRanges,
  getElementTileVisual,
} from './periodic-helpers'

const CONDENSED_GROUPS = [1, 2, 13, 14, 15, 16, 17, 18] as const
const CONDENSED_GROUP_TO_COL: Record<number, number> = {
  1: 2,
  2: 3,
  13: 4,
  14: 5,
  15: 6,
  16: 7,
  17: 8,
  18: 9,
}

interface PeriodicGridViewProps {
  elements: ElementRecord[]
  condensed?: boolean
  selectedZ: number | null
  onSelectZ: (z: number) => void
  matchingZSet: Set<number>
  exactMatchZSet: Set<number>
  hoveredCategory: ElementCategory | null
  categoryFilter: ElementCategory | 'all'
  onToggleCategory: (cat: ElementCategory) => void
  groupHighlight: number | null
  onToggleGroup: (g: number) => void
  periodHighlight: number | null
  onTogglePeriod: (p: number) => void
  colorMode: ColorOverlayMode
  temperatureC: number
  metricRanges: PeriodicMetricRanges
  query: string
  onQueryChange: (q: string) => void
  onSearchKeyDown: (e: ReactKeyboardEvent<HTMLInputElement>) => void
  searchInputRef: RefObject<HTMLInputElement | null>
}

export function PeriodicGridView({
  elements,
  condensed = false,
  selectedZ,
  onSelectZ,
  matchingZSet,
  exactMatchZSet,
  hoveredCategory,
  categoryFilter,
  onToggleCategory,
  groupHighlight,
  onToggleGroup,
  periodHighlight,
  onTogglePeriod,
  colorMode,
  temperatureC,
  metricRanges,
  query,
  onQueryChange,
  onSearchKeyDown,
  searchInputRef,
}: PeriodicGridViewProps) {
  const searchBarNode = (
    <div className="flex w-full max-w-lg flex-col items-center">
      <div className="relative flex w-full items-center">
        <Search
          className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground"
          strokeWidth={1.6}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={onSearchKeyDown}
          placeholder="Rechercher symbole, nom, Z, découvreur…"
          aria-label="Rechercher un élément dans le tableau périodique"
          className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQueryChange('')}
            aria-label="Effacer la recherche"
            className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-4 text-[11px] text-muted-foreground/60">
            ⌘K
          </kbd>
        )}
      </div>
      <span
        aria-hidden={query.trim().length === 0}
        className={cn(
          'mt-1.5 h-4 text-[10.5px] tabular-nums text-muted-foreground',
          query.trim().length === 0 && 'invisible',
        )}
      >
        {query.trim().length > 0
          ? `${matchingZSet.size} élément${matchingZSet.size > 1 ? 's' : ''} trouvé${matchingZSet.size > 1 ? 's' : ''}`
          : '0'}
      </span>
    </div>
  )

  const renderElementTile = (
    el: ElementRecord,
    actualGridRow: number,
    actualGridCol: number,
    large: boolean,
  ) => {
    const isSelected = selectedZ === el.atomicNumber
    const matchesFilter = matchingZSet.has(el.atomicNumber)
    const isExact = exactMatchZSet.has(el.atomicNumber)
    const dimmedByHover = hoveredCategory !== null && el.category !== hoveredCategory
    const isDimmed = !matchesFilter || dimmedByHover

    const visual = getElementTileVisual(el, colorMode, temperatureC, metricRanges)
    const massNumber = getElementMassNumber(el.atomicNumber, el.atomicMass)
    const hasOverlayTint = Boolean(visual.bg)
    const tileStyle = {
      gridRow: actualGridRow,
      gridColumn: actualGridCol,
      ...(visual.bg ? { '--tile-bg': visual.bg } : null),
      ...(visual.border ? { '--tile-border': visual.border } : null),
    } as CSSProperties

    return (
      <Tooltip key={el.atomicNumber} delayDuration={380}>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => onSelectZ(el.atomicNumber)}
            style={tileStyle}
            className={cn(
              'relative flex flex-col items-center justify-between rounded-[5px] border text-center transition-[opacity,transform] duration-150',
              large ? 'px-2 py-1.5' : 'px-1 py-1',
              isExact
                ? isSelected
                  ? 'z-20 border-sky-400 bg-sky-500/25 ring-2 ring-sky-400/90'
                  : 'z-10 border-sky-400 bg-sky-500/20 ring-1 ring-sky-400/80 hover:bg-sky-500/25'
                : isSelected
                  ? hasOverlayTint
                    ? 'z-10 border-zinc-200 bg-[var(--tile-bg)] shadow-[inset_0_0_0_999px_rgba(255,255,255,0.08)] ring-1 ring-zinc-200/80'
                    : 'z-10 border-zinc-200 bg-accent ring-1 ring-zinc-200/80'
                  : hasOverlayTint
                    ? 'border-[var(--tile-border,var(--color-border))] bg-[var(--tile-bg)] hover:z-10 hover:border-zinc-300/90 hover:shadow-[inset_0_0_0_999px_rgba(255,255,255,0.10)]'
                    : 'border-border bg-card hover:z-10 hover:border-zinc-400 hover:bg-accent/70',
              isDimmed && !isSelected && 'opacity-20',
            )}
          >
            {/* Top-left: atomic number Z */}
            <div className="flex w-full items-center justify-between leading-none">
              <span
                className={cn(
                  'tabular-nums',
                  large ? 'text-[10px]' : 'text-[8.5px]',
                  isExact ? 'text-sky-200/90' : 'text-muted-foreground',
                )}
              >
                {el.atomicNumber}
              </span>
              {large && el.valenceElectrons !== null && (
                <span className="text-[9px] tabular-nums text-muted-foreground/75">
                  {el.valenceElectrons}
                  <ChemVar base="e" sup="−" />
                </span>
              )}
            </div>

            {/* Center: symbol + name */}
            <div className="my-auto flex w-full flex-col items-center leading-none">
              <span
                className={cn(
                  'font-semibold tracking-tight',
                  large ? 'text-[18px] xl:text-[20px]' : 'text-[14px] xl:text-[15px]',
                  isExact ? 'text-sky-100' : 'text-foreground',
                )}
                style={
                  !isExact
                    ? {
                        color:
                          visual.dotColor === '#3f3f46' ? '#71717a' : visual.dotColor,
                      }
                    : undefined
                }
              >
                {el.symbol}
              </span>
              <span
                className={cn(
                  'mt-0.5 w-full truncate',
                  large ? 'text-[10px]' : 'text-[8px]',
                  isExact ? 'text-sky-200/85' : 'text-muted-foreground',
                )}
              >
                {el.nameFr}
              </span>
            </div>

            {/* Bottom-left: nucleon number A · Bottom-right: active overlay metric */}
            <div className="flex w-full items-baseline justify-between gap-0.5 leading-none">
              <span
                className={cn(
                  'shrink-0 tabular-nums',
                  large ? 'text-[9.5px]' : 'text-[8px]',
                  isExact ? 'text-sky-200/85' : 'text-muted-foreground/85',
                )}
              >
                {massNumber}
              </span>
              {colorMode !== 'category' && visual.metricText && (
                <span
                  className={cn(
                    'min-w-0 truncate text-right tabular-nums',
                    large ? 'text-[9px]' : 'text-[7.5px]',
                    isExact ? 'text-sky-200/85' : 'text-muted-foreground/90',
                  )}
                >
                  {visual.metricText}
                </span>
              )}
            </div>
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{el.nameFr}</span>
            <span className="text-xs text-zinc-200">
              <Nuclide symbol={el.symbol} A={massNumber} Z={el.atomicNumber} />
            </span>
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            <ElectronConfig value={el.electronConfiguration} /> ·{' '}
            {formatFrNumber(el.atomicMass, 3)} g/mol
          </div>
        </TooltipContent>
      </Tooltip>
    )
  }

  if (condensed) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-4 pb-16 pt-14 xl:px-8">
        <div className="w-full max-w-[820px]">
          {/* Condensed group headers (1, 2, 13..18) */}
          <div className="mb-1.5 grid grid-cols-[24px_repeat(8,minmax(0,1fr))] gap-1.5">
            <div />
            {CONDENSED_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onToggleGroup(g)}
                className={cn(
                  'flex h-5 items-center justify-center whitespace-nowrap rounded text-[10.5px] font-medium tabular-nums',
                  groupHighlight === g
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground',
                )}
                title={`Filtrer le groupe ${g}`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* 3 periods × 8 main-group columns (Z = 1..18) */}
          <div
            className="grid grid-cols-[24px_repeat(8,minmax(0,1fr))] gap-1.5"
            style={{ gridTemplateRows: 'repeat(3, minmax(84px, 1fr))' }}
          >
            {[1, 2, 3].map((p) => (
              <button
                key={`cp-${p}`}
                type="button"
                onClick={() => onTogglePeriod(p)}
                style={{ gridRow: p, gridColumn: 1 }}
                className={cn(
                  'flex items-center justify-center whitespace-nowrap rounded text-[10.5px] font-medium tabular-nums',
                  periodHighlight === p
                    ? 'bg-accent text-foreground'
                    : 'text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground',
                )}
                title={`Filtrer la période ${p}`}
              >
                {p}
              </button>
            ))}

            {/* Pill search bar nestled in the 6-column pocket between H and He */}
            <div
              style={{ gridRow: 1, gridColumn: '3 / span 6' }}
              className="flex flex-col items-center justify-center px-3"
            >
              {searchBarNode}
            </div>

            {elements.map((el) => {
              const col = el.groupNum ? CONDENSED_GROUP_TO_COL[el.groupNum] : undefined
              if (!col || el.period > 3) return null
              return renderElementTile(el, el.period, col, true)
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full min-w-[980px] flex-col items-center justify-center px-4 pb-14 pt-12 xl:px-6">
      <div className="w-full max-w-[1400px]">
        {/* Group headers 1..18 */}
        <div className="mb-1 grid grid-cols-[20px_repeat(18,minmax(0,1fr))] gap-1">
          <div />
          {Array.from({ length: 18 }, (_, i) => i + 1).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => onToggleGroup(g)}
              className={cn(
                'flex h-5 items-center justify-center whitespace-nowrap rounded text-[10px] font-medium tabular-nums',
                groupHighlight === g
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground',
              )}
              title={`Filtrer le groupe ${g}`}
            >
              {g}
            </button>
          ))}
        </div>

        {/* Main 18-column Mendeleev grid (rows 1..7 + gap + rows 8..9) */}
        <div
          className="grid grid-cols-[20px_repeat(18,minmax(0,1fr))] gap-1"
          style={{
            gridTemplateRows:
              'repeat(7, minmax(58px, 1fr)) 10px repeat(2, minmax(58px, 1fr))',
          }}
        >
          {/* Period headers 1..7 */}
          {[1, 2, 3, 4, 5, 6, 7].map((p) => (
            <button
              key={`p-${p}`}
              type="button"
              onClick={() => onTogglePeriod(p)}
              style={{ gridRow: p, gridColumn: 1 }}
              className={cn(
                'flex items-center justify-center whitespace-nowrap rounded text-[10px] font-medium tabular-nums',
                periodHighlight === p
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground/75 hover:bg-accent/50 hover:text-foreground',
              )}
              title={`Filtrer la période ${p}`}
            >
              {p}
            </button>
          ))}

          {/* Pill search bar nestled cleanly inside the empty pocket above transition metals */}
          <div
            style={{ gridRow: '1 / span 3', gridColumn: '4 / span 10' }}
            className="flex flex-col items-center justify-center px-4"
          >
            {searchBarNode}
          </div>

          {/* f-block row markers */}
          <button
            type="button"
            onClick={() => onToggleCategory('lanthanide')}
            style={{ gridRow: 6, gridColumn: 4 }}
            className={cn(
              'flex flex-col items-center justify-center rounded-[5px] border border-dashed border-border/80 bg-panel/40 px-0.5 text-center hover:border-zinc-500 hover:bg-accent/40',
              categoryFilter === 'lanthanide' && 'border-zinc-400 bg-accent/60',
            )}
          >
            <span className="text-[9px] tabular-nums text-muted-foreground">
              57–71
            </span>
            <span className="mt-0.5 text-[9px] font-medium text-zinc-400">La–Lu</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleCategory('actinide')}
            style={{ gridRow: 7, gridColumn: 4 }}
            className={cn(
              'flex flex-col items-center justify-center rounded-[5px] border border-dashed border-border/80 bg-panel/40 px-0.5 text-center hover:border-zinc-500 hover:bg-accent/40',
              categoryFilter === 'actinide' && 'border-zinc-400 bg-accent/60',
            )}
          >
            <span className="text-[9px] tabular-nums text-muted-foreground">
              89–103
            </span>
            <span className="mt-0.5 text-[9px] font-medium text-zinc-400">Ac–Lr</span>
          </button>

          {/* Row 8 & 9 labels for f-block */}
          <div
            style={{ gridRow: 9, gridColumn: '2 / span 2' }}
            className="flex items-center justify-end pr-2 text-[10px] font-medium text-muted-foreground"
          >
            Lanthanides
          </div>
          <div
            style={{ gridRow: 10, gridColumn: '2 / span 2' }}
            className="flex items-center justify-end pr-2 text-[10px] font-medium text-muted-foreground"
          >
            Actinides
          </div>

          {/* All 118 Element Tiles */}
          {elements.map((el) => {
            const actualGridRow = el.gridRow >= 8 ? el.gridRow + 1 : el.gridRow
            const actualGridCol = el.gridCol + 1
            return renderElementTile(el, actualGridRow, actualGridCol, false)
          })}
        </div>
      </div>
    </div>
  )
}
