import { ArrowRight, Plus } from 'lucide-react'
import type {
  CatalogSpeciesRecord,
  FullCatalogResponse,
} from '../../../shared/chemistry.ts'
import {
  DISSOLUTION_LABEL,
  GHS_LABEL_FR,
  PH_CHAR_LABEL,
  SPECIES_KIND_LABEL,
  SPECIES_SOURCE_LABEL,
  STATE_META,
  THERMAL_NOTE_FR,
  formatDensity,
  formatFrNumber,
} from '@/lib/chemistry-ui'
import {
  buildCanonicalSignature,
  formatBehaviorEntry,
  formatChargeLabel,
} from '@/lib/chemistry-calc'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula } from '@/components/ui/chem-text'
import { VesselArtwork } from '@/components/VesselArtwork'
import { MolecularRepresentationSection } from '@/components/MolecularRepresentationSection'
import type { ReactionSpawnSetup } from './CatalogShared'

export function SpeciesDetail({
  species,
  catalog,
  onJumpToElement,
  onJumpToSpecies,
  onJumpToSolution,
  onSpawn,
  onEditLewis,
  onSpawnReactionSetup,
}: {
  species: CatalogSpeciesRecord
  catalog: FullCatalogResponse
  onJumpToElement: (symbol: string) => void
  onJumpToSpecies: (id: string) => void
  onJumpToSolution: (id: string) => void
  onSpawn: () => void
  onEditLewis: () => void
  onSpawnReactionSetup?: (setup: ReactionSpawnSetup) => void
}) {
  const linkedSolution = catalog.solutions.find((sol) =>
    sol.soluteIds.includes(species.id),
  )

  const linkedReactions = catalog.reactions.filter(
    (r) =>
      r.reactants.some((item) => item.speciesId === species.id) ||
      r.products.some((item) => item.speciesId === species.id),
  )

  const speciesSig = buildCanonicalSignature(species.composition)
  const isomers = catalog.species.filter(
    (other) =>
      other.id !== species.id &&
      other.charge === species.charge &&
      buildCanonicalSignature(other.composition) === speciesSig,
  )

  const behaviorEntries = Object.entries(species.behaviors).filter(
    ([key]) => key !== 'families',
  )

  const kindLabel = SPECIES_KIND_LABEL[species.kind]
  const stateLabel =
    species.kind !== 'ion' ? STATE_META[species.standardState].labelFr : null
  const seenMeta = new Set<string>(
    [kindLabel, stateLabel]
      .filter((s): s is string => Boolean(s))
      .map((s) => s.trim().toLowerCase()),
  )
  const extraFamilies = species.families.filter((f) => {
    const key = f.trim().toLowerCase()
    if (!key || seenMeta.has(key)) return false
    seenMeta.add(key)
    return true
  })
  const subtitleParts = [kindLabel, ...(stateLabel ? [stateLabel] : []), ...extraFamilies]
  const distinctIupac =
    species.iupacName &&
    species.iupacName.trim().toLowerCase() !== species.nameFr.trim().toLowerCase()
      ? species.iupacName.trim()
      : null

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {(species.solutionColorHex || species.isSolvent) && (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: species.solutionColorHex ?? '#bae6fd' }}
              />
            )}
            <h2 className="truncate text-xl font-semibold leading-tight tracking-tight text-foreground">
              <ChemFormula value={species.displayFormula} />
            </h2>
          </div>
          <p className="mt-1 text-[13px] font-medium leading-snug text-zinc-200">
            {species.nameFr}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
            {subtitleParts.join(' · ')}
          </p>
        </div>

        <Button size="sm" variant="secondary" className="shrink-0" onClick={onSpawn}>
          <Plus className="h-3.5 w-3.5" strokeWidth={1.7} />
          <span>Paillasse</span>
        </Button>
      </div>

      <MolecularRepresentationSection
        speciesId={species.id}
        structure={species.lewis}
        formula={species.displayFormula}
        nameFr={species.nameFr}
        onOpenInLewisBuilder={onEditLewis}
        isomers={isomers}
        onJumpToIsomer={onJumpToSpecies}
        className="border-t border-border/60 pt-3.5"
      />

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border/60 pt-3.5 text-xs">
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Masse molaire</dt>
          <dd className="mt-0.5 font-mono tabular-nums text-foreground">
            {formatFrNumber(species.molarMass, 3)} g/mol
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Charge</dt>
          <dd className="mt-0.5 font-mono tabular-nums text-foreground">
            {formatChargeLabel(species.charge)}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Caractère pH</dt>
          <dd className="mt-0.5 text-foreground">{PH_CHAR_LABEL[species.phCharacter]}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Dissolution</dt>
          <dd className="mt-0.5 text-foreground">
            {species.isSolvent
              ? 'Solvant aqueux'
              : species.source !== 'curated' &&
                  !species.canDissolveInWater &&
                  species.solubilityGPerL === null
                ? 'Non renseigné'
                : DISSOLUTION_LABEL[species.dissolutionType]}
          </dd>
        </div>
      </dl>

      {(species.meltingPointC !== null ||
        species.boilingPointC !== null ||
        species.densityGPerCm3 !== null ||
        species.appearanceFr !== null ||
        species.pkaValues.length > 0 ||
        species.solubilityByTempC !== null ||
        species.ghsPictograms.length > 0) && (
        <div className="space-y-3 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">
            Constantes physico-chimiques
          </p>

          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {species.meltingPointC !== null && (
              <div>
                <dt className="text-[10.5px] text-muted-foreground">T° fusion</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                  {formatFrNumber(species.meltingPointC, 1)} °C
                </dd>
              </div>
            )}
            {species.boilingPointC !== null && (
              <div>
                <dt className="text-[10.5px] text-muted-foreground">T° ébullition</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                  {formatFrNumber(species.boilingPointC, 1)} °C
                  {species.thermalNote ? (
                    <span className="ml-1 font-sans text-[10px] text-muted-foreground">
                      ({THERMAL_NOTE_FR[species.thermalNote] ?? species.thermalNote})
                    </span>
                  ) : null}
                </dd>
              </div>
            )}
            {species.densityGPerCm3 !== null && (
              <div>
                <dt className="text-[10.5px] text-muted-foreground">Masse volumique</dt>
                <dd className="mt-0.5 font-mono tabular-nums text-foreground">
                  {formatDensity(species.densityGPerCm3, species.standardState)}
                </dd>
              </div>
            )}
            {species.appearanceFr && (
              <div>
                <dt className="text-[10.5px] text-muted-foreground">Aspect pur</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
                  {species.colorHex && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: species.colorHex }}
                    />
                  )}
                  <span className="truncate">{species.appearanceFr}</span>
                </dd>
              </div>
            )}
          </dl>

          {species.pkaValues.length > 0 && (
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1 text-[11px]">
              <span className="text-[10.5px] text-muted-foreground">pKa</span>
              <span className="font-mono tabular-nums text-zinc-200">
                {species.pkaValues
                  .map((val, idx) =>
                    `${species.pkaValues.length > 1 ? `pKa${idx + 1} = ` : ''}${formatFrNumber(val, 2)}`,
                  )
                  .join(' · ')}
              </span>
            </div>
          )}

          {species.solubilityByTempC && Object.keys(species.solubilityByTempC).length >= 2 && (
            <div>
              <span className="block text-[10.5px] text-muted-foreground">
                Solubilité H₂O (g/L)
              </span>
              <div className="mt-1.5 grid grid-cols-4 divide-x divide-border/60 text-center">
                {['0', '20', '60', '100']
                  .filter((t) => species.solubilityByTempC?.[t] !== undefined)
                  .map((t) => (
                    <div key={t} className="px-1.5 py-0.5">
                      <span className="block font-mono text-[9.5px] text-muted-foreground">
                        {t} °C
                      </span>
                      <span className="font-mono text-[11px] tabular-nums text-zinc-200">
                        {formatFrNumber(species.solubilityByTempC![t], 0)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {species.ghsPictograms.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {species.ghsSignalWord && (
                <span
                  className={cn(
                    'mr-1.5 font-medium',
                    species.ghsSignalWord === 'Danger'
                      ? 'text-red-400'
                      : 'text-amber-300',
                  )}
                >
                  {species.ghsSignalWord}
                </span>
              )}
              <span>
                {species.ghsPictograms
                  .map((code) => GHS_LABEL_FR[code] ?? code)
                  .join(' · ')}
              </span>
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border/60 pt-3.5">
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          Composition atomique
        </p>
        <div className="flex flex-wrap gap-1">
          {Object.entries(species.composition).map(([sym, count]) => (
            <button
              key={sym}
              type="button"
              onClick={() => onJumpToElement(sym)}
              className="inline-flex items-baseline gap-1 whitespace-nowrap rounded px-2 py-0.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              <span>{sym}</span>
              <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                ×{count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Comportement dans H₂O
          </span>
          {species.solubilityGPerL !== null && (
            <span className="shrink-0 whitespace-nowrap font-mono text-[10.5px] tabular-nums text-zinc-300">
              {formatFrNumber(species.solubilityGPerL, 3)} g/L
            </span>
          )}
        </div>

        {species.dissolutionProducts.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground">
              {species.displayFormula}
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            {species.dissolutionProducts.map((prod) => (
              <button
                key={prod.speciesId}
                type="button"
                onClick={() => onJumpToSpecies(prod.speciesId)}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] text-foreground hover:bg-accent"
              >
                {prod.colorHex && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: prod.colorHex }}
                  />
                )}
                <span>
                  {prod.stoichiometry > 1 ? `${prod.stoichiometry} ` : ''}
                  {prod.displayFormula}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {species.isSolvent
              ? 'Solvant polaire servant de base aux solutions aqueuses.'
              : species.kind === 'ion'
                ? species.canDissolveInWater
                  ? 'Espèce ionique hydratée en solution aqueuse.'
                  : 'Espèce ionique (données de solubilité non renseignées).'
                : species.source !== 'curated' && species.solubilityGPerL === null
                  ? 'Solubilité aqueuse non renseignée pour cette espèce de la base étendue.'
                  : 'Insoluble dans l’eau.'}
          </p>
        )}
      </div>

      {linkedSolution && (
        <div className="border-t border-border/60 pt-3.5">
          <button
            type="button"
            onClick={() => onJumpToSolution(linkedSolution.id)}
            className="flex w-full items-center gap-3 rounded-md px-1.5 py-1.5 text-left hover:bg-accent/50"
          >
            <VesselArtwork
              vesselType="erlenmeyer"
              fillRatio={0.55}
              liquidColorHex={linkedSolution.colorHex}
              liquidOpacity={
                linkedSolution.colorHex &&
                linkedSolution.colorHex !== '#bae6fd' &&
                linkedSolution.colorHex !== '#e0f2fe'
                  ? 0.62
                  : 0.28
              }
              size="sm"
            />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] text-muted-foreground">Solution associée</p>
              <p className="truncate text-xs font-medium text-foreground">
                {linkedSolution.nameFr}
              </p>
              <p className="truncate font-mono text-[10px] text-muted-foreground">
                {linkedSolution.formulaLabel}
                {linkedSolution.phEstimate !== null
                  ? ` · pH ${formatFrNumber(linkedSolution.phEstimate, 1)}`
                  : ''}
              </p>
            </div>
          </button>
        </div>
      )}

      {linkedReactions.length > 0 && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Réactions impliquées
          </p>
          <div className="divide-y divide-border/50">
            {linkedReactions.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between gap-2 py-1.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-foreground">{r.nameFr}</p>
                  <p className="mt-0.5 break-words font-mono text-[10.5px] text-muted-foreground">
                    {r.equationDisplay}
                  </p>
                </div>
                {onSpawnReactionSetup && (
                  <button
                    type="button"
                    onClick={() =>
                      onSpawnReactionSetup({
                        titleFr: r.nameFr,
                        medium: r.medium,
                        reactants: r.reactants.map((item) => ({
                          speciesId: item.speciesId,
                          stoichiometry: item.stoichiometry,
                        })),
                      })
                    }
                    className="shrink-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Simuler
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {behaviorEntries.length > 0 && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
            Propriétés enregistrées
          </p>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {behaviorEntries.map(([k, v]) => {
              const formatted = formatBehaviorEntry(k, v)
              return (
                <div key={k} className="flex min-w-0 items-baseline justify-between gap-2">
                  <dt className="truncate text-muted-foreground">{formatted.label}</dt>
                  <dd className="shrink-0 font-mono text-[10.5px] text-foreground">
                    {formatted.display}
                  </dd>
                </div>
              )
            })}
          </dl>
        </div>
      )}

      <div className="space-y-2.5 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">Références</p>
        {distinctIupac && (
          <div>
            <span className="block text-[10.5px] text-muted-foreground">Nom IUPAC</span>
            <p className="mt-0.5 break-words text-[11.5px] leading-snug text-zinc-200">
              {distinctIupac}
            </p>
          </div>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {species.casNumber && (
            <div>
              <dt className="text-[10.5px] text-muted-foreground">N° CAS</dt>
              <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
                {species.casNumber}
              </dd>
            </div>
          )}
          {species.pubchemCid && (
            <div>
              <dt className="text-[10.5px] text-muted-foreground">PubChem CID</dt>
              <dd className="mt-0.5 font-mono text-[11px] tabular-nums text-foreground">
                {species.pubchemCid}
              </dd>
            </div>
          )}
          <div>
            <dt className="text-[10.5px] text-muted-foreground">Source</dt>
            <dd className="mt-0.5 text-[11px] text-zinc-300">
              {SPECIES_SOURCE_LABEL[species.source]}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  )
}
