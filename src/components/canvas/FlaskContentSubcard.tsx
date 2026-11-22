import type { CanvasFlaskNode } from '../../../shared/chemistry.ts'
import type { ProjectedFlaskState } from '@/lib/flask-reaction-ui'
import {
  formatConcMolL,
  formatFrNumber,
  formatMassG,
  formatMol,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { PH_INDICATOR_BY_ID, evaluateIndicatorVisual } from '@/lib/lab-indicators'
import { ChemFormula, StateTag } from '@/components/ui/chem-text'

function isChromaticHex(hex: string | null | undefined): hex is string {
  if (!hex) return false
  const h = hex.toLowerCase()
  return (
    h !== '#ffffff' &&
    h !== '#f4f4f5' &&
    h !== '#e4e4e7' &&
    h !== '#d4d4d8' &&
    h !== '#bae6fd' &&
    h !== '#e0f2fe'
  )
}

export function FlaskContentSubcard({
  node,
  projected,
}: {
  node: CanvasFlaskNode
  projected: ProjectedFlaskState
}) {
  const { solution } = node
  const filteredSolids = node.filteredSolids ?? []
  const indicatorSpec = node.indicatorId ? PH_INDICATOR_BY_ID[node.indicatorId] : null
  const indicatorColor =
    node.indicatorId && projected.phEstimate !== null
      ? evaluateIndicatorVisual(node.indicatorId, projected.phEstimate).hex
      : indicatorSpec?.baseHex ?? null

  const soluteIds = new Set(solution.solutes.map((s) => s.speciesId))
  const hasDissociatedIons = projected.dissolvedSpecies.some(
    (d) => !soluteIds.has(d.speciesId),
  )
  const hasSolids = projected.solidSpecies.length > 0
  const hasSplitState = hasDissociatedIons || hasSolids || Boolean(solution.immisciblePhase)
  const hasLiquidOrSolutes = solution.hasWater || solution.solutes.length > 0

  return (
    <div className="w-[228px] rounded-lg border border-border/90 bg-panel/95 px-2.5 py-2 text-left shadow-lg">
      {/* 1. Solids retained on filter paper (filtration_funnel) */}
      {filteredSolids.length > 0 && (
        <div className={hasLiquidOrSolutes ? 'mb-1.5 border-b border-border/60 pb-1.5' : ''}>
          <div className="flex items-center justify-between gap-2 pb-0.5 text-[10px] text-muted-foreground">
            <span className="font-medium">Sur le filtre</span>
            <span className="text-[9.5px]">retenu</span>
          </div>
          <ul className="space-y-0.5">
            {filteredSolids.map((item) => (
              <li
                key={item.speciesId}
                className="flex items-baseline justify-between gap-2 text-[10.5px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {isChromaticHex(item.colorHex) && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.colorHex ?? undefined }}
                    />
                  )}
                  <span className="truncate font-medium text-foreground">
                    <ChemFormula value={item.displayFormula} state="s" />
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                  {formatMassG(item.massG)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 2. Real present state vs. raw inputs */}
      {hasLiquidOrSolutes && hasSplitState ? (
        <div className="space-y-1.5">
          {/* Compact 1-line summary of what was added */}
          <div className="flex items-baseline justify-between gap-2 text-[10px] text-muted-foreground">
            <span className="shrink-0 font-medium">Ajouts</span>
            <span className="min-w-0 truncate text-right text-[9.5px] tabular-nums text-zinc-400">
              {solution.hasWater && (
                <>
                  <ChemFormula value="H2O" /> {formatVolumeMl(solution.waterVolumeMl)}
                </>
              )}
              {solution.hasWater && solution.solutes.length > 0 ? ' · ' : ''}
              {solution.solutes.map((s, idx) => (
                <span key={s.speciesId}>
                  {idx > 0 && ' · '}
                  <ChemFormula value={s.displayFormula} />
                </span>
              ))}
            </span>
          </div>

          {/* Present physical state */}
          <div className="border-t border-border/60 pt-1.5">
            <div className="flex items-center justify-between gap-2 pb-1 text-[10px] text-muted-foreground">
              <span className="font-medium text-zinc-300">
                {node.hasFilter || filteredSolids.length > 0 ? 'Filtrat' : 'Présent'}
              </span>
              <span className="shrink-0 tabular-nums">
                {solution.hasWater ? formatVolumeMl(solution.totalVolumeMl) : 'Hors solvant'}
              </span>
            </div>

            <ul className="divide-y divide-border/40">
              {/* Solids / precipitates */}
              {projected.solidSpecies.map((s) => (
                <li
                  key={`sol-${s.speciesId}`}
                  className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/15"
                      style={{ backgroundColor: s.colorHex ?? '#d4d4d8' }}
                    />
                    <span className="truncate font-medium text-foreground">
                      <ChemFormula value={s.displayFormula} state="s" />
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                    {formatMassG(s.massG)}
                  </span>
                </li>
              ))}

              {/* Immiscible liquid layer */}
              {solution.immisciblePhase && (
                <li className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: solution.immisciblePhase.colorHex }}
                    />
                    <span className="truncate font-medium text-foreground">
                      <ChemFormula value={solution.immisciblePhase.formula} state="l" />
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[9.5px] tabular-nums text-muted-foreground">
                    {solution.immisciblePhase.position === 'top' ? 'flotte' : 'en bas'} · d{' '}
                    {formatFrNumber(solution.immisciblePhase.densityGPerCm3, 2)}
                  </span>
                </li>
              )}

              {/* Dissolved ions & molecules */}
              {projected.dissolvedSpecies.slice(0, 5).map((d) => (
                <li
                  key={`aq-${d.speciesId}`}
                  className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {isChromaticHex(d.colorHex) && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: d.colorHex ?? undefined }}
                      />
                    )}
                    <span className="truncate font-medium text-foreground">
                      <ChemFormula value={d.displayFormula} state="aq" />
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                    {d.concentrationMolPerL > 0
                      ? formatConcMolL(d.concentrationMolPerL)
                      : formatMol(d.amountMol)}
                  </span>
                </li>
              ))}
              {projected.dissolvedSpecies.length > 5 && (
                <li className="py-1 text-[9.5px] text-muted-foreground">
                  +{projected.dissolvedSpecies.length - 5} autres en solution
                </li>
              )}
            </ul>
          </div>
        </div>
      ) : hasLiquidOrSolutes ? (
        /* Simple non-dissociating case (pure water, glucose, ethanol…): single clean list */
        <>
          <div className="flex items-center justify-between gap-2 pb-1 text-[10px] text-muted-foreground">
            <span className="font-medium">
              {node.hasFilter || filteredSolids.length > 0 ? 'Filtrat' : 'Contenu'}
            </span>
            <span className="shrink-0 whitespace-nowrap tabular-nums">
              {solution.hasWater
                ? formatVolumeMl(solution.totalVolumeMl)
                : 'Hors solvant'}
            </span>
          </div>

          <ul className="divide-y divide-border/40 border-t border-border/50">
            {solution.hasWater && (
              <li className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]">
                <span className="shrink-0 font-medium text-zinc-300">
                  <ChemFormula value="H₂O" state="l" />
                </span>
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                  {formatVolumeMl(solution.waterVolumeMl)}
                </span>
              </li>
            )}

            {solution.solutes.map((sol) => {
              const showDot = isChromaticHex(sol.colorHex)
              const st = solution.hasWater ? 'aq' : 'l'
              return (
                <li
                  key={sol.speciesId}
                  className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]"
                >
                  <span className="flex min-w-0 items-center gap-1.5">
                    {showDot && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: sol.colorHex ?? undefined }}
                      />
                    )}
                    <span className="truncate font-medium text-foreground">
                      <ChemFormula value={sol.displayFormula} />
                      <StateTag state={st} />
                    </span>
                    {sol.isSaturated && (
                      <span className="shrink-0 text-[9px] text-amber-300">
                        sat.
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                    {formatMol(sol.addedMol)}
                    {solution.hasWater && sol.concentrationMolPerL > 0 && (
                      <span className="inline-block min-w-[7.5ch] text-right text-muted-foreground">
                        {' '}
                        · {formatConcMolL(sol.concentrationMolPerL)}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      ) : null}

      {indicatorSpec && (
        <div className="mt-1 flex items-center gap-1.5 border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
          {indicatorColor && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: indicatorColor }}
            />
          )}
          <span className="truncate">{indicatorSpec.nameFr}</span>
        </div>
      )}
    </div>
  )
}
