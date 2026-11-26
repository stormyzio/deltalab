import type { ReactNode } from 'react'
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
import { ChemFormula } from '@/components/ui/chem-text'

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

function SubcardSection({
  title,
  meta,
  children,
}: {
  title: string
  meta?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="py-1.5 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[9.5px] font-medium uppercase tracking-wider text-muted-foreground/85">
          {title}
        </span>
        {meta !== undefined && meta !== null && (
          <span className="shrink-0 whitespace-nowrap text-[9.5px] tabular-nums text-muted-foreground">
            {meta}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5">{children}</div>
    </div>
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

  const hasFilter = Boolean(node.hasFilter || filteredSolids.length > 0)
  const hasGases = projected.gasProduced.length > 0
  const hasSolids = projected.solidSpecies.length > 0
  const hasDissolved = projected.dissolvedSpecies.length > 0
  const immiscible = solution.immisciblePhase ?? null

  if (
    filteredSolids.length === 0 &&
    !solution.hasWater &&
    !hasGases &&
    !hasDissolved &&
    !hasSolids &&
    !immiscible &&
    !indicatorSpec
  ) {
    return null
  }

  const soluteById = new Map(solution.solutes.map((s) => [s.speciesId, s]))

  const isSatExcess = (speciesId: string): boolean => {
    const meta = soluteById.get(speciesId)
    return Boolean(meta && !meta.isImmersedSolid && meta.dissolvedMol > 1e-7)
  }

  const satFlags = projected.solidSpecies.map((s) => isSatExcess(s.speciesId))
  const allSatExcess = satFlags.length > 0 && satFlags.every(Boolean)
  const noneSatExcess = satFlags.length > 0 && satFlags.every((v) => !v)
  const isMixedSolids = solution.hasWater && !allSatExcess && !noneSatExcess
  const solidSectionTitle = !solution.hasWater
    ? 'Solide'
    : allSatExcess
      ? 'Excès non dissous'
      : noneSatExcess
        ? 'Non soluble'
        : 'Solides non dissous'

  const hasLowerPhaseBelowGas =
    solution.hasWater || hasSolids || hasDissolved || Boolean(immiscible)

  return (
    <div className="w-[236px] divide-y divide-border/60 rounded-lg border border-border/90 bg-panel/95 px-2.5 py-2 text-left shadow-lg">
      {/* 1. Solids retained on filter paper */}
      {filteredSolids.length > 0 && (
        <SubcardSection title="Sur le filtre" meta="retenu">
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
                      style={{ backgroundColor: item.colorHex }}
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
        </SubcardSection>
      )}

      {/* 2. Headspace gases */}
      {hasGases && (
        <SubcardSection
          title="Gaz"
          meta={hasLowerPhaseBelowGas ? 'en haut' : undefined}
        >
          <ul className="space-y-0.5">
            {projected.gasProduced.map((g) => (
              <li
                key={`gas-${g.speciesId}`}
                className="flex items-baseline justify-between gap-2 text-[10.5px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full border border-dashed border-sky-300/70"
                    style={{
                      backgroundColor: isChromaticHex(g.colorHex)
                        ? g.colorHex
                        : 'rgba(125,211,252,0.28)',
                    }}
                  />
                  <span className="truncate font-medium text-foreground">
                    <ChemFormula value={g.displayFormula} state="g" />
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                  {formatVolumeMl(g.volumeMl)} · {formatMol(g.amountMol)}
                </span>
              </li>
            ))}
          </ul>
        </SubcardSection>
      )}

      {/* 3. Immiscible top liquid layer */}
      {immiscible && immiscible.position === 'top' && (
        <SubcardSection
          title="Non miscible"
          meta={`flotte · d ${formatFrNumber(immiscible.densityGPerCm3, 2)}`}
        >
          <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: immiscible.colorHex }}
              />
              <span className="truncate font-medium text-foreground">
                <ChemFormula value={immiscible.formula} state="l" />
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
              {formatVolumeMl(immiscible.volumeMl)}
            </span>
          </div>
        </SubcardSection>
      )}

      {/* 4. Aqueous solution or anhydrous liquid */}
      {solution.hasWater ? (
        hasDissolved ? (
          <SubcardSection
            title={hasFilter ? 'Filtrat · en solution' : 'En solution'}
            meta={
              <>
                <ChemFormula value="H2O" /> {formatVolumeMl(solution.waterVolumeMl)}
              </>
            }
          >
            <ul className="space-y-0.5">
              {projected.dissolvedSpecies.slice(0, 6).map((d) => {
                const isSat = Boolean(soluteById.get(d.speciesId)?.isSaturated)
                return (
                  <li
                    key={`aq-${d.speciesId}`}
                    className="flex items-baseline justify-between gap-2 text-[10.5px]"
                  >
                    <span className="flex min-w-0 items-center gap-1.5">
                      {isChromaticHex(d.colorHex) && (
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ backgroundColor: d.colorHex }}
                        />
                      )}
                      <span className="truncate font-medium text-foreground">
                        <ChemFormula value={d.displayFormula} state="aq" />
                      </span>
                      {isSat && (
                        <span className="shrink-0 text-[9px] text-amber-300">
                          sat.
                        </span>
                      )}
                    </span>
                    <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                      {d.concentrationMolPerL > 0
                        ? formatConcMolL(d.concentrationMolPerL)
                        : formatMol(d.amountMol)}
                    </span>
                  </li>
                )
              })}
              {projected.dissolvedSpecies.length > 6 && (
                <li className="text-[9.5px] text-muted-foreground">
                  +{projected.dissolvedSpecies.length - 6} autres
                </li>
              )}
            </ul>
          </SubcardSection>
        ) : (
          <SubcardSection title={hasFilter ? 'Filtrat' : 'Liquide'}>
            <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
              <span className="font-medium text-foreground">
                <ChemFormula value="H2O" state="l" />
              </span>
              <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                {formatVolumeMl(solution.waterVolumeMl)}
              </span>
            </div>
          </SubcardSection>
        )
      ) : hasDissolved ? (
        <SubcardSection
          title="Liquide"
          meta={
            solution.totalVolumeMl > 0
              ? formatVolumeMl(solution.totalVolumeMl)
              : undefined
          }
        >
          <ul className="space-y-0.5">
            {projected.dissolvedSpecies.slice(0, 6).map((d) => (
              <li
                key={`liq-${d.speciesId}`}
                className="flex items-baseline justify-between gap-2 text-[10.5px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {isChromaticHex(d.colorHex) && (
                    <span
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: d.colorHex }}
                    />
                  )}
                  <span className="truncate font-medium text-foreground">
                    <ChemFormula value={d.displayFormula} state="l" />
                  </span>
                </span>
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                  {formatMol(d.amountMol)}
                </span>
              </li>
            ))}
            {projected.dissolvedSpecies.length > 6 && (
              <li className="text-[9.5px] text-muted-foreground">
                +{projected.dissolvedSpecies.length - 6} autres
              </li>
            )}
          </ul>
        </SubcardSection>
      ) : null}

      {/* 5. Immiscible bottom liquid layer */}
      {immiscible && immiscible.position === 'bottom' && (
        <SubcardSection
          title="Non miscible"
          meta={`au fond · d ${formatFrNumber(immiscible.densityGPerCm3, 2)}`}
        >
          <div className="flex items-baseline justify-between gap-2 text-[10.5px]">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: immiscible.colorHex }}
              />
              <span className="truncate font-medium text-foreground">
                <ChemFormula value={immiscible.formula} state="l" />
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
              {formatVolumeMl(immiscible.volumeMl)}
            </span>
          </div>
        </SubcardSection>
      )}

      {/* 6. Undissolved solids / insoluble / precipitates */}
      {hasSolids && (
        <SubcardSection title={solidSectionTitle}>
          <ul className="space-y-0.5">
            {projected.solidSpecies.map((s) => (
              <li
                key={`sol-${s.speciesId}`}
                className="flex items-baseline justify-between gap-2 text-[10.5px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/15"
                    style={{ backgroundColor: s.colorHex ?? '#d4d4d8' }}
                  />
                  <span className="truncate font-medium text-foreground">
                    <ChemFormula value={s.displayFormula} state="s" />
                  </span>
                  {isMixedSolids && isSatExcess(s.speciesId) && (
                    <span className="shrink-0 text-[9px] text-amber-300">
                      sat.
                    </span>
                  )}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[10px] tabular-nums text-zinc-300">
                  {formatMassG(s.massG)}
                </span>
              </li>
            ))}
          </ul>
        </SubcardSection>
      )}

      {/* 7. pH Indicator */}
      {indicatorSpec && (
        <SubcardSection title="Indicateur">
          <div className="flex items-center gap-1.5 text-[10.5px] text-muted-foreground">
            {indicatorColor && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: indicatorColor }}
              />
            )}
            <span className="truncate text-foreground/90">{indicatorSpec.nameFr}</span>
          </div>
        </SubcardSection>
      )}
    </div>
  )
}
