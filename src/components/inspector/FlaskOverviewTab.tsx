import { useEffect, useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import type {
  CanvasFlaskNode,
  CatalogDissolutionProduct,
  CatalogReactionRecord,
  FlaskActiveReaction,
  FullCatalogResponse,
  SoluteSummaryItem,
} from '../../../shared/chemistry.ts'
import type { ProjectedFlaskState } from '@/lib/flask-reaction-ui'
import {
  formatConcGL,
  formatConcMolL,
  formatFrNumber,
  formatMassG,
  formatMol,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChemFormula, ChemVar, StateTag, Sup } from '@/components/ui/chem-text'
import {
  CONC_MASS_UNITS,
  CONC_MOL_UNITS,
  MASS_UNITS,
  MOL_UNITS,
  VOLUME_UNITS,
} from '@/lib/quantity-units'
import { ScrubNumberInput } from '@/components/ui/scrub-number-input'
import { ReactionControlCard } from '@/components/ReactionControlCard'
import type { CatalogJumpTarget } from './InspectorPrimitives'

function EditableSoluteRow({
  sol,
  hasWater,
  totalVolumeL,
  dissolutionProducts,
  onOpenCatalog,
  onSetAmountMol,
}: {
  sol: SoluteSummaryItem
  hasWater: boolean
  totalVolumeL: number
  dissolutionProducts?: CatalogDissolutionProduct[]
  onOpenCatalog: () => void
  onSetAmountMol: (amountMol: number) => void
}) {
  const [liveMol, setLiveMol] = useState<number | null>(null)
  const throttleTimerRef = useRef<number | null>(null)
  const pendingMolRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current !== null) {
        window.clearTimeout(throttleTimerRef.current)
      }
    }
  }, [])

  const effectiveMol = liveMol ?? sol.addedMol
  const molarMass = Math.max(1e-6, sol.molarMass)
  const effectiveMassG = effectiveMol * molarMass
  const isSolid = sol.isImmersedSolid || (!hasWater && sol.undissolvedMol > 0)
  const isImmiscible = Boolean(sol.isImmiscibleLiquid)
  const showConc = hasWater && !isSolid && !isImmiscible && totalVolumeL > 1e-6
  const effectiveConcMolL = showConc ? effectiveMol / totalVolumeL : 0
  const effectiveConcGL = showConc ? effectiveMassG / totalVolumeL : 0

  const scheduleMolUpdate = (nextMol: number) => {
    const clean = Math.max(0, Math.min(500, nextMol))
    setLiveMol(clean)
    pendingMolRef.current = clean
    if (throttleTimerRef.current === null) {
      throttleTimerRef.current = window.setTimeout(() => {
        throttleTimerRef.current = null
        const latest = pendingMolRef.current
        if (latest !== null) {
          onSetAmountMol(latest)
        }
      }, 110)
    }
  }

  const commitMolImmediate = (nextMol: number) => {
    if (throttleTimerRef.current !== null) {
      window.clearTimeout(throttleTimerRef.current)
      throttleTimerRef.current = null
    }
    const clean = Math.max(0, Math.min(500, nextMol))
    pendingMolRef.current = null
    setLiveMol(null)
    onSetAmountMol(clean)
  }

  const saturationMol =
    showConc && sol.solubilityGPerL !== null && sol.solubilityGPerL > 0
      ? (sol.solubilityGPerL * totalVolumeL) / molarMass
      : null

  return (
    <div className="space-y-2 py-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onOpenCatalog}
          className="flex min-w-0 items-center gap-1.5 text-left"
        >
          {sol.colorHex &&
            sol.colorHex.toLowerCase() !== '#ffffff' &&
            sol.colorHex.toLowerCase() !== '#f4f4f5' && (
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-white/15"
                style={{ backgroundColor: sol.colorHex }}
              />
            )}
          <span className="shrink-0 text-xs font-semibold text-foreground hover:text-white">
            <ChemFormula value={sol.displayFormula} />
            <StateTag state={isSolid ? 's' : isImmiscible ? 'l' : hasWater ? 'aq' : 'l'} />
          </span>
          <span className="truncate text-[11px] text-muted-foreground">{sol.nameFr}</span>
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {isImmiscible && (
            <span className="whitespace-nowrap text-[10px] text-muted-foreground">
              Non miscible
            </span>
          )}
          {sol.isSaturated && (
            <span className="whitespace-nowrap text-[10px] text-amber-300">
              Saturée
            </span>
          )}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => commitMolImmediate(0)}
            aria-label={`Retirer ${sol.displayFormula}`}
            className="h-6 w-6 text-muted-foreground hover:text-red-400"
          >
            <Trash2 className="h-3 w-3" strokeWidth={1.6} />
          </Button>
        </div>
      </div>

      {hasWater && dissolutionProducts && dissolutionProducts.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-1 text-[10px] text-muted-foreground">
          <span className="text-zinc-500">→</span>
          {dissolutionProducts.map((p, idx) => (
            <span key={p.speciesId} className="inline-flex items-baseline gap-0.5">
              {idx > 0 && <span className="mx-0.5 text-zinc-600">+</span>}
              {p.stoichiometry > 1 && <span>{p.stoichiometry}</span>}
              <ChemFormula value={p.displayFormula} />
            </span>
          ))}
        </div>
      )}

      {/* Linked Figma-style scrub inputs: n, m, and (when aqueous) C & Cm */}
      <div className="grid grid-cols-2 gap-1.5">
        <ScrubNumberInput
          prefixLabel="n"
          value={effectiveMol}
          units={MOL_UNITS}
          defaultUnitId={sol.addedMol >= 0.5 ? 'mol' : 'mmol'}
          min={0}
          max={500}
          ariaLabel={`Quantité de matière de ${sol.displayFormula}`}
          onChange={scheduleMolUpdate}
          onScrubEnd={commitMolImmediate}
        />

        <ScrubNumberInput
          prefixLabel="m"
          value={effectiveMassG}
          units={MASS_UNITS}
          defaultUnitId={sol.addedMassG < 0.5 ? 'mg' : 'g'}
          min={0}
          max={50000}
          ariaLabel={`Masse de ${sol.displayFormula}`}
          onChange={(nextG) => scheduleMolUpdate(nextG / molarMass)}
          onScrubEnd={(nextG) => commitMolImmediate(nextG / molarMass)}
        />

        {showConc && (
          <>
            <ScrubNumberInput
              prefixLabel="C"
              value={effectiveConcMolL}
              units={CONC_MOL_UNITS}
              defaultUnitId={sol.concentrationMolPerL < 0.02 ? 'mM' : 'M'}
              min={0}
              max={25}
              ariaLabel={`Concentration molaire de ${sol.displayFormula}`}
              onChange={(nextC) => scheduleMolUpdate(nextC * totalVolumeL)}
              onScrubEnd={(nextC) => commitMolImmediate(nextC * totalVolumeL)}
            />

            <ScrubNumberInput
              prefixLabel={<ChemVar base="C" sub="m" />}
              value={effectiveConcGL}
              units={CONC_MASS_UNITS}
              defaultUnitId={sol.massConcentrationGPerL < 1 ? 'mg/L' : 'g/L'}
              min={0}
              max={2500}
              ariaLabel={`Concentration massique de ${sol.displayFormula}`}
              onChange={(nextCm) =>
                scheduleMolUpdate((nextCm * totalVolumeL) / molarMass)
              }
              onScrubEnd={(nextCm) =>
                commitMolImmediate((nextCm * totalVolumeL) / molarMass)
              }
            />
          </>
        )}
      </div>

      {/* Practical quick controls adapted to aqueous vs solid state */}
      <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => commitMolImmediate(Math.max(0.0001, sol.addedMol / 2))}
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ÷2
            </button>
            <button
              type="button"
              onClick={() => commitMolImmediate(sol.addedMol * 2)}
              className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              ×2
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-0.5">
            {showConc ? (
              <>
                {[0.05, 0.1, 0.5, 1].map((cVal) => (
                  <button
                    key={cVal}
                    type="button"
                    onClick={() => commitMolImmediate(cVal * totalVolumeL)}
                    className="rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    {formatFrNumber(cVal, cVal < 0.1 ? 2 : cVal < 1 ? 1 : 0)} M
                  </button>
                ))}
                {saturationMol !== null && (
                  <button
                    type="button"
                    onClick={() => commitMolImmediate(saturationMol)}
                    title={`Atteindre la saturation (${formatFrNumber(sol.solubilityGPerL ?? 0, 1)} g/L)`}
                    className="rounded px-1.5 py-0.5 text-amber-300/90 hover:bg-accent hover:text-amber-200"
                  >
                    Sat.
                  </button>
                )}
              </>
            ) : (
              [0.5, 1, 2, 5].map((gVal) => (
                <button
                  key={gVal}
                  type="button"
                  onClick={() => commitMolImmediate(gVal / molarMass)}
                  className="rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {formatFrNumber(gVal, gVal < 1 ? 1 : 0)} g
                </button>
              ))
            )}
          </div>
        </div>

      {sol.saturationRatio !== null && (
        <div>
          <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="truncate">
              Solubilité ({formatFrNumber(sol.solubilityGPerL ?? 0, 1)} g/L)
              {sol.undissolvedMassG > 1e-4 && !sol.isImmersedSolid && (
                <span className="ml-1 tabular-nums text-amber-300/90">
                  · dépôt {formatMassG(sol.undissolvedMassG)}
                </span>
              )}
            </span>
            <span className="inline-block w-[4.5ch] shrink-0 text-right tabular-nums">
              {Math.min(100, Math.round(sol.saturationRatio * 100))} %
            </span>
          </div>
          <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-zinc-400"
              style={{
                width: `${Math.min(100, Math.max(2, sol.saturationRatio * 100))}%`,
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export function FlaskOverviewTab({
  node,
  catalog,
  hasContent,
  remainingMl,
  waterInput,
  onWaterInputChange,
  onSubmitWater,
  onAddWater,
  quickWaterSteps,
  activeRxn,
  availableRxns,
  projected,
  netChargeConc,
  matchingReactions,
  onChangeReactionExtent,
  onSelectReaction,
  onCommitReaction,
  onBalanceStoichiometry,
  onSetSoluteAmount,
  onSetWaterVolume,
  onExtractFilteredSolid,
  onClearFilterCake,
  onOpenInCatalog,
}: {
  node: CanvasFlaskNode
  catalog: FullCatalogResponse | null
  hasContent: boolean
  remainingMl: number
  waterInput: string
  onWaterInputChange: (v: string) => void
  onSubmitWater: () => void
  onAddWater: (volumeMl: number) => void
  quickWaterSteps: number[]
  activeRxn: FlaskActiveReaction | null
  availableRxns: FlaskActiveReaction[]
  projected: ProjectedFlaskState
  netChargeConc: number
  matchingReactions: CatalogReactionRecord[]
  onChangeReactionExtent: (xMol: number) => void
  onSelectReaction: (reactionId: string) => void
  onCommitReaction: () => void
  onBalanceStoichiometry?: () => void
  onSetSoluteAmount: (speciesId: string, amountMol: number) => void
  onSetWaterVolume: (volumeMl: number) => void
  onExtractFilteredSolid?: (speciesId: string) => void
  onClearFilterCake?: () => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
}) {
  const { vessel, solution } = node
  const [liveWaterMl, setLiveWaterMl] = useState<number | null>(null)
  const waterTimerRef = useRef<number | null>(null)
  const pendingWaterRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (waterTimerRef.current !== null) window.clearTimeout(waterTimerRef.current)
    }
  }, [])

  const scheduleWaterUpdate = (nextMl: number) => {
    const clean = Math.max(0, Math.min(vessel.capacityMl, nextMl))
    setLiveWaterMl(clean)
    pendingWaterRef.current = clean
    if (waterTimerRef.current === null) {
      waterTimerRef.current = window.setTimeout(() => {
        waterTimerRef.current = null
        const latest = pendingWaterRef.current
        if (latest !== null) onSetWaterVolume(latest)
      }, 110)
    }
  }

  const commitWaterImmediate = (nextMl: number) => {
    if (waterTimerRef.current !== null) {
      window.clearTimeout(waterTimerRef.current)
      waterTimerRef.current = null
    }
    const clean = Math.max(0, Math.min(vessel.capacityMl, nextMl))
    pendingWaterRef.current = null
    setLiveWaterMl(null)
    onSetWaterVolume(clean)
  }

  const displayedWaterMl = liveWaterMl ?? solution.waterVolumeMl
  const totalVolumeL = Math.max(
    1e-6,
    (solution.totalVolumeMl - solution.waterVolumeMl + displayedWaterMl) / 1000,
  )

  const parsedEmptyWater = Number.parseFloat(waterInput.replace(',', '.'))
  const emptyWaterVal = Number.isFinite(parsedEmptyWater) ? parsedEmptyWater : 20

  const filteredSolids = node.filteredSolids ?? []

  if (!hasContent) {
    return (
      <div className="space-y-3 py-4 text-center">
        <p className="text-xs font-medium text-zinc-200">
          {node.hasFilter ? 'Filtre posé · verrerie prête' : 'Verrerie vide'}
        </p>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {node.hasFilter ? (
            <>
              Glissez directement une verrerie contenant un précipité ou un solide sur
              cette verrerie : les solides restent dans le filtre et le filtrat coule en
              dessous.
            </>
          ) : (
            <>
              Glissez un réactif directement (solide, liquide, gaz) ou ajoutez de l’eau (
              <span className="text-foreground">
                <ChemFormula value="H2O" />
              </span>
              ) pour une solution aqueuse.
            </>
          )}
        </p>
        <div className="space-y-2 pt-1 text-left">
          <div className="flex items-center gap-1.5">
            <ScrubNumberInput
              prefixLabel="V"
              value={emptyWaterVal}
              units={VOLUME_UNITS}
              defaultUnitId="mL"
              min={0.5}
              max={remainingMl}
              ariaLabel="Volume d’eau à ajouter"
              onChange={(ml) => onWaterInputChange(String(Math.round(ml * 10) / 10))}
              className="w-32 shrink-0"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={onSubmitWater}
              className="h-7 flex-1 text-[11px]"
            >
              Ajouter <ChemFormula value="H2O" />
            </Button>
          </div>
          <div className="flex flex-wrap justify-center gap-1">
            {quickWaterSteps
              .filter((v) => v <= remainingMl + 0.05)
              .map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => onAddWater(v)}
                  className="shrink-0 whitespace-nowrap rounded px-2 py-0.5 text-[10.5px] tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  +{v} mL
                </button>
              ))}
          </div>
        </div>
      </div>
    )
  }

  const dissolutionProductsById = new Map<string, CatalogDissolutionProduct[]>()
  for (const sp of catalog?.species ?? []) {
    if (sp.dissolutionProducts.length > 0) {
      dissolutionProductsById.set(sp.id, sp.dissolutionProducts)
    }
  }

  const reactantIds = new Set(activeRxn?.reactants.map((r) => r.speciesId) ?? [])
  const productIds = new Set(activeRxn?.products.map((p) => p.speciesId) ?? [])
  const isReactingPreview = Boolean(activeRxn && projected.xMol > 1e-8)

  const reactingDissolved = activeRxn
    ? projected.dissolvedSpecies.filter(
        (d) => reactantIds.has(d.speciesId) || productIds.has(d.speciesId),
      )
    : projected.dissolvedSpecies
  const spectatorDissolved = activeRxn
    ? projected.dissolvedSpecies.filter(
        (d) => !reactantIds.has(d.speciesId) && !productIds.has(d.speciesId),
      )
    : []

  // Also include depleted aqueous reactants (0 mol at current x) so the user sees them disappear
  const depletedReactants =
    activeRxn && isReactingPreview
      ? activeRxn.reactants.filter(
          (r) =>
            r.speciesId !== 'h2o' &&
            r.state === 'aqueous' &&
            !projected.dissolvedSpecies.some((d) => d.speciesId === r.speciesId),
        )
      : []

  return (
    <div className="space-y-4">
      {/* 1. Filter cake (filtration_funnel only) */}
      {filteredSolids.length > 0 && (
        <section className="space-y-2 border-b border-border/60 pb-3.5">
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-medium text-foreground">Sur le filtre</span>
            {onClearFilterCake && (
              <button
                type="button"
                onClick={onClearFilterCake}
                className="text-[10.5px] text-muted-foreground hover:text-foreground"
              >
                Nettoyer
              </button>
            )}
          </div>
          <ul className="divide-y divide-border/40">
            {filteredSolids.map((item) => (
              <li
                key={item.speciesId}
                className="flex items-center justify-between gap-2 py-1.5 text-[11px]"
              >
                <div className="flex min-w-0 items-center gap-1.5">
                  {item.colorHex && (
                    <span
                      className="h-2 w-2 shrink-0 rounded-full border border-white/15"
                      style={{ backgroundColor: item.colorHex }}
                    />
                  )}
                  <span className="font-semibold text-foreground">
                    <ChemFormula value={item.displayFormula} state="s" />
                  </span>
                  <span className="truncate text-muted-foreground">{item.nameFr}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-[10.5px] tabular-nums text-zinc-300">
                    {formatMassG(item.massG)}
                  </span>
                  {onExtractFilteredSolid && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onExtractFilteredSolid(item.speciesId)}
                      className="h-6 px-2 text-[10.5px] text-zinc-200 hover:bg-accent"
                    >
                      Récupérer
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* 2. Active reaction simulation & slider (above live beaker inventory so dragging x never shifts the slider) */}
      {activeRxn && (
        <section className={cn(filteredSolids.length > 0 && 'border-t border-border/60 pt-3.5')}>
          <ReactionControlCard
            variant="inspector"
            reaction={activeRxn}
            availableReactions={availableRxns}
            projected={projected}
            solution={solution}
            onChangeExtent={onChangeReactionExtent}
            onSelectReaction={onSelectReaction}
            onCommit={onCommitReaction}
            onBalanceStoichiometry={onBalanceStoichiometry}
          />
        </section>
      )}

      {/* 3. Live physical state inside the vessel (at current x) */}
      {(solution.hasWater || solution.solutes.length > 0) && (
        <section
          className={cn(
            'space-y-2.5',
            (activeRxn || filteredSolids.length > 0) && 'border-t border-border/60 pt-3.5',
          )}
        >
          <div className="flex items-baseline justify-between gap-2 text-[11px]">
            <span className="font-medium text-foreground">
              {node.hasFilter || filteredSolids.length > 0
                ? 'Dans le filtrat'
                : 'Dans le bécher'}
            </span>
            <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
              {isReactingPreview
                ? `x = ${Math.round(projected.progressRatio * 100)} %`
                : solution.hasWater
                  ? `Σz·[X] = ${formatFrNumber(Math.abs(netChargeConc) < 1e-4 ? 0 : netChargeConc, 2)}`
                  : 'Hors solvant'}
            </span>
          </div>

          {/* Solids / precipitates formed or immersed */}
          {projected.solidSpecies.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Solide / précipité
              </span>
              <div className="divide-y divide-border/40">
                {projected.solidSpecies.map((s) => {
                  const isFormed = isReactingPreview && productIds.has(s.speciesId)
                  return (
                    <div
                      key={s.speciesId}
                      className="flex items-center justify-between gap-2 py-1.5"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border border-white/20"
                          style={{ backgroundColor: s.colorHex ?? '#e4e4e7' }}
                        />
                        <span className="shrink-0 text-xs font-medium text-foreground">
                          <ChemFormula value={s.displayFormula} state="s" />
                        </span>
                        <span className="truncate text-[10.5px] text-muted-foreground">
                          {s.nameFr}
                        </span>
                        {isFormed && (
                          <span className="shrink-0 text-[10px] text-zinc-300">
                            ↗ formé
                          </span>
                        )}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-zinc-200">
                        {formatMassG(s.massG)} · {formatMol(s.amountMol)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Escaping gas */}
          {projected.gasProduced.length > 0 && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                Gaz dégagé
              </span>
              <div className="divide-y divide-border/40">
                {projected.gasProduced.map((g) => (
                  <div
                    key={g.speciesId}
                    className="flex items-center justify-between gap-2 py-1.5 text-[11.5px] tabular-nums text-foreground"
                  >
                    <span className="whitespace-nowrap">
                      ↑ <ChemFormula value={g.displayFormula} state="g" />
                    </span>
                    <span className="whitespace-nowrap text-zinc-200">
                      {formatVolumeMl(g.volumeMl)} · {formatMol(g.amountMol)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Two-phase immiscible liquid */}
          {solution.immisciblePhase && (
            <div className="space-y-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                  2<Sup>e</Sup> phase liquide
                </span>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  d = {formatFrNumber(solution.immisciblePhase.densityGPerCm3, 2)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 py-1.5 text-[11px]">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: solution.immisciblePhase.colorHex }}
                  />
                  <ChemFormula value={solution.immisciblePhase.formula} state="l" />
                </span>
                <span className="text-[10.5px] tabular-nums text-muted-foreground">
                  {solution.immisciblePhase.position === 'top' ? (
                    <>
                      au-dessus de <ChemFormula value="H2O" />
                    </>
                  ) : (
                    <>
                      sous <ChemFormula value="H2O" />
                    </>
                  )}{' '}
                  · {formatVolumeMl(solution.immisciblePhase.volumeMl)}
                </span>
              </div>
            </div>
          )}

          {/* Dissolved aqueous species (split into Active vs. Spectators when reacting) */}
          {solution.hasWater && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
                En solution
              </span>
              {projected.dissolvedSpecies.length === 0 && depletedReactants.length === 0 ? (
                <p className="py-1.5 text-[11px] text-muted-foreground">
                  Eau distillée pure ({formatFrNumber(solution.waterMol, 2)} mol{' '}
                  <ChemFormula value="H₂O" />)
                </p>
              ) : (
                <div className="divide-y divide-border/40">
                  {reactingDissolved.map((item) => {
                    const isConsumed = isReactingPreview && reactantIds.has(item.speciesId)
                    const isFormed = isReactingPreview && productIds.has(item.speciesId)
                    return (
                      <button
                        key={item.speciesId}
                        type="button"
                        onClick={() =>
                          onOpenInCatalog({ section: 'species', id: item.speciesId })
                        }
                        className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:bg-accent/40"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {item.colorHex && (
                            <span
                              className="h-2 w-2 shrink-0 rounded-full"
                              style={{ backgroundColor: item.colorHex }}
                            />
                          )}
                          <span className="shrink-0 text-xs font-medium text-foreground">
                            <ChemFormula value={item.displayFormula} state="aq" />
                          </span>
                          <span className="truncate text-[10.5px] text-muted-foreground">
                            {item.nameFr}
                          </span>
                          {isConsumed && (
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              ↘
                            </span>
                          )}
                          {isFormed && (
                            <span className="shrink-0 text-[10px] text-zinc-200">
                              ↗
                            </span>
                          )}
                        </div>
                        <div className="shrink-0 text-right tabular-nums leading-tight">
                          <p className="whitespace-nowrap text-[11px] font-medium text-foreground">
                            {formatConcMolL(item.concentrationMolPerL)}
                          </p>
                          <p className="whitespace-nowrap text-[10px] text-muted-foreground">
                            {formatMol(item.amountMol)} ·{' '}
                            {formatConcGL(item.massConcentrationGPerL)}
                          </p>
                        </div>
                      </button>
                    )
                  })}

                  {depletedReactants.map((r) => (
                    <div
                      key={`dep-${r.speciesId}`}
                      className="flex items-center justify-between gap-3 py-2 opacity-45"
                    >
                      <div className="min-w-0">
                        <p className="text-xs line-through text-muted-foreground">
                          <ChemFormula value={r.displayFormula} state="aq" />
                        </p>
                        <p className="truncate text-[10.5px] text-muted-foreground">
                          Consommé
                        </p>
                      </div>
                      <div className="shrink-0 text-right tabular-nums">
                        <p className="text-[11px] text-muted-foreground">0 mol/L</p>
                        <p className="text-[10px] text-muted-foreground">0 mol</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Spectator ions separated quietly underneath */}
              {spectatorDissolved.length > 0 && (
                <div className="pt-1.5">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
                    Spectateurs
                  </span>
                  <div className="divide-y divide-border/30">
                    {spectatorDissolved.map((item) => (
                      <button
                        key={item.speciesId}
                        type="button"
                        onClick={() =>
                          onOpenInCatalog({ section: 'species', id: item.speciesId })
                        }
                        className="flex w-full items-center justify-between gap-3 py-1.5 text-left hover:bg-accent/40"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="shrink-0 text-[11.5px] text-zinc-300">
                            <ChemFormula value={item.displayFormula} state="aq" />
                          </span>
                          <span className="truncate text-[10.5px] text-muted-foreground">
                            {item.nameFr}
                          </span>
                        </div>
                        <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                          {formatConcMolL(item.concentrationMolPerL)} · {formatMol(item.amountMol)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. Editable user inputs (recipe) */}
      <section className="space-y-1 border-t border-border/60 pt-3.5">
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span className="font-medium text-foreground">Ajouts</span>
          <span className="text-[10.5px] tabular-nums">
            {solution.solutes.length + (solution.hasWater ? 1 : 0)}
          </span>
        </div>

        <div className="divide-y divide-border/40">
          {/* Solvent H2O scrub editor */}
          {solution.hasWater && (
            <div className="space-y-2 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground">
                    <ChemFormula value="H₂O" state="l" />
                  </span>
                  <span className="truncate text-[11px] text-muted-foreground">
                    Eau distillée
                  </span>
                </div>
                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                  {formatFrNumber(solution.waterMol, 2)} mol
                </span>
              </div>

              <ScrubNumberInput
                prefixLabel="V"
                value={displayedWaterMl}
                units={VOLUME_UNITS}
                defaultUnitId={vessel.capacityMl >= 1000 ? 'L' : 'mL'}
                min={0}
                max={vessel.capacityMl}
                ariaLabel="Volume d’eau dans la verrerie"
                onChange={scheduleWaterUpdate}
                onScrubEnd={commitWaterImmediate}
              />

              <div className="flex flex-wrap items-center justify-between gap-1 text-[10px]">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      commitWaterImmediate(Math.max(1, solution.waterVolumeMl / 2))
                    }
                    className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    ÷2
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      commitWaterImmediate(
                        Math.min(vessel.capacityMl, solution.waterVolumeMl * 2),
                      )
                    }
                    className="rounded px-1.5 py-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    ×2
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-0.5">
                  {quickWaterSteps
                    .filter((v) => v <= vessel.capacityMl + 0.05)
                    .map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => commitWaterImmediate(v)}
                        className="rounded px-1.5 py-0.5 tabular-nums text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        {v} mL
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}

          {/* Each introduced solute / reagent with linked n, m, C, Cm + micro dissociation formula */}
          {solution.solutes.map((sol) => (
            <EditableSoluteRow
              key={sol.speciesId}
              sol={sol}
              hasWater={solution.hasWater}
              totalVolumeL={totalVolumeL}
              dissolutionProducts={dissolutionProductsById.get(sol.speciesId)}
              onOpenCatalog={() =>
                onOpenInCatalog({ section: 'species', id: sol.speciesId })
              }
              onSetAmountMol={(mol) => onSetSoluteAmount(sol.speciesId, mol)}
            />
          ))}
        </div>
      </section>

      {/* 5. pH & conductivity */}
      <section className="space-y-2 border-t border-border/60 pt-3.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
            pH & conductivité
          </span>
          <span className="truncate text-[11px] text-zinc-300">
            <ChemFormula value={solution.formulaLabel} />
          </span>
        </div>

        {projected.phEstimate !== null && (
          <div>
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="shrink-0 text-muted-foreground">pH estimé</span>
              <span className="whitespace-nowrap tabular-nums text-foreground">
                <span className="inline-block w-[5ch] text-right">
                  {formatFrNumber(projected.phEstimate, 2)}
                </span>{' '}
                <span className="inline-block w-[9ch] text-left text-[10.5px] text-muted-foreground">
                  (
                  {projected.phEstimate < 6.5
                    ? 'acide'
                    : projected.phEstimate > 7.5
                      ? 'basique'
                      : 'neutre'}
                  )
                </span>
              </span>
            </div>
            {projected.conductivityMsCm !== null && (
              <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                <span className="shrink-0 text-muted-foreground">Conductivité σ</span>
                <span className="whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
                  {formatFrNumber(projected.conductivityMsCm, 2)} mS/cm
                </span>
              </div>
            )}
            <div className="relative mt-2 h-1.5 w-full rounded-full bg-zinc-800">
              <span
                className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-zinc-950 bg-zinc-100"
                style={{
                  left: `${Math.max(2, Math.min(98, (projected.phEstimate / 14) * 100))}%`,
                }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[9.5px] text-muted-foreground">
              <span>0</span>
              <span>7</span>
              <span>14</span>
            </div>
          </div>
        )}
      </section>

      {!activeRxn && matchingReactions.length > 0 && (
        <section className="space-y-1.5 border-t border-border/60 pt-3.5">
          <p className="text-[11px] font-medium text-muted-foreground">Réaction répertoriée</p>
          <div className="space-y-1.5">
            {matchingReactions.map((r) => (
              <div key={r.id}>
                <p className="text-[11.5px] font-medium text-foreground">{r.nameFr}</p>
                <p className="break-words text-[10.5px] text-muted-foreground">
                  <ChemFormula value={r.equationDisplay} />
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
