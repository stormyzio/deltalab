import { Plus } from 'lucide-react'
import type {
  AcidBaseCoupleRecord,
  CatalogReactionRecord,
  CatalogSolutionRecord,
  CatalogSpeciesRecord,
  RedoxCoupleRecord,
  SolubilityProductRecord,
  VesselRecord,
} from '../../../shared/chemistry.ts'
import {
  REACTION_CATEGORY_LABEL,
  SPECIES_KIND_LABEL,
  STATE_META,
  formatCapacityMl,
  formatFrNumber,
} from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { VesselArtwork } from '@/components/VesselArtwork'
import { type ReactionSpawnSetup, type SortDir, SortTh } from './CatalogShared'

export function SpeciesCatalogTable({
  displayedSpecies,
  totalFilteredCount,
  selectedSpeciesId,
  sortKey,
  sortDir,
  onSort,
  onSelect,
  onShowMore,
  onShowAll,
}: {
  displayedSpecies: CatalogSpeciesRecord[]
  totalFilteredCount: number
  selectedSpeciesId: string | null
  sortKey: string
  sortDir: SortDir
  onSort: (k: string) => void
  onSelect: (id: string) => void
  onShowMore: () => void
  onShowAll: () => void
}) {
  return (
    <>
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
          <tr>
            <SortTh label="Formule" activeKey={sortKey} colKey="formula" dir={sortDir} onSort={onSort} className="w-36 pl-4" />
            <SortTh label="Nom" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} />
            <SortTh label="Type" activeKey={sortKey} colKey="kind" dir={sortDir} onSort={onSort} className="hidden md:table-cell" />
            <SortTh label="Masse" activeKey={sortKey} colKey="mass" dir={sortDir} onSort={onSort} align="right" className="hidden sm:table-cell" />
            <SortTh label="Solubilité H₂O" activeKey={sortKey} colKey="solubility" dir={sortDir} onSort={onSort} className="hidden lg:table-cell" />
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium xl:table-cell">En solution</th>
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
                <td className="whitespace-nowrap py-2.5 pl-4 pr-3 font-medium text-foreground">
                  <div className="flex items-center gap-1.5">
                    {dotColor && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />
                    )}
                    <span className="text-[13px] font-semibold tracking-tight">
                      {sp.displayFormula}
                    </span>
                    {sp.kind !== 'ion' && (
                      <span className="font-mono text-[9.5px] text-muted-foreground">
                        {STATE_META[sp.standardState].tag}
                      </span>
                    )}
                  </div>
                </td>
                <td className="max-w-[260px] px-3 py-2.5 text-zinc-200">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate">{sp.nameFr}</span>
                    {sp.source === 'pubchem_live' && (
                      <span className="shrink-0 whitespace-nowrap font-mono text-[9.5px] text-muted-foreground">
                        PubChem
                      </span>
                    )}
                  </div>
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground md:table-cell">
                  {sp.families[0] ?? SPECIES_KIND_LABEL[sp.kind]}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-muted-foreground sm:table-cell">
                  {formatFrNumber(sp.molarMass, 2)} g/mol
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 lg:table-cell">
                  {sp.isSolvent ? (
                    <span className="font-mono text-[10.5px] text-zinc-200">Solvant</span>
                  ) : sp.canDissolveInWater ? (
                    <span className="font-mono text-[10.5px] tabular-nums text-zinc-200">
                      {sp.solubilityGPerL !== null
                        ? `${formatFrNumber(sp.solubilityGPerL, 2)} g/L`
                        : sp.dissolutionType === 'miscible'
                          ? 'Miscible'
                          : 'Soluble'}
                    </span>
                  ) : isUnknownSolubility ? (
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      Non renseigné
                    </span>
                  ) : (
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      Insoluble
                    </span>
                  )}
                </td>
                <td className="hidden whitespace-nowrap px-3 py-2.5 font-mono text-[11px] text-muted-foreground xl:table-cell">
                  {sp.dissolutionProducts.length > 0
                    ? sp.dissolutionProducts
                        .map((p) =>
                          p.stoichiometry > 1
                            ? `${p.stoichiometry} ${p.displayFormula}`
                            : p.displayFormula,
                        )
                        .join(' + ')
                    : '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {totalFilteredCount > displayedSpecies.length && (
        <div className="flex flex-wrap items-center justify-center gap-2 border-t border-border/70 py-3">
          <Button size="sm" variant="secondary" onClick={onShowMore}>
            Afficher plus ({displayedSpecies.length} / {totalFilteredCount})
          </Button>
          {totalFilteredCount - displayedSpecies.length <= 600 && (
            <Button size="sm" variant="ghost" onClick={onShowAll}>
              Tout afficher
            </Button>
          )}
        </div>
      )}
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
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Solution" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="pl-4" />
          <SortTh label="Formule aqueuse" activeKey={sortKey} colKey="formula" dir={sortDir} onSort={onSort} />
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Soluté</th>
          <SortTh label="pH" activeKey={sortKey} colKey="ph" dir={sortDir} onSort={onSort} align="right" className="pr-4" />
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
              <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-zinc-200">
                {sol.formulaLabel}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2.5 text-muted-foreground md:table-cell">
                {sol.soluteFormulas.join(' + ')}
              </td>
              <td
                className={cn(
                  'whitespace-nowrap py-2.5 pl-3 pr-4 text-right font-mono text-[11px] tabular-nums',
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
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Réaction" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="pl-4" />
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium sm:table-cell">Type</th>
          <th className="whitespace-nowrap px-3 py-2 font-medium">Équation</th>
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Milieu</th>
          <th className="whitespace-nowrap px-3 py-2 pr-4 text-right font-medium">Simulation</th>
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
              <td className="px-3 py-2.5 font-mono text-[11.5px] text-zinc-200">
                {rxn.equationDisplay}
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

export function ReactionConstantsTables({
  subTab,
  redox,
  ks,
  ab,
}: {
  subTab: 'redox' | 'ks' | 'pka'
  redox: RedoxCoupleRecord[]
  ks: SolubilityProductRecord[]
  ab: AcidBaseCoupleRecord[]
}) {
  if (subTab === 'redox') {
    return (
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap py-2 pl-4 pr-3 font-medium">Couple Ox / Red</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Demi-équation électronique</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">E° (V)</th>
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Source</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {redox.map((c) => (
            <tr key={c.id} className="hover:bg-accent/40">
              <td className="whitespace-nowrap py-2 pl-4 pr-3 font-mono text-[11.5px] font-medium text-foreground">
                {c.coupleLabel}
              </td>
              <td className="px-3 py-2 font-mono text-[11px] text-zinc-300">{c.halfEquation}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-foreground">
                {c.e0V > 0 ? `+${formatFrNumber(c.e0V, 2)}` : formatFrNumber(c.e0V, 2)} V
              </td>
              <td className="hidden whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground md:table-cell">
                {c.source}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  if (subTab === 'ks') {
    return (
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
          <tr>
            <th className="whitespace-nowrap py-2 pl-4 pr-3 font-medium">Précipité</th>
            <th className="whitespace-nowrap px-3 py-2 font-medium">Nom</th>
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium lg:table-cell">Ions</th>
            <th className="whitespace-nowrap px-3 py-2 text-right font-medium">pKs</th>
            <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Aspect</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {ks.map((k) => (
            <tr key={k.id} className="hover:bg-accent/40">
              <td className="whitespace-nowrap py-2 pl-4 pr-3 font-mono text-[12px] font-semibold text-foreground">
                <div className="flex items-center gap-2">
                  {k.precipitateColorHex && (
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: k.precipitateColorHex }}
                    />
                  )}
                  <span>{k.solidFormula}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-zinc-200">{k.solidNameFr}</td>
              <td className="hidden whitespace-nowrap px-3 py-2 font-mono text-[11px] text-muted-foreground lg:table-cell">
                {k.cationStoich > 1 ? `${k.cationStoich} ` : ''}
                {k.cationFormula} + {k.anionStoich > 1 ? `${k.anionStoich} ` : ''}
                {k.anionFormula}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-zinc-200">
                {formatFrNumber(k.pKs, 2)}
              </td>
              <td className="hidden px-3 py-2 text-[11px] text-muted-foreground md:table-cell">
                {k.precipitateColorFr}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  return (
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <th className="whitespace-nowrap py-2 pl-4 pr-3 font-medium">Couple Acide / Base</th>
          <th className="whitespace-nowrap px-3 py-2 font-medium">Espèce</th>
          <th className="whitespace-nowrap px-3 py-2 text-right font-medium">pKa (25 °C)</th>
          <th className="hidden whitespace-nowrap px-3 py-2 font-medium md:table-cell">Source</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/50">
        {ab.slice(0, 250).map((item) => (
          <tr key={item.id} className="hover:bg-accent/40">
            <td className="whitespace-nowrap py-2 pl-4 pr-3 font-mono text-[11.5px] font-medium text-foreground">
              {item.acidFormula} / {item.baseFormula}
            </td>
            <td className="px-3 py-2 text-zinc-200">{item.acidNameFr}</td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono text-[11.5px] tabular-nums text-foreground">
              {formatFrNumber(item.pKa, 2)}
            </td>
            <td className="hidden whitespace-nowrap px-3 py-2 text-[11px] text-muted-foreground md:table-cell">
              {item.source}
            </td>
          </tr>
        ))}
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
    <table className="w-full border-collapse text-left text-xs">
      <thead className="sticky top-0 z-10 border-b border-border bg-panel/95 text-[11px] text-muted-foreground">
        <tr>
          <SortTh label="Verrerie" activeKey={sortKey} colKey="name" dir={sortDir} onSort={onSort} className="pl-4" />
          <SortTh label="Capacité" activeKey={sortKey} colKey="capacity" dir={sortDir} onSort={onSort} align="right" />
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
              <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono text-[11px] tabular-nums text-zinc-200">
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
