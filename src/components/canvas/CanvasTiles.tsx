import { type PointerEvent as ReactPointerEvent, memo, useMemo } from 'react'
import { Droplets, RotateCcw, X } from 'lucide-react'
import type {
  CanvasAtomNode,
  CanvasFlaskNode,
  CanvasMoleculeNode,
} from '../../../shared/chemistry.ts'
import {
  CATEGORY_META,
  formatCapacityMl,
  formatFrNumber,
  formatSpeciesQuantityBadge,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { projectFlaskStateAtExtent } from '@/lib/flask-reaction-ui'
import { cn } from '@/lib/utils'
import { ChemFormula, ChemText, StateTag } from '@/components/ui/chem-text'
import { ReactionControlCard } from '@/components/ReactionControlCard'
import { VesselArtwork } from '@/components/VesselArtwork'
import { FlaskContentSubcard } from './FlaskContentSubcard'
import { FlaskPourPopover } from './FlaskPourPopover'

export const AtomTile = memo(function AtomTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  setElRef,
  onPointerDown,
}: {
  node: CanvasAtomNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const catMeta = CATEGORY_META[node.category]
  return (
    <div
      ref={(el) => setElRef(node.id, el)}
      data-node-id={node.id}
      onPointerDown={onPointerDown}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -50%)`,
      }}
      className={cn(
        'pointer-events-auto absolute will-change-transform',
        altCopy ? 'cursor-copy' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div
        className={cn(
          'relative flex h-14 w-14 flex-col items-center justify-center rounded-xl border bg-card shadow-md',
          selected
            ? 'border-zinc-200 ring-2 ring-zinc-200/25'
            : 'border-border hover:border-zinc-600',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        <span className="absolute left-1.5 top-1 text-[9px] leading-none tabular-nums text-muted-foreground">
          {node.atomicNumber}
        </span>
        <span
          className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: catMeta.accentHex }}
        />
        <span className="mt-1 text-base font-semibold leading-none tracking-tight text-foreground">
          {node.symbol}
        </span>
        <span className="mt-0.5 max-w-[46px] truncate text-[8.5px] text-muted-foreground">
          {node.nameFr}
        </span>
      </div>
    </div>
  )
})

export const MoleculeTile = memo(function MoleculeTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  setElRef,
  onPointerDown,
}: {
  node: CanvasMoleculeNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const sp = node.species
  const isIon = sp.kind === 'ion'
  const tintDot = sp.solutionColorHex ?? (sp.isSolvent ? '#bae6fd' : null)
  const qtyLabel = formatSpeciesQuantityBadge(sp, node.amountMol)

  return (
    <div
      ref={(el) => setElRef(node.id, el)}
      data-node-id={node.id}
      onPointerDown={onPointerDown}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -50%)`,
      }}
      className={cn(
        'pointer-events-auto absolute will-change-transform',
        altCopy ? 'cursor-copy' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      <div
        className={cn(
          'flex min-w-[172px] items-center gap-2.5 rounded-xl border bg-card px-3 py-2 shadow-md',
          selected
            ? 'border-zinc-200 ring-2 ring-zinc-200/25'
            : 'border-border hover:border-zinc-600',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-1.5">
            {tintDot && (
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: tintDot }}
              />
            )}
            <span className="text-sm font-semibold leading-none tracking-tight text-foreground">
              <ChemFormula value={sp.displayFormula} />
              {!isIon && <StateTag state={sp.standardState} />}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none">
            <span className="max-w-[116px] truncate text-muted-foreground">
              {sp.nameFr}
            </span>
            <span className="inline-block min-w-[54px] shrink-0 whitespace-nowrap text-right text-[9.5px] tabular-nums text-zinc-400">
              {qtyLabel}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
})

export const FlaskTile = memo(function FlaskTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  pulsing,
  dripping = false,
  isPourSource = false,
  pendingPourSource = null,
  dropHovered,
  dropHint,
  setElRef,
  onPointerDown,
  onStartPourDrag,
  onConfirmPour,
  onCancelPour,
  onEmpty,
  onDelete,
  onChangeReactionExtent,
  onSelectReaction,
  onCommitReaction,
  onBalanceStoichiometry,
}: {
  node: CanvasFlaskNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  pulsing: boolean
  dripping?: boolean
  isPourSource?: boolean
  pendingPourSource?: CanvasFlaskNode | null
  dropHovered: boolean
  dropHint: { text: string; valid: boolean } | null
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onStartPourDrag?: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onConfirmPour?: (volumeMl: number) => void
  onCancelPour?: () => void
  onEmpty: () => void
  onDelete: () => void
  onChangeReactionExtent: (xMol: number) => void
  onSelectReaction: (reactionId: string) => void
  onCommitReaction: () => void
  onBalanceStoichiometry?: () => void
}) {
  const { vessel, solution } = node
  const filteredSolids = node.filteredSolids ?? []
  const hasFilterCake = filteredSolids.length > 0
  const filterCakeColorHex = filteredSolids[0]?.colorHex ?? '#e4e4e7'
  const hasContent =
    solution.hasWater || solution.solutes.length > 0 || hasFilterCake
  const canPourOut = solution.hasWater && solution.totalVolumeMl > 0.1
  const temperatureC = node.temperatureC ?? 20
  const probes = node.probes ?? []
  const fillRatio =
    vessel.capacityMl > 0 ? Math.min(1, solution.totalVolumeMl / vessel.capacityMl) : 0
  const immiscibleVisual =
    solution.immisciblePhase && solution.totalVolumeMl > 0
      ? {
          ...solution.immisciblePhase,
          volumeRatio: solution.immisciblePhase.volumeMl / solution.totalVolumeMl,
        }
      : null

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
  const rxn = projected.reaction
  const availableReactions = solution.availableReactions ?? []
  const heatingActive =
    typeof node.heaterTargetC === 'number' && node.heaterTargetC >= 35

  return (
    <div
      ref={(el) => setElRef(node.id, el)}
      data-node-id={node.id}
      onPointerDown={onPointerDown}
      style={{
        left: 0,
        top: 0,
        transform: `translate3d(${node.x}px, ${node.y}px, 0) translate(-50%, -50%)`,
      }}
      className={cn(
        'group pointer-events-auto absolute will-change-transform',
        altCopy ? 'cursor-copy' : 'cursor-grab active:cursor-grabbing',
      )}
    >
      {/* Clean pour slider popover directly above target flask */}
      {pendingPourSource && onConfirmPour && onCancelPour && (
        <div className="absolute bottom-full left-1/2 z-30 flex -translate-x-1/2 flex-col items-center">
          <FlaskPourPopover
            key={`${pendingPourSource.id}->${node.id}`}
            source={pendingPourSource}
            target={node}
            onConfirm={onConfirmPour}
            onCancel={onCancelPour}
          />
          <div className="h-2 w-px bg-zinc-600/80" aria-hidden="true" />
        </div>
      )}

      <div
        className={cn(
          'relative flex w-[216px] flex-col items-center rounded-xl border px-3.5 pb-3 pt-3.5 transition-transform duration-150',
          dropHovered
            ? dropHint?.valid === false
              ? 'border-amber-500/75 bg-card/95 ring-2 ring-amber-500/20'
              : 'scale-[1.02] border-sky-400/80 bg-card/95 ring-2 ring-sky-400/20'
            : isPourSource || pendingPourSource
              ? 'border-sky-400/70 bg-card/95 ring-2 ring-sky-400/15'
              : selected
                ? 'border-zinc-300 bg-card/90 ring-2 ring-zinc-200/20'
                : 'border-border/80 bg-card/75 hover:border-zinc-600 hover:bg-card/90',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        {/* Top-left dedicated drag-to-pour handle + compact thermal indicator */}
        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          {canPourOut && onStartPourDrag && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartPourDrag(e)
              }}
              title="Glisser vers une autre verrerie pour verser"
              aria-label="Glisser vers une autre verrerie pour verser"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md border cursor-grab active:cursor-grabbing',
                isPourSource
                  ? 'border-sky-400/80 bg-sky-500/15 text-sky-300'
                  : 'border-border/80 bg-panel/90 text-muted-foreground hover:border-zinc-500 hover:text-foreground',
              )}
            >
              <Droplets className="h-3.5 w-3.5" strokeWidth={1.65} />
            </button>
          )}
          {temperatureC !== 20 && !probes.includes('thermometer') && (
            <span className="pointer-events-none text-[9.5px] leading-tight tabular-nums text-muted-foreground">
              {Math.round(temperatureC)} °C
            </span>
          )}
        </div>

        {dropHovered && dropHint && (
          <div
            className={cn(
              'pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium shadow-md',
              dropHint.valid ? 'text-zinc-100' : 'text-amber-200',
            )}
          >
            <ChemText value={dropHint.text} />
          </div>
        )}

        <div
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            'absolute right-1.5 top-1.5 flex items-center gap-0.5 transition-opacity duration-150',
            selected
              ? 'opacity-100'
              : 'opacity-0 focus-within:opacity-100 group-hover:opacity-100',
          )}
        >
          {hasContent && (
            <button
              type="button"
              onClick={onEmpty}
              title="Vider la verrerie"
              aria-label="Vider la verrerie"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.6} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Retirer la verrerie"
            aria-label="Retirer la verrerie"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-red-400"
          >
            <X className="h-3 w-3" strokeWidth={1.6} />
          </button>
        </div>

        <VesselArtwork
          vesselType={vessel.vesselType}
          fillRatio={fillRatio}
          liquidColorHex={projected.liquidColorHex}
          liquidOpacity={projected.liquidOpacity}
          immisciblePhase={immiscibleVisual}
          hasSediment={projected.hasUndissolvedSolid}
          sedimentColorHex={projected.sedimentColorHex}
          sedimentRatio={projected.sedimentRatio}
          hasFilter={Boolean(node.hasFilter)}
          hasFilterCake={hasFilterCake}
          filterCakeColorHex={filterCakeColorHex}
          precipitating={projected.isPrecipitating}
          bubbling={pulsing}
          continuousBubbling={projected.evolvingGas}
          temperatureC={temperatureC}
          stirrerOn={node.stirrerOn}
          heatingActive={heatingActive}
          dripping={dripping}
          probes={probes}
          size="md"
        />

        {/* Live digital probe readout strip when probes are immersed */}
        {probes.length > 0 && (
          <div
            className={cn(
              'mt-1 grid w-full gap-x-1.5 gap-y-0.5 border-y border-border/60 py-1 text-center text-[10px] tabular-nums text-zinc-200',
              probes.length === 1 ? 'grid-cols-1' : 'grid-cols-2',
            )}
          >
            {probes.includes('ph') && (
              <span className="whitespace-nowrap">
                pH{' '}
                {solution.hasWater && projected.phEstimate !== null
                  ? formatFrNumber(projected.phEstimate, 2)
                  : '—'}
              </span>
            )}
            {probes.includes('thermometer') && (
              <span className="whitespace-nowrap">{formatFrNumber(temperatureC, 1)} °C</span>
            )}
            {probes.includes('conductimeter') && (
              <span
                className={cn(
                  'whitespace-nowrap',
                  probes.length === 3 && 'col-span-2',
                )}
              >
                {solution.hasWater && projected.conductivityMsCm !== null
                  ? `${formatFrNumber(projected.conductivityMsCm, 2)} mS`
                  : '—'}
              </span>
            )}
          </div>
        )}

        <div className="mt-1.5 w-full text-center">
          {node.customLabel && (
            <p className="mb-0.5 truncate text-[9.5px] font-medium text-zinc-400">
              <ChemText value={node.customLabel} />
            </p>
          )}
          <div className="flex items-center justify-center gap-1">
            <p className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
              <ChemText value={hasContent ? solution.labelFr : vessel.nameFr} />
            </p>
          </div>
          <p className="mt-0.5 truncate whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
            {solution.hasWater
              ? `${formatVolumeMl(solution.totalVolumeMl)} / ${formatCapacityMl(vessel.capacityMl)}${
                  projected.phEstimate !== null && !probes.includes('ph')
                    ? ` · pH ${formatFrNumber(projected.phEstimate, 2)}`
                    : ''
                }`
              : hasContent
                ? `Hors solvant · ${formatCapacityMl(vessel.capacityMl)}`
                : `Vide · ${formatCapacityMl(vessel.capacityMl)}`}
          </p>
        </div>
      </div>

      {rxn ? (
        <div className="absolute left-1/2 top-full z-20 flex -translate-x-1/2 flex-col items-center">
          <div className="h-2 w-px bg-zinc-700/80" aria-hidden="true" />
          <ReactionControlCard
            variant="canvas"
            dataReactionBarId={node.id}
            reaction={rxn}
            availableReactions={availableReactions}
            projected={projected}
            solution={solution}
            onChangeExtent={onChangeReactionExtent}
            onSelectReaction={onSelectReaction}
            onCommit={onCommitReaction}
            onBalanceStoichiometry={onBalanceStoichiometry}
          />
        </div>
      ) : hasContent ? (
        <div className="absolute left-1/2 top-full z-10 flex -translate-x-1/2 flex-col items-center">
          <div className="h-2 w-px bg-zinc-700/80" aria-hidden="true" />
          <FlaskContentSubcard node={node} projected={projected} />
        </div>
      ) : null}
    </div>
  )
})
