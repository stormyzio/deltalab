import { Plus } from 'lucide-react'
import type {
  CatalogReactionRecord,
  CatalogSolutionRecord,
  VesselRecord,
} from '../../../shared/chemistry.ts'
import {
  REACTION_CATEGORY_LABEL,
  formatCapacityMl,
  formatFrNumber,
} from '@/lib/chemistry-ui'
import { formatBehaviorEntry } from '@/lib/chemistry-calc'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText } from '@/components/ui/chem-text'
import { VesselArtwork } from '@/components/VesselArtwork'
import type { ReactionSpawnSetup } from './CatalogShared'

export function SolutionDetail({
  solution,
  onJumpToSpecies,
}: {
  solution: CatalogSolutionRecord
  onJumpToSpecies: (id: string) => void
}) {
  const isChromatic =
    Boolean(solution.colorHex) &&
    solution.colorHex !== '#bae6fd' &&
    solution.colorHex !== '#e0f2fe'

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <VesselArtwork
          vesselType="erlenmeyer"
          fillRatio={0.62}
          liquidColorHex={solution.colorHex}
          liquidOpacity={isChromatic ? 0.65 : 0.28}
          size="md"
          className="h-16 w-14 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-foreground">{solution.nameFr}</h2>
          <p className="mt-1 break-words text-xs text-zinc-300">
            <ChemFormula value={solution.formulaLabel} />
          </p>
          <p
            className={cn(
              'mt-1 text-[11px] tabular-nums',
              solution.phEstimate === null ? 'text-muted-foreground' : 'text-zinc-200',
            )}
          >
            pH estimé : {solution.phEstimate !== null ? formatFrNumber(solution.phEstimate, 1) : '—'}
          </p>
        </div>
      </div>

      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Constituants</p>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onJumpToSpecies(solution.solventId)}
            className="whitespace-nowrap rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChemFormula value="H2O" /> (solvant)
          </button>
          {solution.soluteIds.map((id, idx) => (
            <button
              key={id}
              type="button"
              onClick={() => onJumpToSpecies(id)}
              className="whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <ChemFormula value={solution.soluteFormulas[idx] ?? id} />
            </button>
          ))}
        </div>
      </div>

      {Object.keys(solution.behaviors).length > 0 && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Propriétés</p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {Object.entries(solution.behaviors).map(([k, v]) => {
              const formatted = formatBehaviorEntry(k, v)
              return (
                <div key={k} className="flex min-w-0 items-baseline justify-between gap-2">
                  <dt className="truncate text-muted-foreground">
                    <ChemText value={formatted.label} />
                  </dt>
                  <dd className="shrink-0 text-[10.5px] text-foreground">
                    {formatted.display}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}
    </div>
  )
}

export function ReactionDetail({
  reaction,
  onJumpToSpecies,
  onSpawnReactionSetup,
}: {
  reaction: CatalogReactionRecord
  onJumpToSpecies: (id: string) => void
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{reaction.nameFr}</h2>
          <p className="mt-0.5 text-[10.5px] text-muted-foreground">
            {REACTION_CATEGORY_LABEL[reaction.category] ?? reaction.category} ·{' '}
            {reaction.medium === 'aqueous'
              ? 'Milieu aqueux'
              : reaction.medium === 'gas'
                ? 'Phase gazeuse (hors aqueux)'
                : reaction.medium === 'solid'
                  ? 'Voie sèche / solide (hors aqueux)'
                  : 'Tout milieu'}
          </p>
        </div>

        {onSpawnReactionSetup && (
          <Button
            size="sm"
            variant="secondary"
            className="shrink-0"
            onClick={() =>
              onSpawnReactionSetup({
                titleFr: reaction.nameFr,
                medium: reaction.medium,
                reactants: reaction.reactants.map((r) => ({
                  speciesId: r.speciesId,
                  stoichiometry: r.stoichiometry,
                })),
              })
            }
          >
            <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span>Paillasse</span>
          </Button>
        )}
      </div>

      <p className="break-words border-t border-border/60 pt-3 text-[13px] leading-snug text-zinc-100">
        <ChemFormula value={reaction.equationDisplay} />
      </p>

      <div className="grid grid-cols-2 gap-3 border-t border-border/60 pt-3.5">
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Réactifs</p>
          <div className="flex flex-wrap gap-1">
            {reaction.reactants.map((r) => (
              <button
                key={r.speciesId}
                type="button"
                onClick={() => onJumpToSpecies(r.speciesId)}
                className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-foreground hover:bg-accent"
              >
                {r.stoichiometry > 1 ? `${r.stoichiometry} ` : ''}
                <ChemFormula value={r.displayFormula} />
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Produits</p>
          <div className="flex flex-wrap gap-1">
            {reaction.products.map((p) => (
              <button
                key={p.speciesId}
                type="button"
                onClick={() => onJumpToSpecies(p.speciesId)}
                className="whitespace-nowrap rounded px-1.5 py-0.5 text-xs text-foreground hover:bg-accent"
              >
                {p.stoichiometry > 1 ? `${p.stoichiometry} ` : ''}
                <ChemFormula value={p.displayFormula} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {reaction.observationsFr && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">Observations</p>
          <p className="text-xs leading-relaxed text-zinc-300">
            <ChemText value={reaction.observationsFr} />
          </p>
        </div>
      )}
    </div>
  )
}

export function VesselDetail({
  vessel,
  onSpawn,
}: {
  vessel: VesselRecord
  onSpawn: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <VesselArtwork
            vesselType={vessel.vesselType}
            fillRatio={0.45}
            liquidColorHex="#bae6fd"
            liquidOpacity={0.28}
            size="md"
            className="h-16 w-14 shrink-0"
          />
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{vessel.nameFr}</h2>
            <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">
              Défaut : {formatCapacityMl(vessel.capacityMl)}
            </p>
            <p className="mt-0.5 text-[10.5px] text-zinc-400">{vessel.precisionLabel}</p>
          </div>
        </div>

        <Button size="sm" variant="secondary" className="shrink-0" onClick={onSpawn}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
          <span>Paillasse</span>
        </Button>
      </div>

      <p className="border-t border-border/60 pt-3.5 text-xs text-zinc-300">
        {vessel.descriptionShort}
      </p>

      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-1 text-[11px] font-medium text-muted-foreground">
          Capacités standards
        </p>
        <p className="text-xs tabular-nums text-foreground">
          {vessel.availableCapacitiesMl.map((cap) => formatCapacityMl(cap)).join(' · ')}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3.5 text-xs">
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Chauffage</dt>
          <dd className="mt-0.5 text-foreground">
            {vessel.supportsHeating ? 'Autorisé (0–200 °C)' : 'Déconseillé (étalonnée)'}
          </dd>
        </div>
        {vessel.defaultPourStepMl !== null && (
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Versement dosé</dt>
            <dd className="mt-0.5 tabular-nums text-foreground">
              {formatCapacityMl(vessel.defaultPourStepMl)}
            </dd>
          </div>
        )}
      </dl>

      <p className="border-t border-border/60 pt-3.5 text-[11px] text-muted-foreground">
        Capacité modifiable librement sur la paillasse (jusqu’à 5 L) dans l’inspecteur.
      </p>
    </div>
  )
}
