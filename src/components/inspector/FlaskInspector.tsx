import { useMemo, useState } from 'react'
import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  FlaskProbeType,
  FullCatalogResponse,
  PhIndicatorId,
} from '../../../shared/chemistry.ts'
import {
  formatCapacityMl,
  formatFrNumber,
  formatMassG,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { projectFlaskStateAtExtent } from '@/lib/flask-reaction-ui'
import { cn } from '@/lib/utils'
import { ChemText } from '@/components/ui/chem-text'
import { VesselArtwork } from '@/components/VesselArtwork'
import { type CatalogJumpTarget, QuickActions } from './InspectorPrimitives'
import { FlaskOverviewTab } from './FlaskOverviewTab'
import { FlaskSettingsTab } from './FlaskSettingsTab'

export function FlaskInspector({
  node,
  otherFlasks,
  gasCollectors,
  catalog,
  onAddWater,
  onResize,
  onSetTemperature,
  onToggleFilter,
  onSetLabel,
  onEvaporate,
  onChangeReactionExtent,
  onSelectReaction,
  onCommitReaction,
  onBalanceStoichiometry,
  onOpenInCatalog,
  onSetIndicator,
  onToggleProbe,
  onToggleStirrer,
  onSetHeaterTarget,
  onLinkGasCollector,
  onOpenTitration,
  onSetSoluteAmount,
  onSetWaterVolume,
  onExtractFilteredSolid,
  onClearFilterCake,
}: {
  node: CanvasFlaskNode
  otherFlasks: CanvasFlaskNode[]
  gasCollectors: CanvasGasCollectorNode[]
  catalog: FullCatalogResponse | null
  onAddWater: (volumeMl: number) => void
  onResize: (newCapacityMl: number) => void
  onSetTemperature: (temperatureC: number) => void
  onToggleFilter: () => void
  onSetLabel: (label: string) => void
  onEvaporate: (volumeMl: number) => void
  onChangeReactionExtent: (xMol: number) => void
  onSelectReaction: (reactionId: string) => void
  onCommitReaction: () => void
  onBalanceStoichiometry?: () => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
  onSetIndicator: (indicatorId: PhIndicatorId | null) => void
  onToggleProbe: (probe: FlaskProbeType) => void
  onToggleStirrer: () => void
  onSetHeaterTarget: (targetC: number | null) => void
  onLinkGasCollector: (collectorId: string | null) => void
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onSetSoluteAmount: (speciesId: string, amountMol: number) => void
  onSetWaterVolume: (volumeMl: number) => void
  onExtractFilteredSolid?: (speciesId: string) => void
  onClearFilterCake?: () => void
}) {
  const { vessel, solution } = node
  const filteredSolids = node.filteredSolids ?? []
  const hasFilterCake = filteredSolids.length > 0
  const filterCakeColorHex = filteredSolids[0]?.colorHex ?? '#e4e4e7'
  const hasContent =
    solution.hasWater || solution.solutes.length > 0 || hasFilterCake
  const immiscibleVisual =
    solution.immisciblePhase && solution.totalVolumeMl > 0
      ? {
          ...solution.immisciblePhase,
          volumeRatio: solution.immisciblePhase.volumeMl / solution.totalVolumeMl,
        }
      : null
  const temperatureC = node.temperatureC ?? 20
  const hasFilter = Boolean(node.hasFilter)

  const projected = useMemo(
    () =>
      projectFlaskStateAtExtent(
        solution,
        node.reactionExtentMol ?? 0,
        node.selectedReactionId,
        node.indicatorId,
        temperatureC,
      ),
    [
      solution,
      node.reactionExtentMol,
      node.selectedReactionId,
      node.indicatorId,
      temperatureC,
    ],
  )
  const activeRxn = projected.reaction
  const availableRxns = solution.availableReactions ?? []

  const [waterInput, setWaterInput] = useState(() =>
    vessel.capacityMl <= 15
      ? '5'
      : vessel.capacityMl <= 30
        ? '10'
        : vessel.capacityMl <= 120
          ? '50'
          : vessel.capacityMl <= 350
            ? '100'
            : '250',
  )

  const fillRatio =
    vessel.capacityMl > 0 ? Math.min(1, solution.totalVolumeMl / vessel.capacityMl) : 0
  const fillPercent = Math.round(fillRatio * 100)
  const remainingMl = Math.max(
    0,
    Math.round((vessel.capacityMl - solution.totalVolumeMl) * 100) / 100,
  )
  const dilutionFactor =
    solution.hasWater && solution.totalVolumeMl > 0.1
      ? vessel.capacityMl / solution.totalVolumeMl
      : null

  const netChargeConc = useMemo(
    () =>
      projected.dissolvedSpecies.reduce(
        (acc, item) => acc + item.charge * item.concentrationMolPerL,
        0,
      ),
    [projected.dissolvedSpecies],
  )

  const matchingReactions = useMemo(() => {
    if (!catalog || solution.dissolvedSpecies.length < 2) return []
    const presentIds = new Set(solution.dissolvedSpecies.map((d) => d.speciesId))
    return catalog.reactions.filter(
      (r) =>
        r.medium === 'aqueous' &&
        r.reactants.every((req) => presentIds.has(req.speciesId)),
    )
  }, [catalog, solution.dissolvedSpecies])

  const submitWater = () => {
    const val = Number.parseFloat(waterInput.replace(',', '.'))
    if (Number.isFinite(val) && val > 0) onAddWater(val)
  }

  const [flaskTab, setFlaskTab] = useState<'content' | 'vessel'>('content')
  const quickWaterSteps =
    vessel.capacityMl <= 30
      ? [5, 10, 20]
      : vessel.capacityMl <= 120
        ? [25, 50, 100]
        : [25, 50, 100, 250]

  const phDisplay =
    projected.phEstimate !== null ? formatFrNumber(projected.phEstimate, 1) : '—'

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-card">
            <VesselArtwork
              vesselType={vessel.vesselType}
              fillRatio={fillRatio}
              liquidColorHex={projected.liquidColorHex}
              liquidOpacity={projected.liquidOpacity}
              immisciblePhase={immiscibleVisual}
              hasSediment={projected.hasUndissolvedSolid}
              sedimentColorHex={projected.sedimentColorHex}
              sedimentRatio={projected.sedimentRatio}
              hasFilter={hasFilter}
              hasFilterCake={hasFilterCake}
              filterCakeColorHex={filterCakeColorHex}
              bubbling={projected.evolvingGas}
              hasHeadspaceGas={projected.gasProduced.length > 0}
              headspaceGasColorHex={projected.gasProduced[0]?.colorHex ?? null}
              temperatureC={temperatureC}
              size="sm"
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              <ChemText
                value={node.customLabel || (hasContent ? solution.labelFr : vessel.nameFr)}
              />
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {vessel.nameFr} ·{' '}
              <span className="whitespace-nowrap tabular-nums">
                {formatCapacityMl(vessel.capacityMl)}
              </span>
              {node.customLabel && hasContent && (
                <>
                  {' '}
                  · <ChemText value={solution.labelFr} />
                </>
              )}
            </p>
            <p className="truncate text-[10px] text-zinc-400">
              {hasFilter ? 'Filtre posé · ' : ''}
              {!solution.hasWater && hasContent ? 'Milieu hors solvant · ' : ''}
              {vessel.precisionLabel}
            </p>
          </div>
        </div>

        <QuickActions
          onOpenCatalog={() =>
            solution.recognizedSolutionId
              ? onOpenInCatalog({
                  section: 'solutions',
                  id: solution.recognizedSolutionId,
                })
              : onOpenInCatalog({ section: 'vessels', id: vessel.id })
          }
        />
      </div>

      <div>
        <dl className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60 py-2.5 text-center">
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Volume</dt>
            <dd className="mt-0.5 truncate text-[11.5px] font-medium tabular-nums text-foreground">
              {hasContent ? formatVolumeMl(solution.totalVolumeMl) : '0 mL'}
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">pH</dt>
            <dd className="mt-0.5 truncate text-[11.5px] font-medium tabular-nums text-foreground">
              {phDisplay}
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Temp.</dt>
            <dd className="mt-0.5 truncate text-[11.5px] font-medium tabular-nums text-foreground">
              {Math.round(temperatureC)} °C
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Masse</dt>
            <dd className="mt-0.5 truncate text-[11.5px] font-medium tabular-nums text-zinc-200">
              {hasContent ? formatMassG(solution.totalMassG) : '0 g'}
            </dd>
          </div>
        </dl>
        <div className="h-[2px] w-full bg-border/60">
          <div
            className="h-full transition-[width] duration-300"
            style={{
              width: `${fillPercent}%`,
              backgroundColor: projected.liquidColorHex ?? '#a1a1aa',
              opacity: Math.max(0.55, projected.liquidOpacity),
            }}
          />
        </div>
      </div>

      <div
        role="tablist"
        aria-label="Sections de la verrerie"
        className="flex gap-5 border-b border-border/70"
      >
        <button
          type="button"
          role="tab"
          aria-selected={flaskTab === 'content'}
          onClick={() => setFlaskTab('content')}
          className={cn(
            'relative -mb-px inline-flex shrink-0 items-center whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            flaskTab === 'content'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <span>Contenu</span>
          <span
            aria-hidden="true"
            className={cn(
              'absolute -right-2.5 top-1 h-1.5 w-1.5 rounded-full bg-zinc-300',
              !activeRxn && 'opacity-0',
            )}
          />
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={flaskTab === 'vessel'}
          onClick={() => setFlaskTab('vessel')}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            flaskTab === 'vessel'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Verrerie
        </button>
      </div>

      {flaskTab === 'content' && (
        <FlaskOverviewTab
          node={node}
          catalog={catalog}
          hasContent={hasContent}
          remainingMl={remainingMl}
          waterInput={waterInput}
          onWaterInputChange={setWaterInput}
          onSubmitWater={submitWater}
          onAddWater={onAddWater}
          quickWaterSteps={quickWaterSteps}
          activeRxn={activeRxn}
          availableRxns={availableRxns}
          projected={projected}
          netChargeConc={netChargeConc}
          matchingReactions={matchingReactions}
          onChangeReactionExtent={onChangeReactionExtent}
          onSelectReaction={onSelectReaction}
          onCommitReaction={onCommitReaction}
          onBalanceStoichiometry={onBalanceStoichiometry}
          onSetSoluteAmount={onSetSoluteAmount}
          onSetWaterVolume={onSetWaterVolume}
          onExtractFilteredSolid={onExtractFilteredSolid}
          onClearFilterCake={onClearFilterCake}
          onOpenInCatalog={onOpenInCatalog}
        />
      )}

      {flaskTab === 'vessel' && (
        <FlaskSettingsTab
          node={node}
          otherFlasks={otherFlasks}
          gasCollectors={gasCollectors}
          hasFilter={hasFilter}
          temperatureC={temperatureC}
          fillPercent={fillPercent}
          remainingMl={remainingMl}
          dilutionFactor={dilutionFactor}
          waterInput={waterInput}
          onWaterInputChange={setWaterInput}
          onSubmitWater={submitWater}
          onAddWater={onAddWater}
          quickWaterSteps={quickWaterSteps}
          onSetLabel={onSetLabel}
          onToggleFilter={onToggleFilter}
          onResize={onResize}
          onSetTemperature={onSetTemperature}
          onEvaporate={onEvaporate}
          onSetIndicator={onSetIndicator}
          onToggleProbe={onToggleProbe}
          onToggleStirrer={onToggleStirrer}
          onSetHeaterTarget={onSetHeaterTarget}
          onLinkGasCollector={onLinkGasCollector}
          onOpenTitration={onOpenTitration}
        />
      )}
    </div>
  )
}
