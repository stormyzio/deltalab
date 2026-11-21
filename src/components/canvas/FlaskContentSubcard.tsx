import type {
  CanvasFlaskNode,
} from '../../../shared/chemistry.ts'
import type { ProjectedFlaskState } from '@/lib/flask-reaction-ui'
import {
  formatConcMolL,
  formatMassG,
  formatMol,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import {
  PH_INDICATOR_BY_ID,
  evaluateIndicatorVisual,
} from '@/lib/lab-indicators'
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
  const indicatorSpec = node.indicatorId ? PH_INDICATOR_BY_ID[node.indicatorId] : null
  const indicatorColor =
    node.indicatorId && projected.phEstimate !== null
      ? evaluateIndicatorVisual(node.indicatorId, projected.phEstimate).hex
      : indicatorSpec?.baseHex ?? null

  const soluteFormulas = new Set(solution.solutes.map((s) => s.displayFormula))
  const extraIons = projected.dissolvedSpecies.filter(
    (d) => !soluteFormulas.has(d.displayFormula),
  )

  return (
    <div className="w-[216px] rounded-lg border border-border/90 bg-panel/95 px-2.5 py-2 text-left shadow-lg">
      <div className="flex items-center justify-between gap-2 pb-1 text-[10px] text-muted-foreground">
        <span className="font-medium">Contenu</span>
        <span className="shrink-0 whitespace-nowrap font-mono tabular-nums">
          {solution.hasWater
            ? formatVolumeMl(solution.totalVolumeMl)
            : 'Hors solvant'}
        </span>
      </div>

      <ul className="divide-y divide-border/40 border-t border-border/50">
        {solution.hasWater && (
          <li className="flex items-baseline justify-between gap-2 py-1 text-[10.5px]">
            <span className="flex min-w-0 items-baseline">
              <span className="shrink-0 font-mono font-medium text-zinc-300">
                <ChemFormula value="H₂O" state="l" />
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-muted-foreground">
              {formatVolumeMl(solution.waterVolumeMl)}
            </span>
          </li>
        )}

        {solution.solutes.map((sol) => {
          const isSolid = sol.isImmersedSolid || (!solution.hasWater && sol.undissolvedMol > 0)
          const showDot = isChromaticHex(sol.colorHex)
          const st = isSolid ? 's' : solution.hasWater ? 'aq' : 'l'
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
                <span className="truncate font-mono font-medium text-foreground">
                  <ChemFormula value={sol.displayFormula} />
                  <StateTag state={st} />
                </span>
                {sol.isSaturated && (
                  <span className="shrink-0 font-mono text-[9px] text-amber-300">
                    sat.
                  </span>
                )}
              </span>
              <span className="shrink-0 whitespace-nowrap font-mono text-[10px] tabular-nums text-zinc-300">
                {isSolid
                  ? `${formatMol(sol.addedMol)} · ${formatMassG(sol.addedMassG)}`
                  : solution.hasWater && sol.concentrationMolPerL > 0
                    ? `${formatMol(sol.addedMol)} · ${formatConcMolL(sol.concentrationMolPerL)}`
                    : formatMol(sol.addedMol)}
              </span>
            </li>
          )
        })}
      </ul>

      {extraIons.length > 0 && (
        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 border-t border-border/50 pt-1 font-mono text-[9.5px] text-muted-foreground">
          <span>Ions :</span>
          {extraIons.slice(0, 4).map((ion) => (
            <span
              key={ion.speciesId}
              className="inline-flex items-center gap-1 text-zinc-300"
            >
              {isChromaticHex(ion.colorHex) && (
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: ion.colorHex ?? undefined }}
                />
              )}
              <ChemFormula value={ion.displayFormula} />
            </span>
          ))}
          {extraIons.length > 4 && <span>+{extraIons.length - 4}</span>}
        </div>
      )}

      {indicatorSpec && (
        <div className="mt-1 flex items-center justify-between gap-2 border-t border-border/50 pt-1 text-[10px] text-muted-foreground">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate">
            {indicatorColor && (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: indicatorColor }}
              />
            )}
            <span className="truncate">{indicatorSpec.nameFr}</span>
          </span>
        </div>
      )}
    </div>
  )
}
