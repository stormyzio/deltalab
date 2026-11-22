import type { RefObject } from 'react'
import { Plus } from 'lucide-react'
import type {
  CatalogReactionRecord,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  VesselRecord,
} from '../../../shared/chemistry.ts'
import {
  REACTION_CATEGORY_LABEL,
  SPECIES_KIND_LABEL,
  STATE_META,
  formatCapacityMl,
  formatFrNumber,
} from '@/lib/chemistry-ui'
import { describeWaterBehavior } from '@/lib/water-behavior'
import { cn } from '@/lib/utils'
import { ChemFormula } from '@/components/ui/chem-text'
import { InfiniteScrollSentinel } from '@/components/ui/infinite-scroll-sentinel'
import { VesselArtwork } from '@/components/VesselArtwork'
import { type ReactionSpawnSetup, type SortDir, SortTh } from './CatalogShared'
export { ReactionConstantsTables } from './ReactionConstantsTables'

export function SpeciesCatalogTable({
  displayedSpecies,
  totalFilteredCount,
  selectedSpeciesId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  onLoadMore,
  scrollRootRef,
}: {
  displayedSpecies: CatalogSpeciesRecord[]
  totalFilteredCount: number
  selectedSpeciesId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
  onLoadMore: () => void
  scrollRootRef?: RefObject<HTMLElement | null>
}) {
  return (
    <>
      <table className="w-full table-fixed border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
          <tr>
            <SortTh label="Formule" activeKey={sortKey} colKey="formula" dir={sortDir} onSort={onSort} className="w-[15%] pl-4 pr-4" />
            <SortTh label="Nom" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="w-[26%] px-4" />
            <SortTh label="Type" activeKey={sortKey} colKey="kind" dir={sortDir} onSort={onSort} className="hidden w-[15%] px-4 md:table-cell" />
            <SortTh label="Masse" activeKey={sortKey} colKey="mass" dir={sortDir} onSort={onSort} align="right" className="hidden w-[12%] pl-4 pr-6 sm:table-cell" />
            <SortTh label={<>Solubilité <ChemFormula value="H2O" /></>} activeKey={sortKey} colKey="solubility" dir={sortDir} onSort={onSort} className="hidden w-[17%] px-4 lg:table-cell" />
            <th className="hidden w-[15%] whitespace-nowrap py-2 pl-4 pr-4 font-medium xl:table-cell">En solution</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {displayedSpecies.map((sp) => {
            const isSel = selectedSpeciesId === sp.id
            const dotColor = sp.solutionColorHex ?? (sp.isSolvent ? '#bae6fd' : null)
            const isUnknownSolubility =
              sp.source !== 'curated' &&
              !sp.canDissolveInWater &&
              sp.solubilityGPerL === null
            return (
              <tr
                key={sp.id}
                onClick={() => onSelect(sp.id)}
                className={cn(isSel ? 'bg-accent/80' : 'hover:bg-accent/40')}
              >
                <td className="overflow-hidden whitespace-nowrap py-2.5 pl-4 pr-4 font-medium text-foreground">
                  <div className="flex min-w-0 items-center gap-1.5">
                    {dotColor && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    <span className="truncate text-[13px] font-semibold tracking-tight">
                      <ChemFormula value={sp.displayFormula} />
                    </span>
                    {sp.kind !== 'ion' && (
                      <span className="shrink-0 text-[9.5px] text-muted-foreground">
                        {STATE_META[sp.standardState].tag}
                      </span>
                    )}
                  </div>
                </td>
                <td className="overflow-hidden px-4 py-2.5 text-zinc-200">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{sp.nameFr}</span>
                    {sp.source === 'pubchem_live' && (
                      <span className="shrink-0 whitespace-nowrap text-[9.5px] text-muted-foreground">
                        PubChem
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden truncate px-4 py-2.5 text-muted-foreground md:table-cell">
                  {sp.families[0] ?? SPECIES_KIND_LABEL[sp.kind]}
                </td>
                <td className="hidden whitespace-nowrap py-2.5 pl-4 pr-6 text-right text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                  {formatFrNumber(sp.molarMass, 2)} g/mol
                </td>
                <td className="hidden truncate px-4 py-2.5 lg:table-cell">
                  {(() => {
                    const wb = describeWaterBehavior(sp, isUnknownSolubility)
                    return (
                      <span
                        className={cn(
                          'text-[10.5px] tabular-nums',
                          wb.isEffectivelySoluble
                            ? 'text-zinc-200'
                            : 'text-muted-foreground',
                        )}
                      >
                        {wb.tierLabel}
                        {wb.valueLabel && (
                          <span className="ml-1.5 text-muted-foreground">
                            {wb.valueLabel}
                          </span>
                        )}
                      </span>
                    )
                  })()}
                </td>
                <td className="hidden truncate py-2.5 pl-4 pr-4 text-[11px] text-muted-foreground xl:table-cell">
                  {sp.dissolutionProducts.length > 0
                    ? sp.dissolutionProducts.map((p, idx) => (
                        <span key={p.speciesId}>
                          {idx > 0 && ' + '}
                          {p.stoichiometry > 1 ? `${p.stoichiometry} ` : ''}
                          <ChemFormula value={p.displayFormula} />
                        </span>
                      ))
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <InfiniteScrollSentinel
        hasMore={totalFilteredCount > displayedSpecies.length}
        onLoadMore={onLoadMore}
        scrollRootRef={scrollRootRef}
        loadedCount={displayedSpecies.length}
        totalCount={totalFilteredCount}
      />
    </>
  )
}

export function SolutionsCatalogTable({
  solutions,
  selectedSolutionId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: {
  solutions: CatalogSolutionRecord[]
  selectedSolutionId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Solution" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="pl-4" />
          <SortTh label="Formule aqueuse" activeKey={sortKey} colKey="formula" dir={sortDir} onSort={onSort} className="w-44" />
          <th className="hidden w-32 whitespace-nowrap px-3 py-2 font-medium md:table-cell">Soluté</th>
          <SortTh label="pH" activeKey={sortKey} colKey="ph" dir={sortDir} onSort={onSort} align="right" className="w-16 pr-4" />
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {solutions.map((sol) => {
          const isSel = selectedSolutionId === sol.id
          return (
            <tr
              key={sol.id}
              onClick={() => onSelect(sol.id)}
              className={cn(isSel ? 'bg-accent/80' : 'hover:bg-accent/40')}
            >
              <td className="py-2.5 pl-4 pr-3 font-medium text-foreground">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/15"
                    style={{ backgroundColor: sol.colorHex ?? '#bae6fd' }}
                  />
                  <span className="truncate">{sol.nameFr}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-[11.5px] text-zinc-200">
                <ChemFormula value={sol.formulaLabel} />
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground md:table-cell">
                {sol.soluteFormulas.map((f, idx) => (
                  <span key={`${sol.id}-s-${idx}`}>
                    {idx > 0 && ' + '}
                    <ChemFormula value={f} />
                  </span>
                ))}
              </td>
              <td
                className={cn(
                  'whitespace-nowrap py-2.5 pl-3 pr-4 text-right text-[11px] tabular-nums',
                  sol.phEstimate === null ? 'text-muted-foreground' : 'text-zinc-200',
                )}
              >
                {sol.phEstimate !== null ? formatFrNumber(sol.phEstimate, 1) : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function NamedReactionsTable({
  reactions,
  selectedReactionId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  onSpawnReactionSetup,
}: {
  reactions: CatalogReactionRecord[]
  selectedReactionId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Réaction" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="w-[28%] pl-4" />
          <th className="hidden w-28 whitespace-nowrap px-3 py-2 font-medium sm:table-cell">Type</th>
          <th className="whitespace-nowrap px-3 py-2 font-medium">Équation</th>
          <th className="hidden w-24 whitespace-nowrap px-3 py-2 font-medium md:table-cell">Milieu</th>
          <th className="w-28 whitespace-nowrap px-3 py-2 pr-4 text-right font-medium">Simulation</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {reactions.map((rxn) => {
          const isSel = selectedReactionId === rxn.id
          return (
            <tr
              key={rxn.id}
              onClick={() => onSelect(rxn.id)}
              className={cn(isSel ? 'bg-accent/80' : 'hover:bg-accent/40')}
            >
              <td className="py-2.5 pl-4 pr-3 font-medium text-foreground">{rxn.nameFr}</td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-[11px] text-muted-foreground sm:table-cell">
                {REACTION_CATEGORY_LABEL[rxn.category] ?? rxn.category}
              </td>
              <td className="px-3 py-2.5 text-[11.5px] text-zinc-200">
                <ChemFormula value={rxn.equationDisplay} />
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground md:table-cell">
                {rxn.medium === 'aqueous'
                  ? 'Aqueux'
                  : rxn.medium === 'gas'
                    ? 'Gazeux'
                    : rxn.medium === 'solid'
                      ? 'Solide'
                      : 'Tout milieu'}
              </td>
              <td className="whitespace-nowrap py-2 pl-2 pr-4 text-right">
                {onSpawnReactionSetup && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onSpawnReactionSetup({
                        titleFr: rxn.nameFr,
                        medium: rxn.medium,
                        reactants: rxn.reactants.map((r) => ({
                          speciesId: r.speciesId,
                          stoichiometry: r.stoichiometry,
                        })),
                      })
                    }}
                    className="inline-flex h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded px-2 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <Plus className="h-3 w-3 shrink-0" strokeWidth={1.7} />
                    <span>Paillasse</span>
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function VesselsCatalogTable({
  vessels,
  selectedVesselId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
}: {
  vessels: VesselRecord[]
  selectedVesselId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
}) {
  return (
    <table className="w-full table-fixed border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Verrerie" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="w-52 pl-4" />
          <SortTh label="Capacité" activeKey={sortKey} colKey="capacity" dir={sortDir} onSort={onSort} align="right" className="w-32" />
          <th className="whitespace-nowrap px-3 py-2 font-medium">Usage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {vessels.map((v) => {
          const isSel = selectedVesselId === v.id
          return (
            <tr
              key={v.id}
              onClick={() => onSelect(v.id)}
              className={cn(isSel ? 'bg-accent/80' : 'hover:bg-accent/40')}
            >
              <td className="whitespace-nowrap py-2.5 pl-4 pr-3 font-medium text-foreground">
                <div className="flex items-center gap-2.5">
                  <VesselArtwork
                    vesselType={v.vesselType}
                    fillRatio={0}
                    liquidColorHex={null}
                    liquidOpacity={0}
                    size="sm"
                    className="h-7 w-6 shrink-0"
                  />
                  <span>{v.nameFr}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right text-[11px] tabular-nums text-zinc-200">
                {v.availableCapacitiesMl.length > 1
                  ? `${formatCapacityMl(v.availableCapacitiesMl[0])} – ${formatCapacityMl(v.availableCapacitiesMl[v.availableCapacitiesMl.length - 1])}`
                  : formatCapacityMl(v.capacityMl)}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{v.descriptionShort}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
