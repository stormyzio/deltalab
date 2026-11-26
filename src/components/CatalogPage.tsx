import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Search, X } from 'lucide-react'
import {
  type AlloyRecord,
  type CatalogSolutionRecord,
  type ElementRecord,
  type FullCatalogResponse,
  type ReactionConstantsResponse,
  type SpeciesKind,
  type SpeciesRecord,
  isMonatomicSolidSpecies,
} from '../../shared/chemistry.ts'
import type { ExternalDragItem } from '@/types/drag'
import type { CatalogJumpTarget } from '@/components/InspectorPanel'
import { api } from '@/lib/api'
import { normalizeChemSearch, normalizeFormulaSearch } from '@/lib/chemistry-calc'
import { describeWaterBehavior, getSolubilitySortValue } from '@/lib/water-behavior'
import {
  type CatalogSection,
  type ReactionSpawnSetup,
  type ReactionSubTab,
  type SortDir,
} from '@/components/catalog/CatalogShared'
import { CatalogFilterBar } from '@/components/catalog/CatalogFilterBar'
import {
  AlloyDetail,
  AlloysCatalogTable,
} from '@/components/catalog/AlloysCatalogView'
import {
  NamedReactionsTable,
  ReactionConstantsTables,
  SolutionsCatalogTable,
  SpeciesCatalogTable,
  VesselsCatalogTable,
} from '@/components/catalog/CatalogTables'
import { SpeciesDetail } from '@/components/catalog/SpeciesDetail'
import {
  ReactionDetail,
  SolutionDetail,
  VesselDetail,
} from '@/components/catalog/CatalogEntityDetails'

export type CatalogJumpRequest = CatalogJumpTarget & { nonce: number }

interface CatalogPageProps {
  catalog: FullCatalogResponse | null
  section: CatalogSection
  onSectionChange: (section: CatalogSection) => void
  jumpTarget: CatalogJumpRequest | null
  active?: boolean
  onSpawnToWorkbench: (item: ExternalDragItem) => void
  onSpawnAlloy?: (alloy: AlloyRecord) => void
  onSpawnSolution?: (solution: CatalogSolutionRecord) => void
  onOpenInLewisBuilder: (species: SpeciesRecord) => void
  onOpenElementInPeriodic?: (atomicNumber: number) => void
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}

export const CatalogPage = memo(function CatalogPage({
  catalog,
  section,
  onSectionChange,
  jumpTarget,
  active = true,
  onSpawnToWorkbench,
  onSpawnAlloy,
  onSpawnSolution,
  onOpenInLewisBuilder,
  onOpenElementInPeriodic,
  onSpawnReactionSetup,
}: CatalogPageProps) {
  const resolveSection = (s?: CatalogJumpTarget['section']): CatalogSection =>
    s && s !== 'elements' ? s : 'species'

  const [query, setQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const listScrollRef = useRef<HTMLDivElement>(null)

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
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active])

  const [speciesKindFilter, setSpeciesKindFilter] = useState<SpeciesKind | 'all'>('all')
  const [solubilityFilter, setSolubilityFilter] = useState<'all' | 'soluble' | 'insoluble'>('all')
  const [solutionPhFilter, setSolutionPhFilter] = useState<
    'all' | 'acid' | 'neutral' | 'base' | 'colored'
  >('all')
  const [reactionSubTab, setReactionSubTab] = useState<ReactionSubTab>('named')
  const [alloyFamilyFilter, setAlloyFamilyFilter] = useState<string>('all')
  const [reactionConstants, setReactionConstants] =
    useState<ReactionConstantsResponse | null>(null)
  const [visibleSpeciesCount, setVisibleSpeciesCount] = useState(120)

  const elementsBySymbol = useMemo(() => {
    const map = new Map<string, ElementRecord>()
    for (const el of catalog?.elements ?? []) map.set(el.symbol, el)
    return map
  }, [catalog])

  useEffect(() => {
    if (section !== 'reactions' || reactionConstants !== null) return
    let cancelled = false
    api
      .getReactionConstants()
      .then((res) => {
        if (!cancelled) setReactionConstants(res)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [section, reactionConstants])

  const [sortBySection, setSortBySection] = useState<
    Record<CatalogSection, { key: string; dir: SortDir }>
  >({
    species: { key: 'popularity', dir: 'desc' },
    solutions: { key: 'name', dir: 'asc' },
    reactions: { key: 'name', dir: 'asc' },
    vessels: { key: 'name', dir: 'asc' },
    alloys: { key: 'default', dir: 'asc' },
  })
  const [selectedBySection, setSelectedBySection] = useState<
    Record<CatalogSection, string | null>
  >(() => {
    const initialSec = resolveSection(jumpTarget?.section)
    return {
      species: initialSec === 'species' ? (jumpTarget?.id ?? null) : null,
      solutions: initialSec === 'solutions' ? (jumpTarget?.id ?? null) : null,
      reactions: initialSec === 'reactions' ? (jumpTarget?.id ?? null) : null,
      vessels: initialSec === 'vessels' ? (jumpTarget?.id ?? null) : null,
      alloys: initialSec === 'alloys' ? (jumpTarget?.id ?? null) : null,
    }
  })

  const [appliedJumpNonce, setAppliedJumpNonce] = useState<number>(
    () => jumpTarget?.nonce ?? 0,
  )
  if (jumpTarget && jumpTarget.nonce !== appliedJumpNonce) {
    setAppliedJumpNonce(jumpTarget.nonce)
    const targetSec = resolveSection(jumpTarget.section)
    if (targetSec === 'reactions') setReactionSubTab('named')
    setSelectedBySection((prev) => ({
      ...prev,
      [targetSec]: jumpTarget.id ?? prev[targetSec],
    }))
    setQuery('')
  }

  const sortKey = sortBySection[section].key
  const sortDir = sortBySection[section].dir
  const selectedId = selectedBySection[section]
  const setSelectedId = (id: string | null) =>
    setSelectedBySection((prev) => ({ ...prev, [section]: id }))

  const toggleSort = (key: string) => {
    setSortBySection((prev) => {
      const curr = prev[section]
      if (curr.key === key) {
        return { ...prev, [section]: { key, dir: curr.dir === 'asc' ? 'desc' : 'asc' } }
      }
      return {
        ...prev,
        [section]: {
          key,
          dir: key === 'popularity' || key === 'solubility' ? 'desc' : 'asc',
        },
      }
    })
    if (section === 'species') {
      setVisibleSpeciesCount(150)
      listScrollRef.current?.scrollTo({ top: 0 })
    }
  }

  const jumpToSpecies = (speciesId: string) => {
    const sp = catalog?.species.find((s) => s.id === speciesId)
    if (sp && isMonatomicSolidSpecies(sp)) {
      const sym = Object.keys(sp.composition)[0]
      const el = sym ? catalog?.elements.find((e) => e.symbol === sym) : null
      if (el && onOpenElementInPeriodic) {
        onOpenElementInPeriodic(el.atomicNumber)
        return
      }
    }
    onSectionChange('species')
    setSpeciesKindFilter('all')
    setSolubilityFilter('all')
    setQuery('')
    setSelectedBySection((prev) => ({ ...prev, species: speciesId }))
  }

  const jumpToElement = (symbol: string) => {
    const el = catalog?.elements.find((e) => e.symbol === symbol)
    if (!el) return
    onOpenElementInPeriodic?.(el.atomicNumber)
  }

  const jumpToSolution = (solutionId: string) => {
    onSectionChange('solutions')
    setSolutionPhFilter('all')
    setQuery('')
    setSelectedBySection((prev) => ({ ...prev, solutions: solutionId }))
  }

  const q = normalizeChemSearch(query)
  const qCompact = normalizeFormulaSearch(query)

  const filteredSpecies = useMemo(() => {
    if (!catalog) return []
    const rows = catalog.species.filter((sp) => {
      if (isMonatomicSolidSpecies(sp)) return false
      if (speciesKindFilter !== 'all' && sp.kind !== speciesKindFilter) return false
      if (solubilityFilter === 'soluble' && !describeWaterBehavior(sp).isEffectivelySoluble) {
        return false
      }
      if (solubilityFilter === 'insoluble') {
        const wb = describeWaterBehavior(sp)
        if (wb.isEffectivelySoluble || wb.tier === 'unknown') return false
      }
      if (!q) return true
      return (
        normalizeChemSearch(sp.nameFr).includes(q) ||
        normalizeChemSearch(sp.iupacName ?? '').includes(q) ||
        (sp.casNumber ?? '').toLowerCase().includes(qCompact) ||
        normalizeFormulaSearch(sp.formula).includes(qCompact) ||
        normalizeFormulaSearch(sp.displayFormula).includes(qCompact) ||
        sp.id.toLowerCase().includes(qCompact) ||
        sp.families.some((f) => normalizeChemSearch(f).includes(q))
      )
    })

    const mult = sortDir === 'asc' ? 1 : -1
    if (sortKey === 'solubility') {
      const sortValById = new Map<string, number | null>()
      for (const sp of rows) sortValById.set(sp.id, getSolubilitySortValue(sp))
      return [...rows].sort((a, b) => {
        const va = sortValById.get(a.id) ?? null
        const vb = sortValById.get(b.id) ?? null
        if (va === null && vb === null) return a.nameFr < b.nameFr ? -1 : a.nameFr > b.nameFr ? 1 : 0
        if (va === null) return 1
        if (vb === null) return -1
        if (va !== vb) return (va - vb) * mult
        return a.nameFr < b.nameFr ? -1 : a.nameFr > b.nameFr ? 1 : 0
      })
    }

    return [...rows].sort((a, b) => {
      switch (sortKey) {
        case 'popularity':
          if (a.popularity !== b.popularity) return (a.popularity - b.popularity) * mult
          return a.nameFr < b.nameFr ? -1 : a.nameFr > b.nameFr ? 1 : 0
        case 'formula':
          return (a.formula < b.formula ? -1 : a.formula > b.formula ? 1 : 0) * mult
        case 'kind':
          return (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) * mult
        case 'mass':
          return (a.molarMass - b.molarMass) * mult
        case 'charge':
          return (a.charge - b.charge) * mult
        default:
          return a.nameFr.localeCompare(b.nameFr, 'fr') * mult
      }
    })
  }, [catalog, q, qCompact, speciesKindFilter, solubilityFilter, sortKey, sortDir])

  const filteredSolutions = useMemo(() => {
    if (!catalog) return []
    const rows = catalog.solutions.filter((sol) => {
      if (solutionPhFilter === 'acid' && !(sol.phEstimate !== null && sol.phEstimate < 6.5))
        return false
      if (
        solutionPhFilter === 'neutral' &&
        !(sol.phEstimate !== null && sol.phEstimate >= 6.5 && sol.phEstimate <= 7.5)
      )
        return false
      if (solutionPhFilter === 'base' && !(sol.phEstimate !== null && sol.phEstimate > 7.5))
        return false
      if (
        solutionPhFilter === 'colored' &&
        (!sol.colorHex || sol.colorHex === '#bae6fd' || sol.colorHex === '#e0f2fe')
      )
        return false
      if (!q) return true
      return (
        normalizeChemSearch(sol.nameFr).includes(q) ||
        normalizeFormulaSearch(sol.formulaLabel).includes(qCompact) ||
        sol.soluteFormulas.some((f) => normalizeFormulaSearch(f).includes(qCompact))
      )
    })

    const mult = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortKey === 'ph') return ((a.phEstimate ?? -1) - (b.phEstimate ?? -1)) * mult
      if (sortKey === 'formula') return a.formulaLabel.localeCompare(b.formulaLabel) * mult
      return a.nameFr.localeCompare(b.nameFr, 'fr') * mult
    })
  }, [catalog, q, qCompact, solutionPhFilter, sortKey, sortDir])

  const filteredReactions = useMemo(() => {
    if (!catalog) return []
    const rows = catalog.reactions.filter((r) => {
      if (!q) return true
      return (
        normalizeChemSearch(r.nameFr).includes(q) ||
        normalizeFormulaSearch(r.equationDisplay).includes(qCompact) ||
        normalizeChemSearch(r.category).includes(q) ||
        normalizeChemSearch(r.observationsFr ?? '').includes(q)
      )
    })
    const mult = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => a.nameFr.localeCompare(b.nameFr, 'fr') * mult)
  }, [catalog, q, qCompact, sortDir])

  const filteredRedox = useMemo(() => {
    const list = reactionConstants?.redoxCouples ?? []
    if (!q) return list
    return list.filter(
      (c) =>
        normalizeFormulaSearch(c.coupleLabel).includes(qCompact) ||
        normalizeFormulaSearch(c.halfEquation).includes(qCompact) ||
        normalizeFormulaSearch(c.oxFormula).includes(qCompact) ||
        normalizeFormulaSearch(c.redFormula).includes(qCompact),
    )
  }, [reactionConstants, q, qCompact])

  const filteredKs = useMemo(() => {
    const list = reactionConstants?.solubilityProducts ?? []
    if (!q) return list
    return list.filter(
      (k) =>
        normalizeFormulaSearch(k.solidFormula).includes(qCompact) ||
        normalizeChemSearch(k.solidNameFr).includes(q) ||
        normalizeFormulaSearch(k.cationFormula).includes(qCompact) ||
        normalizeFormulaSearch(k.anionFormula).includes(qCompact),
    )
  }, [reactionConstants, q, qCompact])

  const filteredAb = useMemo(() => {
    const list = reactionConstants?.acidBaseCouples ?? []
    if (!q) return list
    return list.filter(
      (ab) =>
        normalizeFormulaSearch(ab.acidFormula).includes(qCompact) ||
        normalizeFormulaSearch(ab.baseFormula).includes(qCompact) ||
        normalizeChemSearch(ab.acidNameFr).includes(q),
    )
  }, [reactionConstants, q, qCompact])

  const filteredVessels = useMemo(() => {
    if (!catalog) return []
    const rows = catalog.vessels.filter((v) => {
      if (!q) return true
      return (
        normalizeChemSearch(v.nameFr).includes(q) ||
        normalizeChemSearch(v.descriptionShort).includes(q) ||
        v.vesselType.toLowerCase().includes(q)
      )
    })
    const mult = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortKey === 'capacity') return (a.capacityMl - b.capacityMl) * mult
      return a.nameFr.localeCompare(b.nameFr, 'fr') * mult
    })
  }, [catalog, q, sortKey, sortDir])

  const alloyFamilies = useMemo(() => {
    const counts = new Map<string, number>()
    for (const al of catalog?.alloys ?? []) {
      counts.set(al.familyFr, (counts.get(al.familyFr) ?? 0) + 1)
    }
    return [...counts.entries()]
      .filter(([, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1])
      .map(([fam]) => fam)
  }, [catalog])

  const filteredAlloys = useMemo(() => {
    if (!catalog) return []
    const rows = (catalog.alloys ?? []).filter((al) => {
      if (alloyFamilyFilter !== 'all' && al.familyFr !== alloyFamilyFilter) return false
      if (!q) return true
      return (
        normalizeChemSearch(al.nameFr).includes(q) ||
        normalizeFormulaSearch(al.nameFr).includes(qCompact) ||
        normalizeChemSearch(al.familyFr).includes(q) ||
        normalizeChemSearch(al.usesFr).includes(q) ||
        al.components.some(
          (c) =>
            c.symbol.toLowerCase() === qCompact ||
            normalizeChemSearch(elementsBySymbol.get(c.symbol)?.nameFr ?? '').includes(q),
        )
      )
    })
    if (sortKey === 'default') return rows
    const mult = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      if (sortKey === 'family') return a.familyFr.localeCompare(b.familyFr, 'fr') * mult
      if (sortKey === 'density') return (a.densityGPerCm3 - b.densityGPerCm3) * mult
      if (sortKey === 'melting') {
        return ((a.meltingPointC ?? -9999) - (b.meltingPointC ?? -9999)) * mult
      }
      return a.nameFr.localeCompare(b.nameFr, 'fr') * mult
    })
  }, [alloyFamilyFilter, catalog, elementsBySymbol, q, qCompact, sortDir, sortKey])

  const displayedSpecies = useMemo(
    () => filteredSpecies.slice(0, visibleSpeciesCount),
    [filteredSpecies, visibleSpeciesCount],
  )

  const selectedSpecies =
    section === 'species'
      ? (filteredSpecies.find((s) => s.id === selectedId) ?? filteredSpecies[0] ?? null)
      : null
  const selectedSolution =
    section === 'solutions'
      ? (filteredSolutions.find((s) => s.id === selectedId) ?? filteredSolutions[0] ?? null)
      : null
  const selectedReaction =
    section === 'reactions'
      ? (filteredReactions.find((r) => r.id === selectedId) ?? filteredReactions[0] ?? null)
      : null
  const selectedVessel =
    section === 'vessels'
      ? (filteredVessels.find((v) => v.id === selectedId) ?? filteredVessels[0] ?? null)
      : null
  const selectedAlloy =
    section === 'alloys'
      ? (filteredAlloys.find((a) => a.id === selectedId) ?? filteredAlloys[0] ?? null)
      : null

  const activeCount =
    section === 'species'
      ? filteredSpecies.length
      : section === 'solutions'
        ? filteredSolutions.length
        : section === 'reactions'
          ? reactionSubTab === 'named'
            ? filteredReactions.length
            : reactionSubTab === 'redox'
              ? filteredRedox.length
              : reactionSubTab === 'ks'
                ? filteredKs.length
                : filteredAb.length
          : section === 'alloys'
            ? filteredAlloys.length
            : filteredVessels.length

  if (!catalog) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <span className="text-xs text-muted-foreground">
          Chargement du catalogue SQLite…
        </span>
      </div>
    )
  }

  const searchPlaceholder =
    section === 'species'
      ? 'Rechercher une espèce, formule, famille ou n° CAS…'
      : section === 'solutions'
        ? 'Rechercher une solution aqueuse ou un soluté…'
        : section === 'reactions'
          ? 'Rechercher une réaction, un couple redox, pKa ou Ks…'
          : section === 'alloys'
            ? 'Rechercher un alliage, un métal (Fe, Cu, Ti…) ou un usage…'
            : 'Rechercher une verrerie ou une capacité…'

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      {/* Prominent pill search bar */}
      <div className="flex shrink-0 items-center justify-center border-b border-border bg-panel px-4 py-2.5">
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
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="h-10 w-full rounded-full border border-border bg-card pl-10 pr-12 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:border-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
            <kbd className="pointer-events-none absolute right-4 text-[11px] text-muted-foreground/60">
              ⌘K
            </kbd>
          )}
        </div>
      </div>

      <CatalogFilterBar
        section={section}
        catalog={catalog}
        reactionConstants={reactionConstants}
        speciesKindFilter={speciesKindFilter}
        onSpeciesKindFilter={(val) => {
          setSpeciesKindFilter(val)
          setVisibleSpeciesCount(120)
        }}
        solubilityFilter={solubilityFilter}
        onSolubilityFilter={(val) => {
          setSolubilityFilter(val)
          setVisibleSpeciesCount(120)
        }}
        solutionPhFilter={solutionPhFilter}
        onSolutionPhFilter={setSolutionPhFilter}
        reactionSubTab={reactionSubTab}
        onReactionSubTab={setReactionSubTab}
        alloyFamilyFilter={alloyFamilyFilter}
        onAlloyFamilyFilter={setAlloyFamilyFilter}
        alloyFamilies={alloyFamilies}
        activeCount={activeCount}
      />

      {/* Master-detail split */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={listScrollRef} className="min-w-0 flex-1 overflow-y-auto">
          {section === 'species' && (
            <SpeciesCatalogTable
              displayedSpecies={displayedSpecies}
              totalFilteredCount={filteredSpecies.length}
              selectedSpeciesId={selectedSpecies?.id ?? null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onSelect={setSelectedId}
              onLoadMore={() => setVisibleSpeciesCount((c) => c + 150)}
              scrollRootRef={listScrollRef}
            />
          )}

          {section === 'solutions' && (
            <SolutionsCatalogTable
              solutions={filteredSolutions}
              selectedSolutionId={selectedSolution?.id ?? null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onSelect={setSelectedId}
              onSpawnSolution={onSpawnSolution}
            />
          )}

          {section === 'reactions' && reactionSubTab === 'named' && (
            <NamedReactionsTable
              reactions={filteredReactions}
              selectedReactionId={selectedReaction?.id ?? null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onSelect={setSelectedId}
              onSpawnReactionSetup={onSpawnReactionSetup}
            />
          )}

          {section === 'reactions' &&
            (reactionSubTab === 'redox' ||
              reactionSubTab === 'ks' ||
              reactionSubTab === 'pka') && (
              <ReactionConstantsTables
                subTab={reactionSubTab}
                redox={filteredRedox}
                ks={filteredKs}
                ab={filteredAb}
                scrollRootRef={listScrollRef}
                onSpawnReactionSetup={onSpawnReactionSetup}
              />
            )}

          {section === 'vessels' && (
            <VesselsCatalogTable
              vessels={filteredVessels}
              selectedVesselId={selectedVessel?.id ?? null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onSelect={setSelectedId}
            />
          )}

          {section === 'alloys' && (
            <AlloysCatalogTable
              alloys={filteredAlloys}
              selectedAlloyId={selectedAlloy?.id ?? null}
              sortKey={sortKey}
              sortDir={sortDir}
              onSort={toggleSort}
              onSelect={setSelectedId}
              onSpawnAlloy={onSpawnAlloy}
            />
          )}

          {activeCount === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-xs font-medium text-foreground">Aucun résultat</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Ajustez la recherche ou les filtres actifs.
              </p>
            </div>
          )}
        </div>

        {!(section === 'reactions' && reactionSubTab !== 'named') && (
          <aside className="hidden w-80 shrink-0 overflow-y-auto border-l border-border bg-panel p-4 lg:block xl:w-96">
            {selectedSpecies && (
              <SpeciesDetail
                species={selectedSpecies}
                catalog={catalog}
                onJumpToElement={jumpToElement}
                onJumpToSpecies={jumpToSpecies}
                onJumpToSolution={jumpToSolution}
                onSpawn={() =>
                  onSpawnToWorkbench({ kind: 'molecule', species: selectedSpecies })
                }
                onEditLewis={() => onOpenInLewisBuilder(selectedSpecies)}
                onSpawnReactionSetup={onSpawnReactionSetup}
              />
            )}

            {selectedSolution && (
              <SolutionDetail
                solution={selectedSolution}
                onJumpToSpecies={jumpToSpecies}
                onSpawn={
                  onSpawnSolution ? () => onSpawnSolution(selectedSolution) : undefined
                }
              />
            )}

            {selectedReaction && (
              <ReactionDetail
                reaction={selectedReaction}
                onJumpToSpecies={jumpToSpecies}
                onSpawnReactionSetup={onSpawnReactionSetup}
              />
            )}

            {selectedVessel && (
              <VesselDetail
                vessel={selectedVessel}
                onSpawn={() =>
                  onSpawnToWorkbench({ kind: 'vessel', vessel: selectedVessel })
                }
              />
            )}

            {selectedAlloy && (
              <AlloyDetail
                alloy={selectedAlloy}
                elementsBySymbol={elementsBySymbol}
                onJumpToElement={jumpToElement}
                onSpawn={onSpawnAlloy ? () => onSpawnAlloy(selectedAlloy) : undefined}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  )
})
