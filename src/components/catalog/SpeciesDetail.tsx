import { ArrowRight, Plus } from 'lucide-react'
import type {
  CatalogSpeciesRecord,
  FullCatalogResponse,
} from '../../../shared/chemistry.ts'
import {
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
  extractNotableBehaviors,
  formatChargeLabel,
} from '@/lib/chemistry-calc'
import { describeWaterBehavior } from '@/lib/water-behavior'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemText, ChemVar } from '@/components/ui/chem-text'
import { VesselArtwork } from '@/components/VesselArtwork'
import { MolecularRepresentationSection } from '@/components/MolecularRepresentationSection'
import type { ReactionSpawnSetup } from './CatalogShared'

function UnknownValue({ title = 'Donnée non renseignée en base' }: { title?: string }) {
  return (
    <span title={title} className="text-muted-foreground">
      ?
    </span>
  )
}

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

  const notableBehaviors = extractNotableBehaviors(species.behaviors)
  const isIon = species.kind === 'ion'
  const waterBehavior = describeWaterBehavior(species)

  const kindLabel = SPECIES_KIND_LABEL[species.kind]
  const stateLabel = !isIon ? STATE_META[species.standardState].labelFr : null
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
          <dd className="mt-0.5 tabular-nums text-foreground">
            {formatFrNumber(species.molarMass, 3)} g/mol
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Charge</dt>
          <dd className="mt-0.5 tabular-nums text-foreground">
            {formatChargeLabel(species.charge)}
          </dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">Caractère pH</dt>
          <dd className="mt-0.5 text-foreground">{PH_CHAR_LABEL[species.phCharacter]}</dd>
        </div>
        <div>
          <dt className="text-[10.5px] text-muted-foreground">
            {species.standardState === 'liquid' ? 'Miscibilité ' : 'Solubilité '}
            <ChemFormula value="H2O" />
          </dt>
          <dd className="mt-0.5 text-foreground">
            {waterBehavior.tier === 'unknown' ? (
              <UnknownValue title="Solubilité dans l’eau non renseignée" />
            ) : waterBehavior.valueLabel ? (
              `${waterBehavior.tierLabel} · ${waterBehavior.valueLabel}`
            ) : (
              waterBehavior.tierLabel
            )}
          </dd>
        </div>
      </dl>

      <div className="space-y-3 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">
          Constantes physico-chimiques
        </p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          {!isIon && (
            <>
              <div>
                <dt className="text-[10.5px] text-muted-foreground">T° fusion</dt>
                <dd className="mt-0.5 tabular-nums text-foreground">
                  {species.meltingPointC !== null ? (
                    `${formatFrNumber(species.meltingPointC, 1)} °C`
                  ) : (
                    <UnknownValue />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-muted-foreground">T° ébullition</dt>
                <dd className="mt-0.5 tabular-nums text-foreground">
                  {species.boilingPointC !== null ? (
                    <>
                      {formatFrNumber(species.boilingPointC, 1)} °C
                      {species.thermalNote ? (
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          ({THERMAL_NOTE_FR[species.thermalNote] ?? species.thermalNote})
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <UnknownValue />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-muted-foreground">Masse volumique</dt>
                <dd className="mt-0.5 tabular-nums text-foreground">
                  {species.densityGPerCm3 !== null ? (
                    <ChemText
                      value={formatDensity(species.densityGPerCm3, species.standardState)}
                    />
                  ) : (
                    <UnknownValue />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[10.5px] text-muted-foreground">Aspect pur</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-foreground">
                  {species.appearanceFr ? (
                    <>
                      {species.colorHex && (
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: species.colorHex }}
                        />
                      )}
                      <span className="truncate">{species.appearanceFr}</span>
                    </>
                  ) : (
                    <UnknownValue />
                  )}
                </dd>
              </div>
            </>
          )}

          <div>
            <dt className="text-[10.5px] text-muted-foreground">
              p<ChemVar base="K" sub="a" />
            </dt>
            <dd className="mt-0.5 tabular-nums text-foreground">
              {species.pkaValues.length > 0 ? (
                species.pkaValues.map((val, idx) => (
                  <span key={idx}>
                    {idx > 0 && ' · '}
                    {species.pkaValues.length > 1 && (
                      <>
                        p<ChemVar base="K" sub={`a${idx + 1}`} /> ={' '}
                      </>
                    )}
                    {formatFrNumber(val, 2)}
                  </span>
                ))
              ) : (
                <UnknownValue title="Aucun pKa aqueux renseigné" />
              )}
            </dd>
          </div>

          <div>
            <dt className="text-[10.5px] text-muted-foreground">Sécurité SGH</dt>
            <dd className="mt-0.5 text-[11px] text-muted-foreground">
              {species.ghsPictograms.length > 0 ? (
                <>
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
                  <span className="text-zinc-300">
                    {species.ghsPictograms
                      .map((code) => GHS_LABEL_FR[code] ?? code)
                      .join(' · ')}
                  </span>
                </>
              ) : (
                <UnknownValue title="Pictogrammes SGH non renseignés" />
              )}
            </dd>
          </div>
        </dl>

        {species.solubilityByTempC && Object.keys(species.solubilityByTempC).length >= 2 && (
          <div>
            <span className="block text-[10.5px] text-muted-foreground">
              Solubilité <ChemFormula value="H2O" /> (g/L)
            </span>
            <div className="mt-1.5 grid grid-cols-4 divide-x divide-border/60 text-center">
              {['0', '20', '60', '100']
                .filter((t) => species.solubilityByTempC?.[t] !== undefined)
                .map((t) => (
                  <div key={t} className="px-1.5 py-0.5">
                    <span className="block text-[9.5px] text-muted-foreground">
                      {t} °C
                    </span>
                    <span className="text-[11px] tabular-nums text-zinc-200">
                      {formatFrNumber(species.solubilityByTempC![t], 0)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

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
              <span className="text-[10px] tabular-nums text-muted-foreground">
                ×{count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-muted-foreground">
            Comportement dans <ChemFormula value="H2O" />
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-zinc-300">
            {waterBehavior.tier === 'unknown' ? (
              <UnknownValue title="Solubilité dans l’eau non renseignée" />
            ) : (
              waterBehavior.tierLabel
            )}
          </span>
        </div>

        {species.dissolutionProducts.length > 0 ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">
              <ChemFormula value={species.displayFormula} />
            </span>
            <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground" />
            {species.dissolutionProducts.map((prod) => (
              <button
                key={prod.speciesId}
                type="button"
                onClick={() => onJumpToSpecies(prod.speciesId)}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] text-foreground hover:bg-accent"
              >
                {prod.colorHex && (
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ backgroundColor: prod.colorHex }}
                  />
                )}
                <span>
                  {prod.stoichiometry > 1 ? `${prod.stoichiometry} ` : ''}
                  <ChemFormula value={prod.displayFormula} />
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <ChemText value={waterBehavior.descriptionFr} />
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
              <p className="truncate text-[10px] text-muted-foreground">
                <ChemFormula value={linkedSolution.formulaLabel} />
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
                  <p className="mt-0.5 break-words text-[10.5px] text-muted-foreground">
                    <ChemFormula value={r.equationDisplay} />
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

      {notableBehaviors.length > 0 && (
        <div className="border-t border-border/60 pt-3.5">
          <p className="mb-1 text-[11px] font-medium text-muted-foreground">
            Particularités
          </p>
          <p className="text-[11.5px] leading-relaxed text-zinc-200">
            {notableBehaviors.map((b, idx) => (
              <span key={b.key}>
                {idx > 0 && ' · '}
                <ChemText value={b.text} />
              </span>
            ))}
          </p>
        </div>
      )}

      <div className="space-y-2.5 border-t border-border/60 pt-3.5">
        <p className="text-[11px] font-medium text-muted-foreground">Références</p>
        <div>
          <span className="block text-[10.5px] text-muted-foreground">Nom IUPAC</span>
          <p className="mt-0.5 break-words text-[11.5px] leading-snug text-zinc-200">
            {species.iupacName ? species.iupacName : <UnknownValue />}
          </p>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <div>
            <dt className="text-[10.5px] text-muted-foreground">N° CAS</dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-foreground">
              {species.casNumber ? species.casNumber : <UnknownValue />}
            </dd>
          </div>
          <div>
            <dt className="text-[10.5px] text-muted-foreground">PubChem CID</dt>
            <dd className="mt-0.5 text-[11px] tabular-nums text-foreground">
              {species.pubchemCid ? species.pubchemCid : <UnknownValue />}
            </dd>
          </div>
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
