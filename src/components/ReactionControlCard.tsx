import { useMemo, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type {
  FlaskActiveReaction,
  FlaskReactionParticipant,
  FlaskSolutionState,
} from '../../shared/chemistry.ts'
import type { ProjectedFlaskState } from '@/lib/flask-reaction-ui'
import { formatMassG, formatMol, formatVolumeMl } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { ChemFormula, ChemText, ChemVar, StateTag } from '@/components/ui/chem-text'
import { InlineNumberInput } from '@/components/ui/inline-number-input'
import { Slider } from '@/components/ui/slider'
import {
  ReactionBarChart,
  ReactionStoichiometryTable,
  type ReactionBarDatum,
} from '@/components/ReactionCharts'

/** Authentic chemical colors ONLY for species that are genuinely colored in lab reality.
 *  Colorless species (ClO-, Cl-, H3O+, OH-, Ag+, NO3-, Zn2+, etc.) stay monochrome zinc. */
const AUTHENTIC_CHEMICAL_COLORS: Record<string, string> = {
  cu2_plus: '#0ea5e9',
  cu_solid: '#c26a3d',
  fe2_plus: '#4ade80',
  fe3_plus: '#d97706',
  mno4_minus: '#a855f7',
  cr2o7_2minus: '#f97316',
  cr3_plus: '#10b981',
  cl2: '#a3e635',
  br2: '#ea580c',
  i2: '#b45309',
  cu_nh3_4_2plus: '#2563eb',
  pbi2: '#facc15',
  cuoh2: '#38bdf8',
  feoh3: '#b45309',
  feoh2: '#65a30d',
  mno2: '#92400e',
  ag2cro4: '#b91c1c',
  co2_plus: '#f472b6',
  ni2_plus: '#34d399',
  au_solid: '#eab308',
}

function getParticipantBarColor(p: FlaskReactionParticipant): string {
  const known = AUTHENTIC_CHEMICAL_COLORS[p.speciesId]
  if (known) return known
  if (p.colorHex) {
    const hex = p.colorHex.toLowerCase()
    if (
      hex !== '#f4f4f5' &&
      hex !== '#e4e4e7' &&
      hex !== '#d4d4d8' &&
      hex !== '#ffffff' &&
      hex !== '#bae6fd' &&
      hex !== '#e0f2fe'
    ) {
      return p.colorHex
    }
  }
  return '#a1a1aa'
}

interface ReactionControlCardProps {
  variant: 'canvas' | 'inspector'
  reaction: FlaskActiveReaction
  availableReactions: FlaskActiveReaction[]
  projected: ProjectedFlaskState
  solution?: FlaskSolutionState
  onChangeExtent: (xMol: number) => void
  onSelectReaction: (reactionId: string) => void
  onCommit: () => void
  onBalanceStoichiometry?: () => void
  dataReactionBarId?: string
}

export function ReactionControlCard({
  variant,
  reaction,
  availableReactions,
  projected,
  solution,
  onChangeExtent,
  onSelectReaction,
  onCommit,
  onBalanceStoichiometry,
  dataReactionBarId,
}: ReactionControlCardProps) {
  const [collapsed, setCollapsed] = useState(false)

  const pct = Math.round(projected.progressRatio * 100)
  const arrow = reaction.equationDisplay.includes('⇌') ? '⇌' : '→'

  const { reactantBars, productBars, maxScaleMol } = useMemo(() => {
    const rList: ReactionBarDatum[] = reaction.reactants
      .filter((r) => r.speciesId !== 'h2o')
      .map((r) => {
        const currentMol = Math.max(0, r.initialMol - r.stoichiometry * projected.xMol)
        const finalMol = Math.max(0, r.initialMol - r.stoichiometry * reaction.xMaxMol)
        return {
          ...r,
          currentMol,
          finalMol,
          referenceMol: r.initialMol,
          barColor: getParticipantBarColor(r),
        }
      })

    const pList: ReactionBarDatum[] = reaction.products
      .filter((p) => p.speciesId !== 'h2o')
      .map((p) => {
        const currentMol = p.initialMol + p.stoichiometry * projected.xMol
        const finalMol = p.initialMol + p.stoichiometry * reaction.xMaxMol
        return {
          ...p,
          currentMol,
          finalMol,
          referenceMol: finalMol,
          barColor: getParticipantBarColor(p),
        }
      })

    let peak = 0
    for (const r of rList) peak = Math.max(peak, r.initialMol, r.currentMol)
    for (const p of pList) peak = Math.max(peak, p.finalMol, p.currentMol)

    return {
      reactantBars: rList,
      productBars: pList,
      maxScaleMol: peak > 1e-9 ? peak : 1,
    }
  }, [projected.xMol, reaction.products, reaction.reactants, reaction.xMaxMol])

  const isCanvas = variant === 'canvas'
  const canBalance =
    Boolean(onBalanceStoichiometry) &&
    reactantBars.filter((r) => r.speciesId !== 'h2o').length >= 2 &&
    !reactantBars.filter((r) => r.speciesId !== 'h2o').every((r) => r.isLimiting)

  const snapPoints = useMemo(
    () => [
      0,
      reaction.xMaxMol * 0.25,
      reaction.xMaxMol * 0.5,
      reaction.xMaxMol * 0.75,
      reaction.xMaxMol,
    ],
    [reaction.xMaxMol],
  )

  const spectatorSpecies = useMemo(() => {
    const activeIds = new Set([
      ...reaction.reactants.map((r) => r.speciesId),
      ...reaction.products.map((p) => p.speciesId),
    ])
    return projected.dissolvedSpecies.filter((d) => !activeIds.has(d.speciesId))
  }, [projected.dissolvedSpecies, reaction.products, reaction.reactants])

  return (
    <div
      data-reaction-bar={dataReactionBarId}
      onPointerDown={isCanvas ? (e) => e.stopPropagation() : undefined}
      onClick={isCanvas ? (e) => e.stopPropagation() : undefined}
      className={cn(
        isCanvas
          ? 'relative w-[432px] cursor-default rounded-xl border border-border bg-panel/98 px-4 py-3.5 shadow-2xl'
          : 'space-y-0',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          {!collapsed && availableReactions.length > 1 ? (
            <select
              value={reaction.id}
              onChange={(e) => onSelectReaction(e.target.value)}
              aria-label="Choisir la réaction"
              className="h-6 min-w-0 flex-1 rounded bg-transparent pr-2 text-xs font-semibold text-foreground hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              {availableReactions.map((r) => (
                <option key={r.id} value={r.id} className="bg-panel text-foreground">
                  {r.nameFr}
                </option>
              ))}
            </select>
          ) : (
            <span className="truncate text-xs font-semibold tracking-tight text-foreground">
              {reaction.nameFr}
            </span>
          )}

          {reaction.equilibriumLabel && (
            <span className="shrink-0 whitespace-nowrap text-[10.5px] tabular-nums text-muted-foreground">
              <ChemText value={reaction.equilibriumLabel} />
            </span>
          )}
        </div>

        {isCanvas && (
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Développer la réaction' : 'Réduire la réaction'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.6} />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 leading-snug">
        {reaction.reactants.map((r, idx) => (
          <span key={`eq-r-${r.speciesId}`} className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
            {idx > 0 && <span className="mr-1 text-[11px] text-zinc-500">+</span>}
            {r.stoichiometry > 1 && (
              <span className="text-xs font-normal text-zinc-400">{r.stoichiometry}</span>
            )}
            <span className="text-[12.5px] font-medium text-foreground">
              <ChemFormula value={r.displayFormula} />
              <StateTag state={r.state} />
            </span>
          </span>
        ))}

        <span className="mx-1 text-xs text-zinc-400">{arrow}</span>

        {reaction.products.map((p, idx) => (
          <span key={`eq-p-${p.speciesId}`} className="inline-flex items-baseline gap-0.5 whitespace-nowrap">
            {idx > 0 && <span className="mr-1 text-[11px] text-zinc-500">+</span>}
            {p.stoichiometry > 1 && (
              <span className="text-xs font-normal text-zinc-400">{p.stoichiometry}</span>
            )}
            <span className="text-[12.5px] font-medium text-foreground">
              <ChemFormula value={p.displayFormula} />
              <StateTag state={p.state} />
            </span>
          </span>
        ))}
      </div>

      {collapsed && (
        <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-2 text-[10.5px] tabular-nums text-muted-foreground">
          <span className="truncate">
            x = <span className="text-foreground">{formatMol(projected.xMol)}</span> /{' '}
            {formatMol(reaction.xMaxMol)}
          </span>
          <span className="shrink-0 whitespace-nowrap">{pct} %</span>
        </div>
      )}

      {!collapsed && (
        <>
          <ReactionBarChart
            reactantBars={reactantBars}
            productBars={productBars}
            maxScaleMol={maxScaleMol}
            isCanvas={isCanvas}
          />

          <div className="mt-2.5 border-t border-border/60 pt-2.5">
            <div className="flex flex-nowrap items-center justify-between gap-2 text-[11px] tabular-nums">
              <span className="flex min-w-0 items-center gap-1 text-muted-foreground">
                <span>x =</span>
                <InlineNumberInput
                  value={
                    reaction.xMaxMol < 0.5 ? projected.xMol * 1000 : projected.xMol
                  }
                  onChange={(v) =>
                    onChangeExtent(reaction.xMaxMol < 0.5 ? v / 1000 : v)
                  }
                  min={0}
                  max={reaction.xMaxMol < 0.5 ? reaction.xMaxMol * 1000 : reaction.xMaxMol}
                  step={reaction.xMaxMol < 0.5 ? 0.1 : 0.01}
                  decimals={reaction.xMaxMol < 0.5 ? 2 : 3}
                  unit={reaction.xMaxMol < 0.5 ? 'mmol' : 'mol'}
                  inputWidthClass="w-[5.5ch]"
                  ariaLabel="Avancement de la réaction x"
                />
              </span>
              <span className="shrink-0 whitespace-nowrap text-muted-foreground">
                <ChemVar base="x" sub="max" /> = {formatMol(reaction.xMaxMol)} ·{' '}
                <span className="inline-block w-[4.5ch] text-right text-zinc-300">
                  {pct} %
                </span>
              </span>
            </div>

            <Slider
              min={0}
              max={reaction.xMaxMol}
              step={Math.max(1e-7, reaction.xMaxMol / 100)}
              snapPoints={snapPoints}
              value={projected.xMol}
              onChange={onChangeExtent}
              ariaLabel="Avancement de la réaction x"
              className="mt-1"
            />

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <div>
                {canBalance && onBalanceStoichiometry && (
                  <button
                    type="button"
                    onClick={onBalanceStoichiometry}
                    title="Ajuster les réactifs aux proportions stœchiométriques"
                    className="shrink-0 whitespace-nowrap rounded-md px-2 py-1 text-[10.5px] font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                  >
                    Stœchiométrie
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={projected.xMol <= 1e-8}
                onClick={onCommit}
                title="Valider l’état transformé pour enchaîner d’autres réactions"
                className={cn(
                  'h-7 shrink-0 whitespace-nowrap rounded-md px-3 text-[11px] font-medium',
                  projected.xMol > 1e-8
                    ? 'bg-zinc-100 text-zinc-950 hover:bg-white'
                    : 'text-muted-foreground/45',
                )}
              >
                Appliquer
              </button>
            </div>
          </div>

          {isCanvas && solution && (
            <div className="mt-2.5 space-y-1 border-t border-border/60 pt-2 text-[10px]">
              {/* Live beaker state at current x: reserve line whenever solids/gas can form or spectators exist */}
              {(projected.solidSpecies.length > 0 ||
                projected.gasProduced.length > 0 ||
                spectatorSpecies.length > 0 ||
                reaction.products.some((p) => p.state === 'solid' || p.state === 'gas')) && (
                <div className="flex min-h-[16px] flex-wrap items-center gap-x-2 gap-y-0.5 tabular-nums text-muted-foreground">
                  <span className="shrink-0 font-medium text-zinc-300">Dans le bécher :</span>
                  {projected.solidSpecies.length === 0 &&
                    projected.gasProduced.length === 0 &&
                    spectatorSpecies.length === 0 && (
                      <span className="text-muted-foreground/70">
                        aucun produit formé (x = 0)
                      </span>
                    )}
                  {projected.solidSpecies.map((s) => (
                    <span
                      key={`cs-${s.speciesId}`}
                      className="inline-flex items-center gap-1 text-foreground"
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full border border-white/15"
                        style={{ backgroundColor: s.colorHex ?? '#d4d4d8' }}
                      />
                      <ChemFormula value={s.displayFormula} state="s" />
                      <span className="inline-block min-w-[5.5ch] text-right text-zinc-400">
                        {formatMassG(s.massG)}
                      </span>
                    </span>
                  ))}
                  {projected.gasProduced.map((g) => (
                    <span
                      key={`cg-${g.speciesId}`}
                      className="inline-flex items-baseline gap-1 text-foreground"
                    >
                      ↑<ChemFormula value={g.displayFormula} state="g" />
                      <span className="inline-block min-w-[6ch] text-right text-zinc-400">
                        {formatVolumeMl(g.volumeMl)}
                      </span>
                    </span>
                  ))}
                  {spectatorSpecies.length > 0 && (
                    <span className="inline-flex items-baseline gap-1 text-muted-foreground">
                      <span className="font-sans text-[9.5px]">spectateurs :</span>
                      {spectatorSpecies.slice(0, 4).map((sp, i) => (
                        <span key={sp.speciesId}>
                          {i > 0 && ', '}
                          <ChemFormula value={sp.displayFormula} />
                        </span>
                      ))}
                      {spectatorSpecies.length > 4 && `+${spectatorSpecies.length - 4}`}
                    </span>
                  )}
                </div>
              )}

              {/* Raw user inputs reminder */}
              <div className="flex items-baseline justify-between gap-2 text-muted-foreground">
                <span className="shrink-0">Ajouts</span>
                <span className="truncate text-[9.5px] tabular-nums text-zinc-400">
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
            </div>
          )}

          {!isCanvas && (
            <ReactionStoichiometryTable
              reactantBars={reactantBars}
              productBars={productBars}
              observationsFr={reaction.observationsFr}
            />
          )}
        </>
      )}
    </div>
  )
}
