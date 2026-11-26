import { type PointerEvent as ReactPointerEvent, memo, useMemo } from 'react'
import { ArrowUpRight, Droplets, Link2, RotateCcw, X } from 'lucide-react'
import type {
  CanvasAtomNode,
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasMoleculeNode,
  CanvasSolidNode,
  CanvasThermalChamberNode,
} from '../../../shared/chemistry.ts'
import {
  CATEGORY_META,
  formatCapacityMl,
  formatFrNumber,
  formatMassG,
  formatMol,
  formatSpeciesQuantityBadge,
  formatVolumeMl,
} from '@/lib/chemistry-ui'
import { projectFlaskStateAtExtent } from '@/lib/flask-reaction-ui'
import {
  getCollectedGasTotalMol,
  getCollectedGasVolumeMl,
  getDominantGasColor,
  getMoleculeEffectivePhase,
  getPhaseContextualNameFr,
} from '@/lib/phase-changes'
import { getSolidTotalMassG } from '@/lib/solid-alloys'
import { cn } from '@/lib/utils'
import { ChemFormula, ChemText, StateTag } from '@/components/ui/chem-text'
import {
  GasCollectorArtwork,
  SpeciesPhaseGlyph,
  ThermalChamberArtwork,
} from '@/components/MachineArtwork'
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
          'relative flex h-14 w-14 flex-col items-center justify-center rounded-full border bg-card shadow-md',
          selected
            ? 'border-zinc-200 ring-2 ring-zinc-200/25'
            : 'border-border hover:border-zinc-500',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
        style={{
          backgroundImage:
            'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.10), transparent 64%)',
        }}
      >
        <span className="text-[8.5px] leading-none tabular-nums text-muted-foreground">
          {node.atomicNumber}
        </span>
        <span className="mt-0.5 text-[15px] font-semibold leading-none tracking-tight text-foreground">
          {node.symbol}
        </span>
        <span
          className="mt-1 h-1 w-3.5 rounded-full"
          style={{ backgroundColor: catMeta.accentHex }}
        />
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
  const effectivePhase = getMoleculeEffectivePhase(node)
  const displayName = isIon ? sp.nameFr : getPhaseContextualNameFr(sp, effectivePhase)
  const glyphColor =
    sp.solutionColorHex ?? sp.colorHex ?? (sp.isSolvent ? '#bae6fd' : null)
  const qtyLabel = formatSpeciesQuantityBadge(sp, node.amountMol)
  const showTemp =
    !isIon &&
    typeof node.temperatureC === 'number' &&
    Math.abs(node.temperatureC - 20) >= 2
  const tempTone =
    (node.temperatureC ?? 20) < 5
      ? 'text-sky-300'
      : (node.temperatureC ?? 20) > 80
        ? 'text-orange-300'
        : 'text-muted-foreground'

  const shapeClass = isIon
    ? 'rounded-xl border border-zinc-700/90 bg-panel/95 px-2.5 py-2'
    : effectivePhase === 'gas'
      ? 'rounded-full border border-dashed border-zinc-500/80 bg-card/75 px-3.5 py-2 backdrop-blur-[2px]'
      : effectivePhase === 'liquid'
        ? 'rounded-2xl border border-border bg-card px-3 py-2'
        : 'rounded-md border border-zinc-700/90 border-b-2 border-b-zinc-600/85 bg-card px-2.5 py-2'

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
          'relative flex min-w-[184px] items-center gap-2.5 overflow-hidden shadow-md',
          shapeClass,
          selected
            ? 'border-zinc-200 ring-2 ring-zinc-200/25'
            : 'hover:border-zinc-500',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        <SpeciesPhaseGlyph
          phase={effectivePhase}
          isIon={isIon}
          charge={sp.charge}
          colorHex={glyphColor}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold leading-none tracking-tight text-foreground">
              <ChemFormula value={sp.displayFormula} />
              {!isIon && <StateTag state={effectivePhase} />}
            </span>
            {showTemp && node.temperatureC !== undefined && (
              <span className={cn('shrink-0 text-[9.5px] leading-none tabular-nums', tempTone)}>
                {formatFrNumber(node.temperatureC, 0)} °C
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none">
            <span className="max-w-[112px] truncate text-muted-foreground">
              {displayName}
            </span>
            <span className="inline-block min-w-[50px] shrink-0 whitespace-nowrap text-right text-[9.5px] tabular-nums text-zinc-400">
              {qtyLabel}
            </span>
          </div>
        </div>

        {/* Subtle liquid meniscus strip along the bottom edge */}
        {!isIon && effectivePhase === 'liquid' && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-3 bottom-0 h-[2px] rounded-full opacity-50"
            style={{ backgroundColor: glyphColor ?? '#bae6fd' }}
          />
        )}
      </div>
    </div>
  )
})

export const SolidBlockTile = memo(function SolidBlockTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  dropHovered,
  dropHint,
  setElRef,
  onPointerDown,
}: {
  node: CanvasSolidNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  dropHovered?: boolean
  dropHint?: { text: string; valid: boolean } | null
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
}) {
  const totalMassG = getSolidTotalMassG(node)
  const symbolSummary =
    node.components.length === 1
      ? node.components[0].symbol
      : node.components.map((c) => c.symbol).join('·')
  const displayName = node.isAlloy
    ? node.nameFr
    : node.nameFr.replace(/ métallique$| solide$/, '')

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
          'relative flex min-w-[184px] items-center gap-2.5 rounded-md border border-zinc-700/90 border-b-2 border-b-zinc-600/85 bg-card px-2.5 py-2 shadow-md',
          selected
            ? 'border-zinc-200 ring-2 ring-zinc-200/25'
            : dropHovered
              ? dropHint?.valid
                ? 'border-zinc-300 ring-2 ring-zinc-200/25'
                : 'border-amber-400/80 ring-2 ring-amber-400/25'
              : 'hover:border-zinc-500',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        {dropHovered && dropHint && (
          <div
            className={cn(
              'pointer-events-none absolute -top-3.5 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium shadow-md',
              dropHint.valid ? 'text-zinc-100' : 'text-amber-200',
            )}
          >
            <ChemText value={dropHint.text} />
          </div>
        )}

        <SpeciesPhaseGlyph phase="solid" colorHex={node.colorHex} />

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold leading-none tracking-tight text-foreground">
              <ChemFormula value={symbolSummary} />
              <StateTag state="s" />
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-[10px] leading-none">
            <span className="max-w-[112px] truncate text-muted-foreground">
              <ChemText value={displayName} />
            </span>
            <span className="inline-block min-w-[50px] shrink-0 whitespace-nowrap text-right text-[9.5px] tabular-nums text-zinc-400">
              {formatMassG(totalMassG)}
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
  onStartFilterCakeDrag,
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
  onStartFilterCakeDrag?: (
    e: ReactPointerEvent<HTMLButtonElement>,
    speciesId: string,
  ) => void
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
        {/* Top-left direct transfer handle + compact thermal indicator */}
        <div className="absolute left-2 top-2 flex items-center gap-1">
          {canPourOut && onStartPourDrag && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartPourDrag(e)
              }}
              title="Glisser vers une verrerie (verser) ou une chambre thermique (prélever)"
              aria-label="Verser ou transférer le liquide"
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
            <span className="pointer-events-none ml-0.5 text-[9.5px] leading-tight tabular-nums text-muted-foreground">
              {Math.round(temperatureC)} °C
            </span>
          )}
        </div>

        {/* Direct grab handle for trapped solid on the filter paper */}
        {hasFilterCake && onStartFilterCakeDrag && (
          <button
            type="button"
            onPointerDown={(e) => {
              e.stopPropagation()
              onStartFilterCakeDrag(e, filteredSolids[0].speciesId)
            }}
            title="Glisser pour récupérer le solide filtré (ou cliquer pour extraire)"
            aria-label="Récupérer le solide retenu sur le filtre"
            className="absolute -top-2.5 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-600/90 bg-panel/95 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm hover:border-zinc-400 cursor-grab active:cursor-grabbing"
          >
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: filterCakeColorHex }}
            />
            <ChemFormula value={filteredSolids[0].displayFormula} />
            <StateTag state="s" />
            <ArrowUpRight className="h-2.5 w-2.5 text-muted-foreground" strokeWidth={1.8} />
          </button>
        )}

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
          hasHeadspaceGas={projected.gasProduced.length > 0}
          headspaceGasColorHex={projected.gasProduced[0]?.colorHex ?? null}
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

export const GasCollectorTile = memo(function GasCollectorTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  isCollecting,
  isTransferSource = false,
  dropHovered,
  dropHint,
  setElRef,
  onPointerDown,
  onStartLinkDrag,
  onStartExtractDrag,
  onClear,
  onDelete,
}: {
  node: CanvasGasCollectorNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  isCollecting: boolean
  isTransferSource?: boolean
  dropHovered?: boolean
  dropHint?: { text: string; valid: boolean } | null
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onStartLinkDrag?: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onStartExtractDrag?: (
    e: ReactPointerEvent<HTMLButtonElement>,
    speciesId: string,
  ) => void
  onClear: () => void
  onDelete: () => void
}) {
  const totalVolMl = getCollectedGasVolumeMl(node.gases, node.temperatureC)
  const totalMol = getCollectedGasTotalMol(node.gases)
  const fillRatio = Math.min(1, totalVolMl / Math.max(100, node.capacityMl))
  const gasColor = getDominantGasColor(node.gases)
  const hasGas = node.gases.length > 0

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
      <div
        className={cn(
          'relative flex w-[188px] flex-col items-center rounded-xl border px-3 pb-2.5 pt-3 shadow-md transition-transform duration-150',
          dropHovered
            ? dropHint?.valid === false
              ? 'border-amber-500/75 bg-card/95 ring-2 ring-amber-500/20'
              : 'scale-[1.02] border-sky-400/80 bg-card/95 ring-2 ring-sky-400/20'
            : isTransferSource
              ? 'border-sky-400/70 bg-card/95 ring-2 ring-sky-400/15'
              : selected
                ? 'border-zinc-300 bg-card/90 ring-2 ring-zinc-200/20'
                : 'border-border/80 bg-card/75 hover:border-zinc-600 hover:bg-card/90',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        {/* Top-left direct tubing & gas extraction handles */}
        <div className="absolute left-2 top-2 flex items-center gap-1">
          {onStartLinkDrag && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartLinkDrag(e)
              }}
              title={
                node.sourceFlaskId
                  ? 'Glisser vers une verrerie pour changer, ou cliquer pour débrancher'
                  : 'Glisser vers une verrerie pour raccorder le tuyau'
              }
              aria-label="Raccorder le tuyau à une verrerie"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md border cursor-grab active:cursor-grabbing',
                node.sourceFlaskId
                  ? 'border-sky-400/80 bg-sky-500/15 text-sky-300'
                  : 'border-border/80 bg-panel/90 text-muted-foreground hover:border-zinc-500 hover:text-foreground',
              )}
            >
              <Link2 className="h-3.5 w-3.5" strokeWidth={1.65} />
            </button>
          )}
          {hasGas && onStartExtractDrag && (
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartExtractDrag(e, node.gases[0].speciesId)
              }}
              title="Glisser vers la paillasse, une chambre thermique ou une verrerie (ou cliquer pour extraire)"
              aria-label="Transférer ou extraire le gaz capturé"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md border cursor-grab active:cursor-grabbing',
                isTransferSource
                  ? 'border-sky-400/80 bg-sky-500/15 text-sky-300'
                  : 'border-border/80 bg-panel/90 text-muted-foreground hover:border-zinc-500 hover:text-foreground',
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          )}
        </div>
        {dropHovered && dropHint && (
          <div
            className={cn(
              'pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium shadow-md',
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
          {hasGas && (
            <button
              type="button"
              onClick={onClear}
              title="Purger le collecteur"
              aria-label="Purger le collecteur"
              className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <RotateCcw className="h-3 w-3" strokeWidth={1.6} />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            title="Retirer le collecteur"
            aria-label="Retirer le collecteur"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-red-400"
          >
            <X className="h-3 w-3" strokeWidth={1.6} />
          </button>
        </div>

        <GasCollectorArtwork
          fillRatio={fillRatio}
          gasColorHex={gasColor}
          collecting={isCollecting}
          size="md"
        />

        <div className="mt-1.5 w-full text-center">
          <p className="truncate text-xs font-semibold leading-tight text-foreground">
            {hasGas ? (
              <>
                <ChemFormula value={node.gases[0].displayFormula} />
                <StateTag state="g" />
                {node.gases.length > 1 && (
                  <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                    +{node.gases.length - 1}
                  </span>
                )}
              </>
            ) : (
              node.label || 'Collecteur de gaz'
            )}
          </p>
          <p className="mt-0.5 truncate whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
            {hasGas
              ? `${formatVolumeMl(totalVolMl)} · ${formatMol(totalMol)}`
              : node.sourceFlaskId
                ? 'Raccordé · en attente'
                : 'Vide · glisser sur une verrerie'}
          </p>
        </div>
      </div>
    </div>
  )
})

export const ThermalChamberTile = memo(function ThermalChamberTile({
  node,
  selected,
  shaking,
  fresh,
  altCopy,
  isTransferSource = false,
  dropHovered,
  dropHint,
  setElRef,
  onPointerDown,
  onStartExtractDrag,
  onDelete,
}: {
  node: CanvasThermalChamberNode
  selected: boolean
  shaking: boolean
  fresh: boolean
  altCopy: boolean
  isTransferSource?: boolean
  dropHovered?: boolean
  dropHint?: { text: string; valid: boolean } | null
  setElRef: (id: string, el: HTMLDivElement | null) => void
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void
  onStartExtractDrag?: (e: ReactPointerEvent<HTMLButtonElement>) => void
  onDelete: () => void
}) {
  const sample = node.sample
  const curState = sample?.currentState ?? null
  const tempTone =
    node.temperatureC < 5
      ? 'text-sky-300'
      : node.temperatureC > 80
        ? 'text-orange-300'
        : 'text-foreground'
  const ramping =
    node.powerOn && Math.abs(node.temperatureC - node.targetTemperatureC) >= 1

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
      <div
        className={cn(
          'relative flex w-[192px] flex-col items-center rounded-xl border px-3 pb-2.5 pt-3 shadow-md transition-transform duration-150',
          dropHovered
            ? dropHint?.valid === false
              ? 'border-amber-500/75 bg-card/95 ring-2 ring-amber-500/20'
              : 'scale-[1.02] border-sky-400/80 bg-card/95 ring-2 ring-sky-400/20'
            : isTransferSource
              ? 'border-sky-400/70 bg-card/95 ring-2 ring-sky-400/15'
              : selected
                ? 'border-zinc-300 bg-card/90 ring-2 ring-zinc-200/20'
                : 'border-border/80 bg-card/75 hover:border-zinc-600 hover:bg-card/90',
          shaking && 'animate-dl-shake border-amber-500/70',
          fresh && 'animate-dl-pop',
        )}
      >
        {/* Top-left direct extraction / transfer handle when a sample is inside */}
        {sample && onStartExtractDrag && (
          <div className="absolute left-2 top-2">
            <button
              type="button"
              onPointerDown={(e) => {
                e.stopPropagation()
                onStartExtractDrag(e)
              }}
              title="Glisser vers la paillasse, une verrerie ou un appareil (ou cliquer pour sortir)"
              aria-label="Extraire ou transférer l’échantillon de la chambre"
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-md border cursor-grab active:cursor-grabbing',
                isTransferSource
                  ? 'border-sky-400/80 bg-sky-500/15 text-sky-300'
                  : 'border-border/80 bg-panel/90 text-muted-foreground hover:border-zinc-500 hover:text-foreground',
              )}
            >
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.7} />
            </button>
          </div>
        )}
        {dropHovered && dropHint && (
          <div
            className={cn(
              'pointer-events-none absolute -top-3 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium shadow-md',
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
          <button
            type="button"
            onClick={onDelete}
            title="Retirer la chambre thermique"
            aria-label="Retirer la chambre thermique"
            className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-red-400"
          >
            <X className="h-3 w-3" strokeWidth={1.6} />
          </button>
        </div>

        <ThermalChamberArtwork
          temperatureC={node.temperatureC}
          sampleState={curState}
          sampleColorHex={
            sample?.solidBlock?.colorHex ??
            sample?.species.colorHex ??
            sample?.species.solutionColorHex ??
            '#bae6fd'
          }
          powerOn={node.powerOn}
          size="md"
        />

        <div className="mt-1.5 w-full text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold leading-tight">
            <span className={cn('tabular-nums', tempTone)}>
              {formatFrNumber(node.temperatureC, 0)} °C
            </span>
            {ramping && (
              <span className="text-[10px] font-normal tabular-nums text-muted-foreground">
                → {formatFrNumber(node.targetTemperatureC, 0)} °C
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-[10.5px] leading-snug text-foreground">
            {sample ? (
              <>
                <ChemFormula value={sample.species.displayFormula} />
                <StateTag state={sample.currentState} />{' '}
                <span className="text-muted-foreground">
                  ·{' '}
                  {sample.solidBlock
                    ? sample.solidBlock.nameFr
                    : getPhaseContextualNameFr(sample.species, sample.currentState)}
                </span>
              </>
            ) : (
              <span className="text-muted-foreground">
                Chambre thermique · vide
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
})
