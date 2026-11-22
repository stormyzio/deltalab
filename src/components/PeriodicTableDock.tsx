import { type PointerEvent, memo, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { ElementCategory, ElementRecord } from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import { CATEGORY_META, STATE_META, formatFrNumber } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface PeriodicTableDockProps {
  elements: ElementRecord[]
  active?: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  onStartExternalDrag: (
    item: ExternalDragItem,
    event: PointerEvent<HTMLElement>,
  ) => void
  onKeyboardSpawn: (item: ExternalDragItem) => void
}

const FILTER_CATEGORIES: ElementCategory[] = [
  'nonmetal',
  'alkali-metal',
  'alkaline-earth',
  'transition-metal',
  'halogen',
  'noble-gas',
  'metalloid',
  'post-transition',
  'lanthanide',
  'actinide',
]

export const PeriodicTableDock = memo(function PeriodicTableDock({
  elements,
  active = true,
  collapsed,
  onToggleCollapse,
  onStartExternalDrag,
  onKeyboardSpawn,
}: PeriodicTableDockProps) {
  const [query, setQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<ElementCategory | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!active) return
    const focusSearch = () => {
      if (collapsed) onToggleCollapse()
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.select()
      })
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        focusSearch()
        return
      }
      if (
        e.key === '/' &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        focusSearch()
      } else if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        setQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, collapsed, onToggleCollapse])

  const normalizedQuery = query.trim().toLowerCase()

  const { matchingSet, exactMatchSet } = useMemo(() => {
    if (!normalizedQuery && !activeCategory) {
      return { matchingSet: null, exactMatchSet: null }
    }
    const matches = new Set<number>()
    const exacts = new Set<number>()
    for (const el of elements) {
      const catOk = !activeCategory || el.category === activeCategory
      const symLower = el.symbol.toLowerCase()
      const nameLower = el.nameFr.toLowerCase()
      const zStr = String(el.atomicNumber)
      const queryOk =
        !normalizedQuery ||
        symLower.includes(normalizedQuery) ||
        nameLower.includes(normalizedQuery) ||
        zStr === normalizedQuery
      if (catOk && queryOk) {
        matches.add(el.atomicNumber)
        if (
          normalizedQuery &&
          (symLower === normalizedQuery ||
            nameLower === normalizedQuery ||
            zStr === normalizedQuery)
        ) {
          exacts.add(el.atomicNumber)
        }
      }
    }
    return {
      matchingSet: matches,
      exactMatchSet: exacts.size > 0 ? exacts : null,
    }
  }, [elements, normalizedQuery, activeCategory])

  return (
    <section
      aria-label="Tableau périodique des éléments"
      className="flex w-full shrink-0 flex-col bg-panel select-none xl:w-[580px] 2xl:w-[700px]"
    >
      {/* Slim dock header */}
      <div className="flex h-8 items-center justify-between gap-2 px-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleCollapse}
            className="h-6 shrink-0 gap-1.5 whitespace-nowrap px-1.5 text-[11px] font-medium text-foreground hover:bg-accent"
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.6} />
            )}
            <span>Tableau périodique</span>
          </Button>
          <span className="hidden text-[10px] tabular-nums text-muted-foreground sm:inline">
            {matchingSet ? `${matchingSet.size}/${elements.length}` : elements.length}
          </span>
        </div>

        {/* Minimal category dot filters */}
        {!collapsed && (
          <div className="hidden items-center gap-1 md:flex">
            {FILTER_CATEGORIES.map((cat) => {
              const meta = CATEGORY_META[cat]
              const isSelected = activeCategory === cat
              return (
                <Tooltip key={cat}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() =>
                        setActiveCategory((prev) => (prev === cat ? null : cat))
                      }
                      aria-label={`Filtrer : ${meta.labelFr}`}
                      aria-pressed={isSelected}
                      className={cn(
                        'flex h-5 w-5 items-center justify-center rounded',
                        isSelected
                          ? 'bg-accent ring-1 ring-zinc-500'
                          : 'hover:bg-accent/60',
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: meta.accentHex,
                          opacity: activeCategory && !isSelected ? 0.35 : 0.9,
                        }}
                      />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{meta.labelFr}</TooltipContent>
                </Tooltip>
              )
            })}
            <button
              type="button"
              onClick={() => setActiveCategory(null)}
              tabIndex={activeCategory ? 0 : -1}
              aria-hidden={!activeCategory}
              className={cn(
                'ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground',
                !activeCategory && 'invisible pointer-events-none',
              )}
              aria-label="Réinitialiser le filtre de famille"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>

      {/* 18-column Periodic Table grid */}
      {!collapsed && (
        <div className="overflow-x-auto border-t border-border/70 px-2 pb-2 pt-2">
          <div
            className="grid min-w-[576px] w-full gap-[2.5px]"
            style={{
              gridTemplateColumns: 'repeat(18, minmax(0, 1fr))',
              gridTemplateRows: 'repeat(7, 29px) 5px repeat(2, 29px)',
            }}
          >
            {/* Pill search bar nestled in the empty pocket above transition metals */}
            <div
              style={{ gridRow: '1 / span 3', gridColumn: '3 / span 10' }}
              className="flex items-center justify-center px-2.5"
            >
              <div className="relative flex w-full max-w-[270px] items-center">
                <Search
                  className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted-foreground"
                  strokeWidth={1.6}
                />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Rechercher (H, Si, Cu…)"
                  aria-label="Filtrer les éléments"
                  className="h-8 w-full rounded-full border border-border bg-card pl-8 pr-11 text-[11.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Effacer la recherche"
                  >
                    <X className="h-3 w-3" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-2.5 text-[9.5px] text-muted-foreground/60">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>

            {/* F-block range markers */}
            <div
              style={{ gridRow: 6, gridColumn: 3 }}
              className="flex items-center justify-center rounded-[5px] border border-dashed border-border/80 text-[8.5px] tabular-nums text-muted-foreground"
            >
              57–71
            </div>
            <div
              style={{ gridRow: 7, gridColumn: 3 }}
              className="flex items-center justify-center rounded-[5px] border border-dashed border-border/80 text-[8.5px] tabular-nums text-muted-foreground"
            >
              89–103
            </div>

            {elements.map((el) => {
              const gridRow = el.gridRow >= 8 ? el.gridRow + 1 : el.gridRow
              const catMeta = CATEGORY_META[el.category]
              const isMatched = matchingSet ? matchingSet.has(el.atomicNumber) : true
              const isExact = Boolean(exactMatchSet && exactMatchSet.has(el.atomicNumber))
              const isHighlighted = Boolean(matchingSet && isMatched)

              return (
                <Tooltip key={el.atomicNumber} delayDuration={240}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      style={{
                        gridRow,
                        gridColumn: el.gridCol,
                      }}
                      onPointerDown={(e) =>
                        onStartExternalDrag({ kind: 'atom', element: el }, e)
                      }
                      onClick={(e) => {
                        if (e.detail === 0) {
                          onKeyboardSpawn({ kind: 'atom', element: el })
                        }
                      }}
                      className={cn(
                        'group relative flex h-full w-full items-center justify-center rounded-[5px] border bg-card cursor-grab active:cursor-grabbing',
                        isExact
                          ? 'z-10 border-sky-400 bg-sky-500/20 text-sky-100 ring-1 ring-sky-400/80 hover:bg-sky-500/25'
                          : isHighlighted
                            ? 'border-zinc-500 bg-accent text-foreground'
                            : isMatched
                              ? 'border-border/90 text-foreground hover:border-zinc-500 hover:bg-accent'
                              : 'border-border/40 bg-card/40 text-muted-foreground/30',
                      )}
                      aria-label={`${el.nameFr} (${el.symbol}), numéro atomique ${el.atomicNumber}`}
                    >
                      <span className="pointer-events-none absolute left-[3.5px] top-[2px] text-[8px] leading-none tabular-nums text-muted-foreground">
                        {el.atomicNumber}
                      </span>
                      <span
                        className="pointer-events-none translate-y-[2.5px] text-[12.5px] font-semibold tracking-tight leading-none"
                        style={
                          !isExact
                            ? {
                                color: catMeta.accentHex,
                                opacity: isMatched ? 1 : 0.25,
                              }
                            : undefined
                        }
                      >
                        {el.symbol}
                      </span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="min-w-[148px]">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-medium text-foreground">{el.nameFr}</span>
                      <span className="text-[10px] tabular-nums text-muted-foreground">
                        Z={el.atomicNumber}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: catMeta.accentHex }}
                        />
                        {catMeta.labelFr}
                      </span>
                      <span className="tabular-nums">
                        {formatFrNumber(el.atomicMass, 2)} g/mol
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground/80">
                      État standard : {STATE_META[el.defaultState].labelFr}
                    </div>
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      )}
    </section>
  )
})
