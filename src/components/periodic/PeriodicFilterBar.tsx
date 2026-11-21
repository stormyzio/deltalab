import { RotateCcw } from 'lucide-react'
import type { ElementBlock, ElementCategory } from '../../../shared/chemistry.ts'
import { CATEGORY_META } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { DualSwitch } from '@/components/ui/switch'
import {
  CATEGORY_SHORT_LABEL,
  COLOR_MODES,
  ELEMENT_CATEGORIES,
  type ColorOverlayMode,
  type PeriodicViewMode,
} from './periodic-helpers'

interface PeriodicFilterBarProps {
  viewMode: PeriodicViewMode
  onViewModeChange: (mode: PeriodicViewMode) => void
  colorMode: ColorOverlayMode
  onColorModeChange: (mode: ColorOverlayMode) => void
  categoryFilter: ElementCategory | 'all'
  onCategoryFilterChange: (cat: ElementCategory | 'all') => void
  onHoverCategory: (cat: ElementCategory | null) => void
  blockFilter: ElementBlock | 'all'
  onBlockFilterChange: (blk: ElementBlock | 'all') => void
  stateFilter: 'all' | 'solid' | 'liquid' | 'gas'
  onStateFilterChange: (st: 'all' | 'solid' | 'liquid' | 'gas') => void
  originFilter: 'all' | 'natural' | 'radioactive' | 'synthetic'
  onOriginFilterChange: (orig: 'all' | 'natural' | 'radioactive' | 'synthetic') => void
  hasActiveFilters: boolean
  onResetFilters: () => void
  matchCount: number
  totalCount: number
}

export function PeriodicFilterBar({
  viewMode,
  onViewModeChange,
  colorMode,
  onColorModeChange,
  categoryFilter,
  onCategoryFilterChange,
  onHoverCategory,
  blockFilter,
  onBlockFilterChange,
  stateFilter,
  onStateFilterChange,
  originFilter,
  onOriginFilterChange,
  hasActiveFilters,
  onResetFilters,
  matchCount,
  totalCount,
}: PeriodicFilterBarProps) {
  return (
    <>
      {/* Top toolbar: fixed height so switching Tableau ↔ Classement causes zero vertical shift */}
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 overflow-x-auto border-b border-border bg-panel px-4">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-6 shrink-0 items-center">
            <DualSwitch
              leftLabel="Tableau"
              rightLabel="Classement"
              checked={viewMode === 'ranking'}
              onCheckedChange={(isRanking) =>
                onViewModeChange(isRanking ? 'ranking' : 'table')
              }
              ariaLabel="Basculer entre Tableau et Classement"
            />
          </div>

          {viewMode === 'table' && (
            <>
              <span className="h-4 w-px shrink-0 bg-border" />

              <div className="flex shrink-0 items-center gap-0.5">
                {COLOR_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => onColorModeChange(m.id)}
                    className={cn(
                      'h-6 shrink-0 whitespace-nowrap rounded-md px-2 text-[11px] font-medium',
                      colorMode === m.id
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Second strip: filters */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-background px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => onCategoryFilterChange('all')}
            className={cn(
              'h-6 shrink-0 whitespace-nowrap rounded px-2 text-[11px] font-medium',
              categoryFilter === 'all'
                ? 'bg-accent text-foreground'
                : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
            )}
          >
            Toutes familles
          </button>
          <div className="flex flex-wrap items-center gap-0.5">
            {ELEMENT_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat]
              const isActive = categoryFilter === cat
              return (
                <button
                  key={cat}
                  type="button"
                  onMouseEnter={() => onHoverCategory(cat)}
                  onMouseLeave={() => onHoverCategory(null)}
                  onClick={() =>
                    onCategoryFilterChange(categoryFilter === cat ? 'all' : cat)
                  }
                  className={cn(
                    'inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded px-1.5 text-[10.5px] font-medium',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                  )}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: meta.accentHex }}
                  />
                  <span className="hidden 2xl:inline">{meta.labelFr}</span>
                  <span className="2xl:hidden">{CATEGORY_SHORT_LABEL[cat]}</span>
                </button>
              )
            })}
          </div>

          <span className="mx-1 h-3.5 w-px bg-border" />

          {(['s', 'p', 'd', 'f'] as const).map((blk) => (
            <button
              key={blk}
              type="button"
              onClick={() => onBlockFilterChange(blockFilter === blk ? 'all' : blk)}
              className={cn(
                'h-6 shrink-0 whitespace-nowrap rounded px-1.5 font-mono text-[10.5px] font-medium',
                blockFilter === blk
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {blk}
            </button>
          ))}

          <span className="mx-1 h-3.5 w-px bg-border" />

          {(
            [
              ['solid', 'Solides'],
              ['liquid', 'Liquides'],
              ['gas', 'Gaz'],
            ] as const
          ).map(([st, label]) => (
            <button
              key={st}
              type="button"
              onClick={() => onStateFilterChange(stateFilter === st ? 'all' : st)}
              className={cn(
                'h-6 shrink-0 whitespace-nowrap rounded px-1.5 text-[10.5px] font-medium',
                stateFilter === st
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}

          <span className="mx-1 h-3.5 w-px bg-border" />

          {(
            [
              ['natural', 'Naturels'],
              ['radioactive', 'Radioactifs'],
              ['synthetic', 'Synthétiques'],
            ] as const
          ).map(([orig, label]) => (
            <button
              key={orig}
              type="button"
              onClick={() => onOriginFilterChange(originFilter === orig ? 'all' : orig)}
              className={cn(
                'h-6 shrink-0 whitespace-nowrap rounded px-1.5 text-[10.5px] font-medium',
                originFilter === orig
                  ? 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onResetFilters}
              className="ml-1 inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded px-1.5 text-[10.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3 shrink-0" strokeWidth={1.6} />
              <span>Réinitialiser</span>
            </button>
          )}
        </div>

        <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-muted-foreground">
          {matchCount} / {totalCount}
        </span>
      </div>
    </>
  )
}
