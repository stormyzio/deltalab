import { useMemo, useState } from 'react'
import { Lock, LockOpen, RotateCcw } from 'lucide-react'
import type {
  CanvasFlaskNode,
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
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { VesselArtwork } from '@/components/VesselArtwork'
import { type CatalogJumpTarget, QuickActions } from './InspectorPrimitives'
import { FlaskOverviewTab } from './FlaskOverviewTab'
import { FlaskActionsTab } from './FlaskActionsTab'
import { FlaskSettingsTab } from './FlaskSettingsTab'

export function FlaskInspector({
  node,
  otherFlasks,
  catalog,
  onAddWater,
  onResize,
  onSetTemperature,
  onToggleStopper,
  onSetLabel,
  onEvaporate,
  onChangeReactionExtent,
  onSelectReaction,
  onCommitReaction,
  onBalanceStoichiometry,
  onEmpty,
  onDuplicate,
  onDelete,
  onOpenInCatalog,
  onSetIndicator,
  onToggleProbe,
  onToggleStirrer,
  onSetHeaterTarget,
  onOpenTitration,
  onSetSoluteAmount,
  onSetWaterVolume,
}: {
  node: CanvasFlaskNode
  otherFlasks: CanvasFlaskNode[]
  catalog: FullCatalogResponse | null
  onAddWater: (volumeMl: number) => void
  onResize: (newCapacityMl: number) => void
  onSetTemperature: (temperatureC: number) => void
  onToggleStopper: () => void
  onSetLabel: (label: string) => void
  onEvaporate: (volumeMl: number) => void
  onChangeReactionExtent: (xMol: number) => void
  onSelectReaction: (reactionId: string) => void
  onCommitReaction: () => void
  onBalanceStoichiometry?: () => void
  onEmpty: () => void
  onDuplicate: () => void
  onDelete: () => void
  onOpenInCatalog: (target: CatalogJumpTarget) => void
  onSetIndicator: (indicatorId: PhIndicatorId | null) => void
  onToggleProbe: (probe: FlaskProbeType) => void
  onToggleStirrer: () => void
  onSetHeaterTarget: (targetC: number | null) => void
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onSetSoluteAmount: (speciesId: string, amountMol: number) => void
  onSetWaterVolume: (volumeMl: number) => void
}) {
  const { vessel, solution } = node
  const hasContent = solution.hasWater || solution.solutes.length > 0
  const temperatureC = node.temperatureC ?? 20
  const stoppered = Boolean(node.stoppered)

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
  const [customCapInput, setCustomCapInput] = useState(String(vessel.capacityMl))

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

  const submitCustomCapacity = () => {
    const val = Number.parseFloat(customCapInput.replace(',', '.'))
    if (Number.isFinite(val) && val >= Math.max(5, solution.totalVolumeMl) && val <= 5000) {
      onResize(Math.round(val))
    }
  }

  const [flaskTab, setFlaskTab] = useState<'content' | 'actions' | 'vessel'>('content')
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
              hasSediment={projected.hasUndissolvedSolid}
              sedimentColorHex={projected.sedimentColorHex}
              sedimentRatio={projected.sedimentRatio}
              bubbling={projected.evolvingGas}
              stoppered={stoppered}
              temperatureC={temperatureC}
              size="sm"
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground">
              {node.customLabel || (hasContent ? solution.labelFr : vessel.nameFr)}
            </h2>
            <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
              {vessel.nameFr} ·{' '}
              <span className="whitespace-nowrap font-mono tabular-nums">
                {formatCapacityMl(vessel.capacityMl)}
              </span>
              {node.customLabel && hasContent ? ` · ${solution.labelFr}` : ''}
            </p>
            <p className="truncate text-[10px] text-zinc-400">
              {stoppered ? 'Bouchée · ' : ''}
              {!solution.hasWater && hasContent ? 'Milieu hors solvant · ' : ''}
              {vessel.precisionLabel}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-0.5">
          {vessel.stopperable && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={stoppered ? 'secondary' : 'ghost'}
                  size="icon-sm"
                  onClick={onToggleStopper}
                  aria-label={stoppered ? 'Retirer le bouchon' : 'Boucher la verrerie'}
                >
                  {stoppered ? (
                    <Lock className="h-3.5 w-3.5 text-zinc-200" strokeWidth={1.6} />
                  ) : (
                    <LockOpen className="h-3.5 w-3.5" strokeWidth={1.6} />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {stoppered ? 'Retirer le bouchon' : 'Poser un bouchon'}
              </TooltipContent>
            </Tooltip>
          )}
          {hasContent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onEmpty}
                  aria-label="Vider la verrerie"
                >
                  <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.6} />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Vider la verrerie</TooltipContent>
            </Tooltip>
          )}
          <QuickActions
            onOpenCatalog={() =>
              solution.recognizedSolutionId
                ? onOpenInCatalog({
                    section: 'solutions',
                    id: solution.recognizedSolutionId,
                  })
                : onOpenInCatalog({ section: 'vessels', id: vessel.id })
            }
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        </div>
      </div>

      <div>
        <dl className="grid grid-cols-4 divide-x divide-border/60 border-t border-border/60 py-2.5 text-center">
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Volume</dt>
            <dd className="mt-0.5 truncate font-mono text-[11.5px] font-medium tabular-nums text-foreground">
              {hasContent ? formatVolumeMl(solution.totalVolumeMl) : '0 mL'}
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">pH</dt>
            <dd className="mt-0.5 truncate font-mono text-[11.5px] font-medium tabular-nums text-foreground">
              {phDisplay}
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Temp.</dt>
            <dd className="mt-0.5 truncate font-mono text-[11.5px] font-medium tabular-nums text-foreground">
              {Math.round(temperatureC)} °C
            </dd>
          </div>
          <div className="min-w-0 px-1.5">
            <dt className="truncate text-[10px] text-muted-foreground">Masse</dt>
            <dd className="mt-0.5 truncate font-mono text-[11.5px] font-medium tabular-nums text-zinc-200">
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
        className="flex gap-5 overflow-x-auto border-b border-border/70"
      >
        <button
          type="button"
          role="tab"
          aria-selected={flaskTab === 'content'}
          onClick={() => setFlaskTab('content')}
          className={cn(
            '-mb-px inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            flaskTab === 'content'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <span>Contenu</span>
          {activeRxn && (
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={flaskTab === 'actions'}
          onClick={() => setFlaskTab('actions')}
          className={cn(
            '-mb-px shrink-0 whitespace-nowrap border-b-2 pb-2 text-[11.5px] font-medium',
            flaskTab === 'actions'
              ? 'border-foreground text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Manipuler
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
          hasContent={hasContent}
          stoppered={stoppered}
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
          onOpenInCatalog={onOpenInCatalog}
        />
      )}

      {flaskTab === 'actions' && (
        <FlaskActionsTab
          node={node}
          otherFlasks={otherFlasks}
          stoppered={stoppered}
          temperatureC={temperatureC}
          remainingMl={remainingMl}
          dilutionFactor={dilutionFactor}
          waterInput={waterInput}
          onWaterInputChange={setWaterInput}
          onSubmitWater={submitWater}
          onAddWater={onAddWater}
          quickWaterSteps={quickWaterSteps}
          onSetTemperature={onSetTemperature}
          onEvaporate={onEvaporate}
          onSetIndicator={onSetIndicator}
          onToggleProbe={onToggleProbe}
          onToggleStirrer={onToggleStirrer}
          onSetHeaterTarget={onSetHeaterTarget}
          onOpenTitration={onOpenTitration}
        />
      )}

      {flaskTab === 'vessel' && (
        <FlaskSettingsTab
          node={node}
          stoppered={stoppered}
          fillPercent={fillPercent}
          customCapInput={customCapInput}
          onCustomCapInputChange={setCustomCapInput}
          onSetLabel={onSetLabel}
          onToggleStopper={onToggleStopper}
          onResize={onResize}
          onSubmitCustomCapacity={submitCustomCapacity}
        />
      )}
    </div>
  )
}
