import {
  type KeyboardEvent as ReactKeyboardEvent,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react'
import type {
  ElementBlock,
  ElementCategory,
  ElementRecord,
  FullCatalogResponse,
} from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import {
  CATEGORY_META,
  formatFrNumber,
  getElementStateAtTemperature,
} from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import {
  type ColorOverlayMode,
  type PeriodicViewMode,
  type RankingSortKey,
  type SortDir,
  computeMetricRanges,
} from '@/components/periodic/periodic-helpers'
import { PeriodicFilterBar } from '@/components/periodic/PeriodicFilterBar'
import { PeriodicGridView } from '@/components/periodic/PeriodicGridView'
import { PeriodicRankingTable } from '@/components/periodic/PeriodicRankingTable'
import { PeriodicElementInspector } from '@/components/periodic/PeriodicElementInspector'

export interface PeriodicJumpRequest {
  atomicNumber: number
  nonce: number
}

interface PeriodicTablePageProps {
  catalog: FullCatalogResponse | null
  jumpTarget?: PeriodicJumpRequest | null
  active?: boolean
  onSpawnToWorkbench: (item: ExternalDragItem) => void
  onJumpToSpecies: (speciesId: string) => void
}

export const PeriodicTablePage = memo(function PeriodicTablePage({
  catalog,
  jumpTarget = null,
  active = true,
  onSpawnToWorkbench,
  onJumpToSpecies,
}: PeriodicTablePageProps) {
  const elements = useMemo(() => catalog?.elements ?? [], [catalog])

  const [viewMode, setViewMode] = useState<PeriodicViewMode>('table')
  const [colorMode, setColorMode] = useState<ColorOverlayMode>('category')
  const [temperatureC, setTemperatureC] = useState<number>(20)
  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [categoryFilter, setCategoryFilter] = useState<ElementCategory | 'all'>('all')
  const [blockFilter, setBlockFilter] = useState<ElementBlock | 'all'>('all')
  const [stateFilter, setStateFilter] = useState<'all' | 'solid' | 'liquid' | 'gas'>('all')
  const [originFilter, setOriginFilter] = useState<'all' | 'natural' | 'radioactive' | 'synthetic'>('all')
  const [groupHighlight, setGroupHighlight] = useState<number | null>(null)
  const [periodHighlight, setPeriodHighlight] = useState<number | null>(null)
  const [hoveredCategory, setHoveredCategory] = useState<ElementCategory | null>(null)

  const [selectedZ, setSelectedZ] = useState<number>(() => jumpTarget?.atomicNumber ?? 6)
  const [appliedJumpNonce, setAppliedJumpNonce] = useState<number>(
    () => jumpTarget?.nonce ?? 0,
  )
  if (jumpTarget && jumpTarget.nonce !== appliedJumpNonce) {
    setAppliedJumpNonce(jumpTarget.nonce)
    setSelectedZ(jumpTarget.atomicNumber)
  }
  const [sortKey, setSortKey] = useState<RankingSortKey>('atomicNumber')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const elementsByZ = useMemo(
    () => new Map<number, ElementRecord>(elements.map((e) => [e.atomicNumber, e])),
    [elements],
  )

  const selectedElement = useMemo(
    () => elementsByZ.get(selectedZ) ?? elements[0] ?? null,
    [elementsByZ, selectedZ, elements],
  )

  const metricRanges = useMemo(() => computeMetricRanges(elements), [elements])

  const hasActiveFilters =
    query.trim().length > 0 ||
    categoryFilter !== 'all' ||
    blockFilter !== 'all' ||
    stateFilter !== 'all' ||
    originFilter !== 'all' ||
    groupHighlight !== null ||
    periodHighlight !== null

  const resetFilters = () => {
    setQuery('')
    setCategoryFilter('all')
    setBlockFilter('all')
    setStateFilter('all')
    setOriginFilter('all')
    setGroupHighlight(null)
    setPeriodHighlight(null)
  }

  const { matchingZSet, exactMatchZSet } = useMemo(() => {
    const q = query.trim().toLowerCase()
    const set = new Set<number>()
    const exacts = new Set<number>()
    for (const el of elements) {
      if (categoryFilter !== 'all' && el.category !== categoryFilter) continue
      if (blockFilter !== 'all' && el.block !== blockFilter) continue
      if (stateFilter !== 'all') {
        const effState =
          colorMode === 'state'
            ? getElementStateAtTemperature(el, temperatureC)
            : el.defaultState
        if (effState !== stateFilter) continue
      }
      if (originFilter === 'natural' && el.synthetic) continue
      if (originFilter === 'radioactive' && !el.radioactive) continue
      if (originFilter === 'synthetic' && !el.synthetic) continue
      if (groupHighlight !== null && el.groupNum !== groupHighlight) continue
      if (periodHighlight !== null && el.period !== periodHighlight) continue

      if (q) {
        const symLower = el.symbol.toLowerCase()
        const nameLower = el.nameFr.toLowerCase()
        const zStr = String(el.atomicNumber)
        const hit =
          symLower.includes(q) ||
          nameLower.includes(q) ||
          zStr === q ||
          (el.discoveredBy ?? '').toLowerCase().includes(q) ||
          el.electronConfiguration.toLowerCase().includes(q) ||
          CATEGORY_META[el.category].labelFr.toLowerCase().includes(q)
        if (!hit) continue
        if (symLower === q || nameLower === q || zStr === q) {
          exacts.add(el.atomicNumber)
        }
      }
      set.add(el.atomicNumber)
    }
    return { matchingZSet: set, exactMatchZSet: exacts }
  }, [
    elements,
    query,
    categoryFilter,
    blockFilter,
    stateFilter,
    originFilter,
    groupHighlight,
    periodHighlight,
    colorMode,
    temperatureC,
  ])

  const sortedRankingElements = useMemo(() => {
    const rows = elements.filter((el) => matchingZSet.has(el.atomicNumber))
    const mult = sortDir === 'asc' ? 1 : -1
    const cmpNum = (a: number | null, b: number | null) => {
      if (a === null && b === null) return 0
      if (a === null) return 1
      if (b === null) return -1
      return (a - b) * mult
    }
    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.nameFr.localeCompare(b.nameFr, 'fr') * mult
        case 'atomicMass':
          return (a.atomicMass - b.atomicMass) * mult
        case 'electronegativity':
          return cmpNum(a.electronegativity, b.electronegativity)
        case 'atomicRadiusPm':
          return cmpNum(a.atomicRadiusPm, b.atomicRadiusPm)
        case 'ionizationEnergyKjMol':
          return cmpNum(a.ionizationEnergyKjMol, b.ionizationEnergyKjMol)
        case 'meltingPointC':
          return cmpNum(a.meltingPointC, b.meltingPointC)
        case 'boilingPointC':
          return cmpNum(a.boilingPointC, b.boilingPointC)
        case 'densityGPerCm3':
          return cmpNum(a.densityGPerCm3, b.densityGPerCm3)
        case 'discoveryYear':
          return cmpNum(a.discoveryYear ?? -1000, b.discoveryYear ?? -1000)
        default:
          return (a.atomicNumber - b.atomicNumber) * mult
      }
    })
  }, [elements, matchingZSet, sortKey, sortDir])

  const toggleSort = (key: RankingSortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(
        key === 'electronegativity' ||
          key === 'ionizationEnergyKjMol' ||
          key === 'densityGPerCm3'
          ? 'desc'
          : 'asc',
      )
    }
  }

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (e.key === 'Escape' && document.activeElement === searchInputRef.current) {
        setQuery('')
        searchInputRef.current?.blur()
        return
      }
      const tag = (document.activeElement as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault()
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
        return
      }
      if (!selectedElement) return

      if (e.key === 'ArrowRight') {
        e.preventDefault()
        setSelectedZ((z) => Math.min(118, z + 1))
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        setSelectedZ((z) => Math.max(1, z - 1))
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const deltaRow = e.key === 'ArrowDown' ? 1 : -1
        const targetRow = selectedElement.gridRow + deltaRow
        const candidate = elements.find(
          (el) => el.gridRow === targetRow && el.gridCol === selectedElement.gridCol,
        )
        if (candidate) setSelectedZ(candidate.atomicNumber)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, elements, selectedElement])

  const handleSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'Enter') return
    const firstExact = exactMatchZSet.values().next().value
    if (firstExact !== undefined) {
      setSelectedZ(firstExact)
      searchInputRef.current?.blur()
      return
    }
    const firstMatch = matchingZSet.values().next().value
    if (firstMatch !== undefined) {
      setSelectedZ(firstMatch)
      searchInputRef.current?.blur()
    }
  }

  const stateCounts = useMemo(() => {
    let solid = 0
    let liquid = 0
    let gas = 0
    for (const el of elements) {
      const st = getElementStateAtTemperature(el, temperatureC)
      if (st === 'solid') solid++
      else if (st === 'liquid') liquid++
      else if (st === 'gas') gas++
    }
    return { solid, liquid, gas }
  }, [elements, temperatureC])

  if (!catalog) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="font-mono text-xs text-muted-foreground">
          Chargement du tableau périodique…
        </span>
      </div>
    )
  }

  const isHeatmapMode =
    colorMode === 'electronegativity' ||
    colorMode === 'radius' ||
    colorMode === 'ionization' ||
    colorMode === 'melting' ||
    colorMode === 'density'

  const showFloatingTableLegend =
    viewMode === 'table' && (colorMode === 'state' || isHeatmapMode)

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background select-none">
      <PeriodicFilterBar
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        colorMode={colorMode}
        onColorModeChange={setColorMode}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        onHoverCategory={setHoveredCategory}
        blockFilter={blockFilter}
        onBlockFilterChange={setBlockFilter}
        stateFilter={stateFilter}
        onStateFilterChange={setStateFilter}
        originFilter={originFilter}
        onOriginFilterChange={setOriginFilter}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={resetFilters}
        matchCount={matchingZSet.size}
        totalCount={elements.length}
      />

      {/* Main split: Periodic Grid / Ranking (left) + Element Inspector (right) */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Ranking mode: search bar below filters, directly above the list */}
          {viewMode === 'ranking' && (
            <div className="flex shrink-0 items-center justify-center border-b border-border/60 bg-background px-4 py-2.5">
              <div className="relative flex w-full max-w-2xl items-center">
                <Search
                  className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground"
                  strokeWidth={1.6}
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder="Rechercher un élément, symbole, Z, configuration ou découvreur…"
                  aria-label="Rechercher un élément"
                  className="h-9 w-full rounded-full border border-border bg-card pl-10 pr-12 text-[12.5px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    aria-label="Effacer la recherche"
                    className="absolute right-3 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <kbd className="pointer-events-none absolute right-4 font-mono text-[11px] text-muted-foreground/60">
                    ⌘K
                  </kbd>
                )}
              </div>
            </div>
          )}

          <div className="min-h-0 min-w-0 flex-1 overflow-auto">
            {viewMode === 'table' ? (
              <PeriodicGridView
                elements={elements}
                selectedZ={selectedElement?.atomicNumber ?? null}
                onSelectZ={setSelectedZ}
                matchingZSet={matchingZSet}
                exactMatchZSet={exactMatchZSet}
                hoveredCategory={hoveredCategory}
                categoryFilter={categoryFilter}
                onToggleCategory={(cat) =>
                  setCategoryFilter((prev) => (prev === cat ? 'all' : cat))
                }
                groupHighlight={groupHighlight}
                onToggleGroup={(g) => setGroupHighlight((prev) => (prev === g ? null : g))}
                periodHighlight={periodHighlight}
                onTogglePeriod={(p) => setPeriodHighlight((prev) => (prev === p ? null : p))}
                colorMode={colorMode}
                temperatureC={temperatureC}
                metricRanges={metricRanges}
                query={query}
                onQueryChange={setQuery}
                onSearchKeyDown={handleSearchKeyDown}
                searchInputRef={searchInputRef}
              />
            ) : (
              <PeriodicRankingTable
                elements={sortedRankingElements}
                selectedZ={selectedElement?.atomicNumber ?? null}
                exactMatchZSet={exactMatchZSet}
                sortKey={sortKey}
                sortDir={sortDir}
                onSort={toggleSort}
                onSelectZ={setSelectedZ}
              />
            )}
          </div>

          {/* Floating bottom legend/controls in table mode (temperature slider or heatmap scale) */}
          {showFloatingTableLegend && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 justify-center">
              {colorMode === 'state' ? (
                <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 rounded-xl border border-border bg-panel/95 px-3.5 py-2 shadow-2xl">
                  <div className="flex items-center gap-2.5">
                    <span className="whitespace-nowrap text-[11px] font-medium text-muted-foreground">
                      Température
                    </span>
                    <Slider
                      min={-273}
                      max={6000}
                      step={1}
                      snapPoints={[-273, -200, 0, 20, 100, 1000, 2000, 3500, 6000]}
                      value={temperatureC}
                      onChange={(v) => setTemperatureC(Math.round(v))}
                      ariaLabel="Température du tableau périodique en degrés Celsius"
                      className="w-40 sm:w-52"
                    />
                    <span className="min-w-[112px] whitespace-nowrap font-mono text-[11.5px] tabular-nums text-foreground">
                      {formatFrNumber(temperatureC, 0)} °C{' '}
                      <span className="text-[10.5px] text-muted-foreground">
                        ({formatFrNumber(temperatureC + 273.15, 0)} K)
                      </span>
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {[-200, 20, 100, 1000, 3500].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTemperatureC(t)}
                        className={cn(
                          'shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums',
                          temperatureC === t
                            ? 'bg-accent text-foreground'
                            : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                        )}
                      >
                        {t} °C
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-zinc-400" />
                      {stateCounts.solid}
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-sky-400" />
                      {stateCounts.liquid}
                    </span>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <span className="h-2 w-2 rounded-full bg-amber-400" />
                      {stateCounts.gas}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="pointer-events-auto flex flex-wrap items-center gap-3 rounded-xl border border-border bg-panel/95 px-3.5 py-2 shadow-2xl">
                  <span className="whitespace-nowrap text-[11px] text-muted-foreground">
                    {colorMode === 'electronegativity' && 'Échelle de Pauling (χ)'}
                    {colorMode === 'radius' && 'Rayon atomique (pm)'}
                    {colorMode === 'ionization' && '1ʳᵉ énergie d’ionisation (kJ/mol)'}
                    {colorMode === 'melting' && 'Point de fusion (°C)'}
                    {colorMode === 'density' && 'Masse volumique (échelle log, g/cm³)'}
                  </span>
                  <div className="flex items-center gap-2 whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
                    <span>
                      {colorMode === 'electronegativity' &&
                        formatFrNumber(metricRanges.electronegativity.min, 2)}
                      {colorMode === 'radius' && `${metricRanges.radius.min} pm`}
                      {colorMode === 'ionization' &&
                        `${Math.round(metricRanges.ionization.min)} kJ/mol`}
                      {colorMode === 'melting' && `${Math.round(metricRanges.melting.min)} °C`}
                      {colorMode === 'density' && '0,00009 g/cm³'}
                    </span>
                    <span
                      className="h-2 w-32 rounded-full border border-border/60"
                      style={{
                        background:
                          'linear-gradient(90deg, rgba(30,58,115,0.45), rgba(14,165,233,0.55), rgba(245,158,11,0.65))',
                      }}
                    />
                    <span>
                      {colorMode === 'electronegativity' &&
                        formatFrNumber(metricRanges.electronegativity.max, 2)}
                      {colorMode === 'radius' && `${metricRanges.radius.max} pm`}
                      {colorMode === 'ionization' &&
                        `${Math.round(metricRanges.ionization.max)} kJ/mol`}
                      {colorMode === 'melting' && `${Math.round(metricRanges.melting.max)} °C`}
                      {colorMode === 'density' && '22,6 g/cm³'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedElement && (
          <aside
            aria-label="Inspecteur d’élément"
            className="flex w-84 shrink-0 flex-col border-l border-border bg-panel lg:w-96"
          >
            <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-3">
              <span className="truncate font-mono text-[11px] tabular-nums text-muted-foreground">
                Z = {selectedElement.atomicNumber} · Période {selectedElement.period}
                {selectedElement.groupNum ? ` · Groupe ${selectedElement.groupNum}` : ' · Bloc f'}
              </span>
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={selectedElement.atomicNumber <= 1}
                  onClick={() => setSelectedZ((z) => Math.max(1, z - 1))}
                  aria-label="Élément précédent"
                >
                  <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.7} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={selectedElement.atomicNumber >= 118}
                  onClick={() => setSelectedZ((z) => Math.min(118, z + 1))}
                  aria-label="Élément suivant"
                >
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.7} />
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
              <PeriodicElementInspector
                element={selectedElement}
                catalog={catalog}
                temperatureC={colorMode === 'state' ? temperatureC : 20}
                onSpawn={() => onSpawnToWorkbench({ kind: 'atom', element: selectedElement })}
                onJumpToSpecies={onJumpToSpecies}
              />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
})
