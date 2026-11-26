import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type {
  AlloyRecord,
  CanvasFlaskNode,
  CanvasNode,
  ElementRecord,
  PhIndicatorId,
  SpeciesRecord,
} from '../../shared/chemistry.ts'
import {
  NODE_HALF_SIZE,
  getFlaskHitTest,
  getGasCollectorHitTest,
  getSolidHitTest,
  getThermalChamberHitTest,
} from '@/lib/canvas-geometry'
import { findTitrationPairs } from '@/lib/titration-engine'
import type { LabPresetDefinition, SavedWorkbenchRecord } from '@/lib/lab-presets'
import { cn } from '@/lib/utils'
import { ChemFormula } from '@/components/ui/chem-text'
import {
  computeCanvasDropHint,
  computeGasCollectorDropHint,
  computeSolidDropHint,
  computeThermalChamberDropHint,
} from '@/components/canvas/canvas-drop-hints'
import {
  CanvasConnectionsLayer,
  type CanvasConnectionsLayerHandle,
} from '@/components/canvas/CanvasConnectionsLayer'
import {
  AtomTile,
  FlaskTile,
  GasCollectorTile,
  MoleculeTile,
  SolidBlockTile,
  ThermalChamberTile,
} from '@/components/canvas/CanvasTiles'
import {
  IsomerPickerDialog,
  type PendingMergeIsomers,
} from '@/components/canvas/IsomerPickerDialog'
import {
  type CanvasNotice,
  CanvasNoticeBanner,
  CanvasSelectionBar,
  CanvasViewportHud,
} from '@/components/canvas/CanvasOverlayChrome'
import { LabPresetsPopover } from '@/components/canvas/LabPresetsPopover'
import {
  TitrationDrawer,
  type TitrationSessionState,
} from '@/components/canvas/TitrationDrawer'

export type { CanvasNotice, PendingMergeIsomers }

export interface ViewportTransform {
  x: number
  y: number
  zoom: number
}

interface LabCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>
  active?: boolean
  hydrated: boolean
  nodes: CanvasNode[]
  elementsBySymbol: Map<string, ElementRecord>
  alloys: AlloyRecord[]
  selectedIds: Set<string>
  viewport: ViewportTransform
  onViewportChange: (next: ViewportTransform) => void
  onSelectIds: (ids: Set<string>) => void
  onMoveNodes: (deltas: Array<{ id: string; x: number; y: number }>) => void
  onDuplicateNodesForDrag: (
    sourceIds: string[],
    dx: number,
    dy: number,
  ) => Map<string, string>
  onMergeSelected: () => void
  onIonizeSelected: (direction: 1 | -1) => void
  canIonizeMinus?: boolean
  canIonizePlus?: boolean
  onDuplicateSelected: () => void
  onDeleteIds: (ids: string[]) => void
  onEmptyFlask: (flaskId: string) => void
  onToggleFlaskFilter?: (flaskId: string) => void
  onDropAtomOnFlask: (atomNodeId: string, flaskId: string) => void
  onDropSolidOnFlask: (solidNodeId: string, flaskId: string) => void
  onDropSolidOnSolid: (draggedId: string, targetSolidId: string) => void
  onConvertAtomToSolid: (atomNodeId: string) => void
  onDropMoleculeOnFlask: (moleculeNodeId: string, flaskId: string) => void
  onDropNodeOnGasCollector: (sourceNodeId: string, collectorId: string) => void
  onDropGasCollectorOnFlask: (collectorId: string, flaskId: string) => void
  onDropNodeOnThermalChamber: (sourceNodeId: string, chamberId: string) => void
  onClearGasCollector: (collectorId: string) => void
  onLinkGasCollectorToFlask: (collectorId: string, flaskId: string | null) => void
  onExtractGasFromCollector: (
    collectorId: string,
    speciesId: string,
    dropPos?: { x: number; y: number },
  ) => void
  onBubbleGasIntoFlask: (collectorId: string, speciesId: string, flaskId: string) => void
  onSendGasToChamber: (collectorId: string, speciesId: string, chamberId: string) => void
  onTransferGasBetweenCollectors: (
    sourceCollectorId: string,
    speciesId: string,
    targetCollectorId: string,
  ) => void
  onExtractSampleFromChamber: (
    chamberId: string,
    dropPos?: { x: number; y: number },
  ) => void
  onTransferChamberSampleToFlask: (chamberId: string, flaskId: string) => void
  onTransferChamberSampleToCollector: (chamberId: string, collectorId: string) => void
  onTransferChamberSampleToChamber: (
    sourceChamberId: string,
    targetChamberId: string,
  ) => void
  onTransferFlaskLiquidToChamber: (flaskId: string, chamberId: string) => void
  onExtractFilteredSolid: (
    flaskId: string,
    speciesId: string,
    dropPos?: { x: number; y: number },
  ) => void
  onTransferFilteredSolidToFlask: (
    sourceFlaskId: string,
    speciesId: string,
    targetFlaskId: string,
  ) => void
  onTransferFilteredSolidToChamber: (
    sourceFlaskId: string,
    speciesId: string,
    chamberId: string,
  ) => void
  onPourBetweenFlasks: (
    sourceFlaskId: string,
    targetFlaskId: string,
    volumeMl: number,
  ) => void
  onChangeFlaskReactionExtent: (flaskId: string, xMol: number) => void
  onSelectFlaskReaction: (flaskId: string, reactionId: string) => void
  onCommitFlaskReaction: (flaskId: string) => void
  onBalanceFlaskStoichiometry?: (flaskId: string) => void
  onResetView: () => void
  onClearCanvas: () => void
  savedWorkbenches: SavedWorkbenchRecord[]
  activeWorkbenchId: string | null
  onLoadPreset: (preset: LabPresetDefinition) => void
  onSaveCurrentWorkbench: (name: string) => void
  onUpdateSavedWorkbench: (id: string) => void
  onRenameSavedWorkbench: (id: string, nextName: string) => void
  onDuplicateSavedWorkbench: (id: string) => void
  onNewWorkbench: () => void
  onLoadSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onDeleteSavedWorkbench: (id: string) => void
  onExportCurrentWorkbench: (customName?: string) => void
  onExportSavedWorkbench: (record: SavedWorkbenchRecord) => void
  onImportWorkbenchFile: (file: File, mode?: 'replace' | 'merge') => void
  externalHoveredFlaskId: string | null
  externalHoverHint: { text: string; valid: boolean } | null
  pulsingFlaskIds: Set<string>
  shakingNodeIds: Set<string>
  freshNodeIds: Set<string>
  notice: CanvasNotice | null
  pendingMergeIsomers: PendingMergeIsomers | null
  onPickMergeIsomer: (species: SpeciesRecord) => void
  onCancelMergeIsomer: () => void
  titrationSession: TitrationSessionState | null
  onOpenTitration: (buretteId?: string, analyteId?: string) => void
  onDispenseTitrationMl: (volumeMl: number) => void
  onToggleTitrationRunning: () => void
  onCycleTitrationSpeed: () => void
  onResetTitrationSession: () => void
  onCloseTitration: () => void
  onSetFlaskIndicator: (flaskId: string, indicatorId: PhIndicatorId | null) => void
}

interface MarqueeState {
  pointerId: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  rafId: number | null
  lastSelectedIds: Set<string>
}

type TransferDragKind =
  | 'pour'
  | 'filter_cake'
  | 'gas_link'
  | 'gas_extract'
  | 'chamber_extract'

interface TransferDragState {
  pointerId: number
  kind: TransferDragKind
  sourceNodeId: string
  speciesId?: string
  startClientX: number
  startClientY: number
  startX: number
  startY: number
  currentX: number
  currentY: number
  hoveredTargetId: string | null
  hoveredTargetKind: 'flask' | 'gas_collector' | 'thermal_chamber' | null
  hoveredHint: { text: string; valid: boolean } | null
  hoveredKey: string | null
  moved: boolean
  rafId: number | null
}

export function LabCanvas({
  canvasRef,
  active = true,
  hydrated,
  nodes,
  elementsBySymbol,
  alloys,
  selectedIds,
  viewport,
  onViewportChange,
  onSelectIds,
  onMoveNodes,
  onDuplicateNodesForDrag,
  onMergeSelected,
  onIonizeSelected,
  canIonizeMinus = true,
  canIonizePlus = true,
  onDuplicateSelected,
  onDeleteIds,
  onEmptyFlask,
  onToggleFlaskFilter,
  onDropAtomOnFlask,
  onDropSolidOnFlask,
  onDropSolidOnSolid,
  onConvertAtomToSolid,
  onDropMoleculeOnFlask,
  onDropNodeOnGasCollector,
  onDropGasCollectorOnFlask,
  onDropNodeOnThermalChamber,
  onClearGasCollector,
  onLinkGasCollectorToFlask,
  onExtractGasFromCollector,
  onBubbleGasIntoFlask,
  onSendGasToChamber,
  onTransferGasBetweenCollectors,
  onExtractSampleFromChamber,
  onTransferChamberSampleToFlask,
  onTransferChamberSampleToCollector,
  onTransferChamberSampleToChamber,
  onTransferFlaskLiquidToChamber,
  onExtractFilteredSolid,
  onTransferFilteredSolidToFlask,
  onTransferFilteredSolidToChamber,
  onPourBetweenFlasks,
  onChangeFlaskReactionExtent,
  onSelectFlaskReaction,
  onCommitFlaskReaction,
  onBalanceFlaskStoichiometry,
  onResetView,
  onClearCanvas,
  savedWorkbenches,
  activeWorkbenchId,
  onLoadPreset,
  onSaveCurrentWorkbench,
  onUpdateSavedWorkbench,
  onRenameSavedWorkbench,
  onDuplicateSavedWorkbench,
  onNewWorkbench,
  onLoadSavedWorkbench,
  onDeleteSavedWorkbench,
  onExportCurrentWorkbench,
  onExportSavedWorkbench,
  onImportWorkbenchFile,
  externalHoveredFlaskId,
  externalHoverHint,
  pulsingFlaskIds,
  shakingNodeIds,
  freshNodeIds,
  notice,
  pendingMergeIsomers,
  onPickMergeIsomer,
  onCancelMergeIsomer,
  titrationSession,
  onOpenTitration,
  onDispenseTitrationMl,
  onToggleTitrationRunning,
  onCycleTitrationSpeed,
  onResetTitrationSession,
  onCloseTitration,
  onSetFlaskIndicator,
}: LabCanvasProps) {
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select')
  const [spacePressed, setSpacePressed] = useState(false)
  const [altPressed, setAltPressed] = useState(false)
  const [isPanning, setIsPanning] = useState(false)
  const [marqueeActive, setMarqueeActive] = useState(false)
  const [internalHoveredFlaskId, setInternalHoveredFlaskId] = useState<string | null>(
    null,
  )
  const [internalHoverHint, setInternalHoverHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)
  const [hoveredSolidId, setHoveredSolidId] = useState<string | null>(null)
  const [hoveredSolidHint, setHoveredSolidHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)
  const [hoveredCollectorId, setHoveredCollectorId] = useState<string | null>(null)
  const [hoveredCollectorHint, setHoveredCollectorHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)
  const [hoveredChamberId, setHoveredChamberId] = useState<string | null>(null)
  const [hoveredChamberHint, setHoveredChamberHint] = useState<{
    text: string
    valid: boolean
  } | null>(null)
  const [transferActive, setTransferActive] = useState<{
    kind: TransferDragKind
    sourceNodeId: string
    startX: number
    startY: number
    currentX: number
    currentY: number
    hoveredTargetId: string | null
    hoveredTargetKind: 'flask' | 'gas_collector' | 'thermal_chamber' | null
    hoveredHint: { text: string; valid: boolean } | null
    moved: boolean
  } | null>(null)
  const [pendingPour, setPendingPour] = useState<{
    sourceFlaskId: string
    targetFlaskId: string
  } | null>(null)

  const worldLayerRef = useRef<HTMLDivElement | null>(null)
  const marqueeElRef = useRef<HTMLDivElement | null>(null)
  const marqueeStateRef = useRef<MarqueeState | null>(null)
  const transferDragRef = useRef<TransferDragState | null>(null)
  const pourPathRef = useRef<SVGPathElement | null>(null)
  const pourTipRef = useRef<SVGCircleElement | null>(null)
  const transferTipLabelRef = useRef<HTMLDivElement | null>(null)
  const connectionsLayerRef = useRef<CanvasConnectionsLayerHandle | null>(null)
  const nodeElMapRef = useRef<Map<string, HTMLDivElement>>(new Map())
  const viewportRef = useRef<ViewportTransform>(viewport)
  useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  const setNodeElRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      nodeElMapRef.current.set(id, el)
    } else {
      const existing = nodeElMapRef.current.get(id)
      if (existing && !existing.isConnected) {
        nodeElMapRef.current.delete(id)
      }
    }
  }, [])

  const panStateRef = useRef<{
    pointerId: number
    startClientX: number
    startClientY: number
    originX: number
    originY: number
    currentX: number
    currentY: number
    rafId: number | null
  } | null>(null)

  const wheelCommitTimerRef = useRef<number | null>(null)
  const pendingWheelViewportRef = useRef<ViewportTransform | null>(null)

  const hoveredFlaskKeyRef = useRef<string | null>(null)
  const hoveredSolidKeyRef = useRef<string | null>(null)
  const hoveredCollectorKeyRef = useRef<string | null>(null)
  const hoveredChamberKeyRef = useRef<string | null>(null)

  const dragNodesRef = useRef<{
    pointerId: number
    primaryNodeId: string
    sourcePrimaryNodeId: string
    primaryKind: CanvasNode['kind']
    startClientX: number
    startClientY: number
    origins: Map<string, { x: number; y: number }>
    lastUpdates: Array<{ id: string; x: number; y: number }>
    rafId: number | null
    moved: boolean
    duplicateOnDrag: boolean
    duplicated: boolean
  } | null>(null)

  useEffect(() => {
    return () => {
      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
      if (panStateRef.current?.rafId != null) cancelAnimationFrame(panStateRef.current.rafId)
      if (dragNodesRef.current?.rafId != null) cancelAnimationFrame(dragNodesRef.current.rafId)
      if (marqueeStateRef.current?.rafId != null) {
        cancelAnimationFrame(marqueeStateRef.current.rafId)
      }
      if (transferDragRef.current?.rafId != null) {
        cancelAnimationFrame(transferDragRef.current.rafId)
      }
    }
  }, [])

  // Spacebar temporary pan mode & Alt duplicate-drag cursor hint
  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') {
        setAltPressed(true)
      }
      if (
        e.code === 'Space' &&
        document.activeElement?.tagName !== 'INPUT' &&
        document.activeElement?.tagName !== 'TEXTAREA'
      ) {
        e.preventDefault()
        setSpacePressed(true)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(false)
      if (e.code === 'Space') setSpacePressed(false)
    }
    const onBlur = () => {
      setAltPressed(false)
      setSpacePressed(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [active])

  const clientToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      const vp = viewportRef.current
      return {
        x: (clientX - rect.left - vp.x) / vp.zoom,
        y: (clientY - rect.top - vp.y) / vp.zoom,
      }
    },
    [canvasRef],
  )

  // Non-passive native wheel listener with direct GPU transform + rAF-coalesced React commit
  useEffect(() => {
    const el = canvasRef.current
    if (!el || !active) return

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const vp = pendingWheelViewportRef.current ?? viewportRef.current

      const pointerX = e.clientX - rect.left
      const pointerY = e.clientY - rect.top
      const factor = Math.exp(-e.deltaY * 0.0014)
      const nextZoom = Math.max(0.45, Math.min(2.2, vp.zoom * factor))
      const ratio = nextZoom / vp.zoom
      const nextVp: ViewportTransform = {
        zoom: nextZoom,
        x: pointerX - (pointerX - vp.x) * ratio,
        y: pointerY - (pointerY - vp.y) * ratio,
      }
      pendingWheelViewportRef.current = nextVp
      viewportRef.current = nextVp

      // Immediate GPU transform update without waiting for React
      if (worldLayerRef.current) {
        worldLayerRef.current.style.transform = `translate3d(${nextVp.x}px, ${nextVp.y}px, 0) scale(${nextVp.zoom})`
      }
      const nextDot = Math.max(14, 24 * nextVp.zoom)
      el.style.backgroundSize = `${nextDot}px ${nextDot}px`
      el.style.backgroundPosition = `${nextVp.x}px ${nextVp.y}px`

      if (wheelCommitTimerRef.current !== null) {
        window.clearTimeout(wheelCommitTimerRef.current)
      }
      wheelCommitTimerRef.current = window.setTimeout(() => {
        wheelCommitTimerRef.current = null
        const committed = pendingWheelViewportRef.current
        pendingWheelViewportRef.current = null
        if (committed) onViewportChange(committed)
      }, 90)
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [active, canvasRef, onViewportChange])

  const handleCanvasPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button === 1 || toolMode === 'pan' || spacePressed) {
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      setIsPanning(true)
      const vp = viewportRef.current
      panStateRef.current = {
        pointerId: e.pointerId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        originX: vp.x,
        originY: vp.y,
        currentX: vp.x,
        currentY: vp.y,
        rafId: null,
      }
      return
    }

    if (e.button !== 0) return
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return

    setPendingPour(null)
    const initialSelected = e.shiftKey ? new Set(selectedIds) : new Set<string>()
    if (!e.shiftKey && selectedIds.size > 0) {
      onSelectIds(new Set())
    }

    e.currentTarget.setPointerCapture(e.pointerId)
    const sx = e.clientX - rect.left
    const sy = e.clientY - rect.top
    marqueeStateRef.current = {
      pointerId: e.pointerId,
      startX: sx,
      startY: sy,
      currentX: sx,
      currentY: sy,
      rafId: null,
      lastSelectedIds: initialSelected,
    }
    setMarqueeActive(true)
  }

  const handleStartTransferDrag = useCallback(
    (
      e: ReactPointerEvent<HTMLButtonElement>,
      kind: TransferDragKind,
      sourceNodeId: string,
      speciesId?: string,
    ) => {
      if (e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      setPendingPour(null)
      canvasRef.current?.setPointerCapture(e.pointerId)
      const worldPt = clientToWorld(e.clientX, e.clientY)
      transferDragRef.current = {
        pointerId: e.pointerId,
        kind,
        sourceNodeId,
        speciesId,
        startClientX: e.clientX,
        startClientY: e.clientY,
        startX: worldPt.x,
        startY: worldPt.y,
        currentX: worldPt.x,
        currentY: worldPt.y,
        hoveredTargetId: null,
        hoveredTargetKind: null,
        hoveredHint: null,
        hoveredKey: null,
        moved: false,
        rafId: null,
      }
      setTransferActive({
        kind,
        sourceNodeId,
        startX: worldPt.x,
        startY: worldPt.y,
        currentX: worldPt.x,
        currentY: worldPt.y,
        hoveredTargetId: null,
        hoveredTargetKind: null,
        hoveredHint: null,
        moved: false,
      })
    },
    [canvasRef, clientToWorld],
  )

  const handleCanvasPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (transferDragRef.current) {
      const td = transferDragRef.current
      if (td.pointerId !== e.pointerId) return
      const worldPt = clientToWorld(e.clientX, e.clientY)
      td.currentX = worldPt.x
      td.currentY = worldPt.y
      if (!td.moved && Math.hypot(e.clientX - td.startClientX, e.clientY - td.startClientY) > 6) {
        td.moved = true
      }

      // Direct 120fps DOM update of the live curved transfer wire without React re-renders
      if (td.rafId === null) {
        td.rafId = requestAnimationFrame(() => {
          td.rafId = null
          const mx = (td.startX + td.currentX) * 0.5
          const arcLift = Math.min(
            64,
            Math.max(
              18,
              Math.hypot(td.currentX - td.startX, td.currentY - td.startY) * 0.22,
            ),
          )
          const my = Math.min(td.startY, td.currentY) - arcLift
          if (pourPathRef.current) {
            pourPathRef.current.setAttribute(
              'd',
              `M ${td.startX} ${td.startY} Q ${mx} ${my} ${td.currentX} ${td.currentY}`,
            )
          }
          if (pourTipRef.current) {
            pourTipRef.current.setAttribute('cx', String(td.currentX))
            pourTipRef.current.setAttribute('cy', String(td.currentY))
          }
          if (transferTipLabelRef.current) {
            transferTipLabelRef.current.style.transform = `translate3d(${td.currentX}px, ${td.currentY - 14}px, 0) translate(-50%, -100%)`
          }
        })
      }

      const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, td.sourceNodeId)
      const targetCollector = !targetFlask
        ? getGasCollectorHitTest(nodes, worldPt.x, worldPt.y, td.sourceNodeId)
        : null
      const targetChamber =
        !targetFlask && !targetCollector
          ? getThermalChamberHitTest(nodes, worldPt.x, worldPt.y, td.sourceNodeId)
          : null

      let hoveredTargetId: string | null = null
      let hoveredTargetKind: 'flask' | 'gas_collector' | 'thermal_chamber' | null = null
      let hoveredHint: { text: string; valid: boolean } | null = null

      if (td.kind === 'pour') {
        if (targetFlask) {
          hoveredTargetId = targetFlask.id
          hoveredTargetKind = 'flask'
          if (targetFlask.vessel.capacityMl - targetFlask.solution.totalVolumeMl <= 0.1) {
            hoveredHint = { text: 'Verrerie pleine', valid: false }
          } else {
            const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
            hoveredHint = { text: `Verser dans ${targetName}`, valid: true }
          }
        } else if (targetChamber) {
          hoveredTargetId = targetChamber.id
          hoveredTargetKind = 'thermal_chamber'
          hoveredHint = { text: 'Prélever liquide vers la chambre', valid: true }
        }
      } else if (td.kind === 'gas_link') {
        if (targetFlask) {
          hoveredTargetId = targetFlask.id
          hoveredTargetKind = 'flask'
          const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
          hoveredHint = { text: `Raccorder tuyau ← ${targetName}`, valid: true }
        }
      } else if (td.kind === 'filter_cake') {
        if (targetFlask) {
          hoveredTargetId = targetFlask.id
          hoveredTargetKind = 'flask'
          const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
          hoveredHint = { text: `Transférer solide → ${targetName}`, valid: true }
        } else if (targetChamber) {
          hoveredTargetId = targetChamber.id
          hoveredTargetKind = 'thermal_chamber'
          hoveredHint = { text: 'Placer le solide dans la chambre', valid: true }
        }
      } else if (td.kind === 'gas_extract') {
        if (targetChamber) {
          hoveredTargetId = targetChamber.id
          hoveredTargetKind = 'thermal_chamber'
          hoveredHint = { text: 'Transférer le gaz dans la chambre', valid: true }
        } else if (targetFlask) {
          hoveredTargetId = targetFlask.id
          hoveredTargetKind = 'flask'
          const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
          hoveredHint = { text: `Injecter le gaz dans ${targetName}`, valid: true }
        } else if (targetCollector) {
          hoveredTargetId = targetCollector.id
          hoveredTargetKind = 'gas_collector'
          hoveredHint = { text: 'Transvaser vers ce collecteur', valid: true }
        }
      } else if (td.kind === 'chamber_extract') {
        const srcChamber = nodes.find(
          (n) => n.kind === 'thermal_chamber' && n.id === td.sourceNodeId,
        )
        const sampleState =
          srcChamber?.kind === 'thermal_chamber' ? srcChamber.sample?.currentState : null
        if (targetFlask) {
          hoveredTargetId = targetFlask.id
          hoveredTargetKind = 'flask'
          const targetName = targetFlask.customLabel || targetFlask.vessel.nameFr
          hoveredHint = { text: `Transférer dans ${targetName}`, valid: true }
        } else if (targetCollector) {
          hoveredTargetId = targetCollector.id
          hoveredTargetKind = 'gas_collector'
          hoveredHint =
            sampleState === 'gas'
              ? { text: 'Capturer le gaz dans le collecteur', valid: true }
              : { text: 'L’échantillon n’est pas gazeux', valid: false }
        } else if (targetChamber) {
          hoveredTargetId = targetChamber.id
          hoveredTargetKind = 'thermal_chamber'
          hoveredHint = { text: 'Transférer dans cette chambre', valid: true }
        }
      }

      const nextKey = `${td.moved ? '1' : '0'}|${hoveredTargetId ?? ''}|${hoveredHint?.text ?? ''}|${hoveredHint?.valid ?? ''}`
      if (td.hoveredKey !== nextKey) {
        td.hoveredKey = nextKey
        td.hoveredTargetId = hoveredTargetId
        td.hoveredTargetKind = hoveredTargetKind
        td.hoveredHint = hoveredHint
        setTransferActive({
          kind: td.kind,
          sourceNodeId: td.sourceNodeId,
          startX: td.startX,
          startY: td.startY,
          currentX: td.currentX,
          currentY: td.currentY,
          hoveredTargetId: td.hoveredTargetId,
          hoveredTargetKind: td.hoveredTargetKind,
          hoveredHint: td.hoveredHint,
          moved: td.moved,
        })
      }
      return
    }
    if (panStateRef.current) {
      const pan = panStateRef.current
      pan.currentX = pan.originX + (e.clientX - pan.startClientX)
      pan.currentY = pan.originY + (e.clientY - pan.startClientY)
      if (pan.rafId === null) {
        pan.rafId = requestAnimationFrame(() => {
          pan.rafId = null
          const vp = viewportRef.current
          const nextVp = { ...vp, x: pan.currentX, y: pan.currentY }
          viewportRef.current = nextVp
          if (worldLayerRef.current) {
            worldLayerRef.current.style.transform = `translate3d(${nextVp.x}px, ${nextVp.y}px, 0) scale(${nextVp.zoom})`
          }
          if (canvasRef.current) {
            canvasRef.current.style.backgroundPosition = `${nextVp.x}px ${nextVp.y}px`
          }
        })
      }
      return
    }

    if (marqueeStateRef.current) {
      const mq = marqueeStateRef.current
      if (mq.pointerId !== e.pointerId) return
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      mq.currentX = e.clientX - rect.left
      mq.currentY = e.clientY - rect.top

      // Direct GPU marquee box update + selection diffing (zero React re-renders when selection is unchanged!)
      if (mq.rafId === null) {
        mq.rafId = requestAnimationFrame(() => {
          mq.rafId = null
          const left = Math.min(mq.startX, mq.currentX)
          const top = Math.min(mq.startY, mq.currentY)
          const width = Math.abs(mq.currentX - mq.startX)
          const height = Math.abs(mq.currentY - mq.startY)
          if (marqueeElRef.current) {
            marqueeElRef.current.style.transform = `translate3d(${left}px, ${top}px, 0)`
            marqueeElRef.current.style.width = `${width}px`
            marqueeElRef.current.style.height = `${height}px`
          }

          const vp = viewportRef.current
          const minX = (left - vp.x) / vp.zoom
          const maxX = (left + width - vp.x) / vp.zoom
          const minY = (top - vp.y) / vp.zoom
          const maxY = (top + height - vp.y) / vp.zoom

          const nextSelected = new Set<string>()
          for (const node of nodes) {
            const { hw, hh } = NODE_HALF_SIZE[node.kind]
            if (
              node.x + hw >= minX &&
              node.x - hw <= maxX &&
              node.y + hh >= minY &&
              node.y - hh <= maxY
            ) {
              nextSelected.add(node.id)
            }
          }

          const prev = mq.lastSelectedIds
          let changed = nextSelected.size !== prev.size
          if (!changed) {
            for (const id of nextSelected) {
              if (!prev.has(id)) {
                changed = true
                break
              }
            }
          }
          if (changed) {
            mq.lastSelectedIds = nextSelected
            onSelectIds(nextSelected)
          }
        })
      }
      return
    }

    if (dragNodesRef.current) {
      const drag = dragNodesRef.current
      const dxScreen = e.clientX - drag.startClientX
      const dyScreen = e.clientY - drag.startClientY
      if (!drag.moved && Math.hypot(dxScreen, dyScreen) < 3) return
      const isFirstMove = !drag.moved
      drag.moved = true

      const vp = viewportRef.current
      const dxWorld = dxScreen / vp.zoom
      const dyWorld = dyScreen / vp.zoom

      if (isFirstMove && (drag.duplicateOnDrag || e.altKey) && !drag.duplicated) {
        drag.duplicated = true
        const idMap = onDuplicateNodesForDrag([...drag.origins.keys()], dxWorld, dyWorld)
        if (idMap.size > 0) {
          const nextOrigins = new Map<string, { x: number; y: number }>()
          const initialUpdates: Array<{ id: string; x: number; y: number }> = []
          for (const [oldId, orig] of drag.origins.entries()) {
            const newId = idMap.get(oldId) ?? oldId
            nextOrigins.set(newId, orig)
            initialUpdates.push({ id: newId, x: orig.x + dxWorld, y: orig.y + dyWorld })
          }
          drag.origins = nextOrigins
          drag.lastUpdates = initialUpdates
          drag.primaryNodeId = idMap.get(drag.primaryNodeId) ?? drag.primaryNodeId
        }
      } else {
        const updates: Array<{ id: string; x: number; y: number }> = []
        for (const [id, orig] of drag.origins.entries()) {
          updates.push({ id, x: orig.x + dxWorld, y: orig.y + dyWorld })
        }
        drag.lastUpdates = updates

        // Zero-React-render GPU transform update via DOM refs
        if (drag.rafId === null) {
          drag.rafId = requestAnimationFrame(() => {
            drag.rafId = null
            for (const u of drag.lastUpdates) {
              const el = nodeElMapRef.current.get(u.id)
              if (el) {
                el.style.transform = `translate3d(${u.x}px, ${u.y}px, 0) translate(-50%, -50%)`
                el.style.zIndex = '15'
              }
            }
            connectionsLayerRef.current?.syncLivePositions(drag.lastUpdates)
          })
        }
      }

      // Check flask, solid, gas collector, or thermal chamber drop target when dragging a single node
      if (drag.origins.size === 1) {
        const worldPt = clientToWorld(e.clientX, e.clientY)
        const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
        const targetSolid =
          !targetFlask && (drag.primaryKind === 'solid' || drag.primaryKind === 'atom')
            ? getSolidHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null
        const targetCollector =
          !targetFlask &&
          !targetSolid &&
          (drag.primaryKind === 'molecule' || drag.primaryKind === 'flask')
            ? getGasCollectorHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null
        const targetChamber =
          !targetFlask &&
          !targetSolid &&
          !targetCollector &&
          (drag.primaryKind === 'molecule' ||
            drag.primaryKind === 'solid' ||
            drag.primaryKind === 'gas_collector')
            ? getThermalChamberHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null
        const draggedNode =
          nodes.find((n) => n.id === drag.primaryNodeId) ??
          nodes.find((n) => n.id === drag.sourcePrimaryNodeId)

        const canDropOnTarget =
          targetFlask &&
          (drag.primaryKind === 'atom' ||
            drag.primaryKind === 'molecule' ||
            drag.primaryKind === 'solid' ||
            drag.primaryKind === 'gas_collector' ||
            (drag.primaryKind === 'flask' &&
              Boolean(targetFlask.hasFilter) &&
              draggedNode?.kind === 'flask' &&
              (draggedNode.solution.hasWater ||
                draggedNode.solution.solutes.length > 0)))

        if (canDropOnTarget && targetFlask) {
          const nextHint =
            drag.primaryKind === 'flask' && draggedNode?.kind === 'flask'
              ? { text: 'Filtrer dans le filtre', valid: true }
              : computeCanvasDropHint(draggedNode, targetFlask, elementsBySymbol)

          const key = `${targetFlask.id}|${nextHint?.text ?? ''}|${nextHint?.valid ?? ''}`
          if (hoveredFlaskKeyRef.current !== key) {
            hoveredFlaskKeyRef.current = key
            setInternalHoveredFlaskId(targetFlask.id)
            setInternalHoverHint(nextHint)
          }
        } else if (hoveredFlaskKeyRef.current !== null) {
          hoveredFlaskKeyRef.current = null
          setInternalHoveredFlaskId(null)
          setInternalHoverHint(null)
        }

        if (targetSolid && draggedNode) {
          const nextHint = computeSolidDropHint(
            draggedNode,
            targetSolid,
            alloys,
            elementsBySymbol,
          )
          const key = nextHint
            ? `${targetSolid.id}|${nextHint.text}|${nextHint.valid}`
            : null
          if (hoveredSolidKeyRef.current !== key) {
            hoveredSolidKeyRef.current = key
            setHoveredSolidId(nextHint ? targetSolid.id : null)
            setHoveredSolidHint(nextHint)
          }
        } else if (hoveredSolidKeyRef.current !== null) {
          hoveredSolidKeyRef.current = null
          setHoveredSolidId(null)
          setHoveredSolidHint(null)
        }

        if (targetCollector && draggedNode) {
          const nextHint = computeGasCollectorDropHint(draggedNode, targetCollector)
          const key = nextHint
            ? `${targetCollector.id}|${nextHint.text}|${nextHint.valid}`
            : null
          if (hoveredCollectorKeyRef.current !== key) {
            hoveredCollectorKeyRef.current = key
            setHoveredCollectorId(nextHint ? targetCollector.id : null)
            setHoveredCollectorHint(nextHint)
          }
        } else if (hoveredCollectorKeyRef.current !== null) {
          hoveredCollectorKeyRef.current = null
          setHoveredCollectorId(null)
          setHoveredCollectorHint(null)
        }

        if (targetChamber && draggedNode) {
          const nextHint = computeThermalChamberDropHint(draggedNode, targetChamber)
          const key = nextHint
            ? `${targetChamber.id}|${nextHint.text}|${nextHint.valid}`
            : null
          if (hoveredChamberKeyRef.current !== key) {
            hoveredChamberKeyRef.current = key
            setHoveredChamberId(nextHint ? targetChamber.id : null)
            setHoveredChamberHint(nextHint)
          }
        } else if (hoveredChamberKeyRef.current !== null) {
          hoveredChamberKeyRef.current = null
          setHoveredChamberId(null)
          setHoveredChamberHint(null)
        }
      }
    }
  }

  const handleCanvasPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (transferDragRef.current) {
      const td = transferDragRef.current
      transferDragRef.current = null
      if (td.rafId !== null) cancelAnimationFrame(td.rafId)
      setTransferActive(null)
      if (canvasRef.current?.hasPointerCapture(e.pointerId)) {
        canvasRef.current.releasePointerCapture(e.pointerId)
      }

      const worldPt = clientToWorld(e.clientX, e.clientY)

      if (!td.moved) {
        // Simple click without dragging: quick action per handle type
        if (td.kind === 'filter_cake' && td.speciesId) {
          onExtractFilteredSolid(td.sourceNodeId, td.speciesId)
        } else if (td.kind === 'gas_extract' && td.speciesId) {
          onExtractGasFromCollector(td.sourceNodeId, td.speciesId)
        } else if (td.kind === 'chamber_extract') {
          onExtractSampleFromChamber(td.sourceNodeId)
        } else if (td.kind === 'gas_link') {
          const col = nodes.find(
            (n) => n.kind === 'gas_collector' && n.id === td.sourceNodeId,
          )
          if (col?.kind === 'gas_collector' && col.sourceFlaskId) {
            onLinkGasCollectorToFlask(col.id, null)
          }
        }
        return
      }

      if (td.hoveredTargetId && td.hoveredHint?.valid) {
        if (td.kind === 'pour') {
          if (td.hoveredTargetKind === 'flask') {
            setPendingPour({
              sourceFlaskId: td.sourceNodeId,
              targetFlaskId: td.hoveredTargetId,
            })
          } else if (td.hoveredTargetKind === 'thermal_chamber') {
            onTransferFlaskLiquidToChamber(td.sourceNodeId, td.hoveredTargetId)
          }
        } else if (td.kind === 'gas_link' && td.hoveredTargetKind === 'flask') {
          onLinkGasCollectorToFlask(td.sourceNodeId, td.hoveredTargetId)
        } else if (td.kind === 'filter_cake' && td.speciesId) {
          if (td.hoveredTargetKind === 'flask') {
            onTransferFilteredSolidToFlask(
              td.sourceNodeId,
              td.speciesId,
              td.hoveredTargetId,
            )
          } else if (td.hoveredTargetKind === 'thermal_chamber') {
            onTransferFilteredSolidToChamber(
              td.sourceNodeId,
              td.speciesId,
              td.hoveredTargetId,
            )
          }
        } else if (td.kind === 'gas_extract' && td.speciesId) {
          if (td.hoveredTargetKind === 'thermal_chamber') {
            onSendGasToChamber(td.sourceNodeId, td.speciesId, td.hoveredTargetId)
          } else if (td.hoveredTargetKind === 'flask') {
            onBubbleGasIntoFlask(td.sourceNodeId, td.speciesId, td.hoveredTargetId)
          } else if (td.hoveredTargetKind === 'gas_collector') {
            onTransferGasBetweenCollectors(
              td.sourceNodeId,
              td.speciesId,
              td.hoveredTargetId,
            )
          }
        } else if (td.kind === 'chamber_extract') {
          if (td.hoveredTargetKind === 'flask') {
            onTransferChamberSampleToFlask(td.sourceNodeId, td.hoveredTargetId)
          } else if (td.hoveredTargetKind === 'gas_collector') {
            onTransferChamberSampleToCollector(td.sourceNodeId, td.hoveredTargetId)
          } else if (td.hoveredTargetKind === 'thermal_chamber') {
            onTransferChamberSampleToChamber(td.sourceNodeId, td.hoveredTargetId)
          }
        }
        return
      }

      // Dropped onto open workbench space for extractable handles -> spawn exactly at drop point!
      if (!td.hoveredTargetId) {
        if (td.kind === 'filter_cake' && td.speciesId) {
          onExtractFilteredSolid(td.sourceNodeId, td.speciesId, worldPt)
        } else if (td.kind === 'gas_extract' && td.speciesId) {
          onExtractGasFromCollector(td.sourceNodeId, td.speciesId, worldPt)
        } else if (td.kind === 'chamber_extract') {
          onExtractSampleFromChamber(td.sourceNodeId, worldPt)
        }
      }
      return
    }
    if (panStateRef.current) {
      const pan = panStateRef.current
      panStateRef.current = null
      if (pan.rafId !== null) cancelAnimationFrame(pan.rafId)
      setIsPanning(false)
      const vp = viewportRef.current
      onViewportChange({ ...vp, x: pan.currentX, y: pan.currentY })
      return
    }
    if (marqueeStateRef.current) {
      const mq = marqueeStateRef.current
      marqueeStateRef.current = null
      if (mq.rafId !== null) cancelAnimationFrame(mq.rafId)
      setMarqueeActive(false)
      return
    }
    if (dragNodesRef.current) {
      const drag = dragNodesRef.current
      dragNodesRef.current = null
      if (drag.rafId !== null) cancelAnimationFrame(drag.rafId)

      for (const u of drag.lastUpdates) {
        const el = nodeElMapRef.current.get(u.id)
        if (el) el.style.zIndex = ''
      }

      let droppedOnTarget = false
      if (drag.moved && drag.origins.size === 1) {
        const worldPt = clientToWorld(e.clientX, e.clientY)
        const targetFlask = getFlaskHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
        const targetSolid =
          !targetFlask && (drag.primaryKind === 'solid' || drag.primaryKind === 'atom')
            ? getSolidHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null
        const targetCollector =
          !targetFlask &&
          !targetSolid &&
          (drag.primaryKind === 'molecule' || drag.primaryKind === 'flask')
            ? getGasCollectorHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null
        const targetChamber =
          !targetFlask &&
          !targetSolid &&
          !targetCollector &&
          (drag.primaryKind === 'molecule' ||
            drag.primaryKind === 'solid' ||
            drag.primaryKind === 'gas_collector')
            ? getThermalChamberHitTest(nodes, worldPt.x, worldPt.y, drag.primaryNodeId)
            : null

        const snapPrimaryBack = () => {
          const origin = drag.origins.get(drag.primaryNodeId)
          const el = nodeElMapRef.current.get(drag.primaryNodeId)
          if (origin && el) {
            el.style.transform = `translate3d(${origin.x}px, ${origin.y}px, 0) translate(-50%, -50%)`
          }
          connectionsLayerRef.current?.syncLivePositions()
        }

        if (
          targetFlask &&
          (drag.primaryKind === 'atom' ||
            drag.primaryKind === 'molecule' ||
            drag.primaryKind === 'solid')
        ) {
          droppedOnTarget = true
          if (drag.lastUpdates.length > 0) {
            onMoveNodes(drag.lastUpdates)
          }
          if (drag.primaryKind === 'atom') {
            onDropAtomOnFlask(drag.primaryNodeId, targetFlask.id)
          } else if (drag.primaryKind === 'solid') {
            onDropSolidOnFlask(drag.primaryNodeId, targetFlask.id)
          } else if (drag.primaryKind === 'molecule') {
            onDropMoleculeOnFlask(drag.primaryNodeId, targetFlask.id)
          }
        } else if (targetFlask && drag.primaryKind === 'gas_collector') {
          droppedOnTarget = true
          snapPrimaryBack()
          onDropGasCollectorOnFlask(drag.primaryNodeId, targetFlask.id)
        } else if (targetSolid) {
          droppedOnTarget = true
          onDropSolidOnSolid(drag.primaryNodeId, targetSolid.id)
        } else if (targetCollector) {
          droppedOnTarget = true
          if (drag.primaryKind === 'flask') {
            snapPrimaryBack()
          }
          onDropNodeOnGasCollector(drag.primaryNodeId, targetCollector.id)
        } else if (targetChamber) {
          droppedOnTarget = true
          if (drag.primaryKind === 'gas_collector') {
            snapPrimaryBack()
          }
          onDropNodeOnThermalChamber(drag.primaryNodeId, targetChamber.id)
        } else if (
          targetFlask &&
          drag.primaryKind === 'flask' &&
          Boolean(targetFlask.hasFilter)
        ) {
          const srcNode = nodes.find(
            (n): n is CanvasFlaskNode => n.kind === 'flask' && n.id === drag.primaryNodeId,
          )
          if (srcNode && (srcNode.solution.hasWater || srcNode.solution.solutes.length > 0)) {
            droppedOnTarget = true
            snapPrimaryBack()
            onPourBetweenFlasks(
              drag.primaryNodeId,
              targetFlask.id,
              Math.max(0.1, srcNode.solution.totalVolumeMl),
            )
          }
        }
      }

      if (drag.moved && !droppedOnTarget && drag.lastUpdates.length > 0) {
        onMoveNodes(drag.lastUpdates)
      }

      if (hoveredFlaskKeyRef.current !== null) {
        hoveredFlaskKeyRef.current = null
        setInternalHoveredFlaskId(null)
        setInternalHoverHint(null)
      }
      if (hoveredSolidKeyRef.current !== null) {
        hoveredSolidKeyRef.current = null
        setHoveredSolidId(null)
        setHoveredSolidHint(null)
      }
      if (hoveredCollectorKeyRef.current !== null) {
        hoveredCollectorKeyRef.current = null
        setHoveredCollectorId(null)
        setHoveredCollectorHint(null)
      }
      if (hoveredChamberKeyRef.current !== null) {
        hoveredChamberKeyRef.current = null
        setHoveredChamberId(null)
        setHoveredChamberHint(null)
      }
    }
  }

  const handleNodePointerDown = (
    e: ReactPointerEvent<HTMLDivElement>,
    node: CanvasNode,
  ) => {
    if (e.button === 1 || toolMode === 'pan' || spacePressed) return
    e.stopPropagation()

    let nextSelection: Set<string>
    if (e.shiftKey || e.metaKey || e.ctrlKey) {
      nextSelection = new Set(selectedIds)
      if (nextSelection.has(node.id)) {
        nextSelection.delete(node.id)
      } else {
        nextSelection.add(node.id)
      }
      onSelectIds(nextSelection)
    } else if (!selectedIds.has(node.id)) {
      nextSelection = new Set([node.id])
      onSelectIds(nextSelection)
    } else {
      nextSelection = selectedIds
    }

    const origins = new Map<string, { x: number; y: number }>()
    const moveSet = nextSelection.has(node.id) ? nextSelection : new Set([node.id])
    for (const n of nodes) {
      if (moveSet.has(n.id)) {
        origins.set(n.id, { x: n.x, y: n.y })
      }
    }

    canvasRef.current?.setPointerCapture(e.pointerId)
    dragNodesRef.current = {
      pointerId: e.pointerId,
      primaryNodeId: node.id,
      sourcePrimaryNodeId: node.id,
      primaryKind: node.kind,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origins,
      lastUpdates: [],
      rafId: null,
      moved: false,
      duplicateOnDrag: e.altKey,
      duplicated: false,
    }
  }

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedIds.has(n.id)),
    [nodes, selectedIds],
  )

  const canIonizeSelected =
    selectedNodes.length >= 1 &&
    selectedNodes.every((n) => n.kind === 'atom' || n.kind === 'molecule')

  const isSolidAlloyMerge =
    selectedNodes.length >= 2 &&
    selectedNodes.some((n) => n.kind === 'solid') &&
    selectedNodes.every(
      (n) =>
        n.kind === 'solid' ||
        (n.kind === 'atom' && elementsBySymbol.get(n.symbol)?.defaultState === 'solid'),
    )

  const canMergeSelected =
    isSolidAlloyMerge ||
    (selectedNodes.length >= 2 &&
      selectedNodes.every((n) => n.kind === 'atom' || n.kind === 'molecule'))

  const singleSolidAtom =
    selectedNodes.length === 1 &&
    selectedNodes[0].kind === 'atom' &&
    elementsBySymbol.get(selectedNodes[0].symbol)?.defaultState === 'solid'
      ? selectedNodes[0]
      : null

  const selectedChargeSum = useMemo(() => {
    let sum = 0
    for (const n of selectedNodes) {
      if (n.kind === 'molecule') sum += n.species.charge
    }
    return sum
  }, [selectedNodes])

  const zoomStep = (delta: number) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const cx = rect.width / 2
    const cy = rect.height / 2
    const nextZoom = Math.max(0.45, Math.min(2.2, Number((viewport.zoom + delta).toFixed(2))))
    const ratio = nextZoom / viewport.zoom
    onViewportChange({
      zoom: nextZoom,
      x: cx - (cx - viewport.x) * ratio,
      y: cy - (cy - viewport.y) * ratio,
    })
  }

  const [fileDropActive, setFileDropActive] = useState(false)

  const handleCanvasDragOver = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.types.includes('Files')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    if (!fileDropActive) setFileDropActive(true)
  }

  const handleCanvasDragLeave = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!fileDropActive) return
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setFileDropActive(false)
  }

  const handleCanvasDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return
    e.preventDefault()
    setFileDropActive(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      onImportWorkbenchFile(file, e.shiftKey ? 'merge' : 'replace')
    }
  }

  const dotSpacing = Math.max(14, 24 * viewport.zoom)
  const activeHoveredFlaskId = externalHoveredFlaskId ?? internalHoveredFlaskId
  const activeHoverHint = externalHoveredFlaskId ? externalHoverHint : internalHoverHint

  return (
    <div
      ref={canvasRef}
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerUp}
      onDragOver={handleCanvasDragOver}
      onDragLeave={handleCanvasDragLeave}
      onDrop={handleCanvasDrop}
      className={cn(
        'relative flex-1 overflow-hidden bg-background select-none touch-none',
        isPanning
          ? 'cursor-grabbing'
          : toolMode === 'pan' || spacePressed
            ? 'cursor-grab'
            : 'cursor-default',
      )}
      style={{
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.085) 1px, transparent 1px)',
        backgroundSize: `${dotSpacing}px ${dotSpacing}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
    >
      {/* File drop overlay for .deltalab.json workbench imports */}
      {fileDropActive && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-[2px]">
          <div className="rounded-xl border border-dashed border-zinc-400/70 bg-panel/95 px-6 py-4 text-center shadow-xl">
            <p className="text-sm font-medium text-foreground">
              Déposer pour importer la paillasse
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Fichier .deltalab.json · Maintenez Maj pour fusionner
            </p>
          </div>
        </div>
      )}
      {/* Quiet onboarding empty state (disappears when first item lands) */}
      {hydrated && nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="flex max-w-xs flex-col items-center text-center">
            <p className="text-xs font-medium text-zinc-300">
              Paillasse prête
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Glissez des atomes depuis le tableau périodique, sélectionnez-les pour les fusionner, puis versez <ChemFormula value="H2O" /> et vos solutés dans une fiole.
            </p>
          </div>
        </div>
      )}

      {/* World transform layer (GPU-accelerated) */}
      <div
        ref={worldLayerRef}
        className="pointer-events-none absolute inset-0 origin-top-left will-change-transform"
        style={{
          transform: `translate3d(${viewport.x}px, ${viewport.y}px, 0) scale(${viewport.zoom})`,
        }}
      >
        <CanvasConnectionsLayer
          ref={connectionsLayerRef}
          nodes={nodes}
          nodeElMapRef={nodeElMapRef}
        />

        {nodes.map((node) => {
          const isSelected = selectedIds.has(node.id)
          const isShaking = shakingNodeIds.has(node.id)
          const isFresh = freshNodeIds.has(node.id)

          if (node.kind === 'atom') {
            return (
              <AtomTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
              />
            )
          }

          if (node.kind === 'molecule') {
            return (
              <MoleculeTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
              />
            )
          }

          if (node.kind === 'solid') {
            return (
              <SolidBlockTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                dropHovered={hoveredSolidId === node.id}
                dropHint={hoveredSolidId === node.id ? hoveredSolidHint : null}
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
              />
            )
          }

          if (node.kind === 'gas_collector') {
            const linkedFlask = node.sourceFlaskId
              ? nodes.find(
                  (n): n is CanvasFlaskNode =>
                    n.kind === 'flask' && n.id === node.sourceFlaskId,
                )
              : null
            const isCollecting =
              Boolean(linkedFlask) &&
              typeof linkedFlask?.heaterTargetC === 'number' &&
              (linkedFlask.temperatureC ?? 20) >= 55
            const isTransferHovered = transferActive?.hoveredTargetId === node.id
            return (
              <GasCollectorTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                isCollecting={isCollecting}
                isTransferSource={transferActive?.sourceNodeId === node.id}
                dropHovered={hoveredCollectorId === node.id || isTransferHovered}
                dropHint={
                  isTransferHovered
                    ? transferActive.hoveredHint
                    : hoveredCollectorId === node.id
                      ? hoveredCollectorHint
                      : null
                }
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onStartLinkDrag={(e) =>
                  handleStartTransferDrag(e, 'gas_link', node.id)
                }
                onStartExtractDrag={(e, spId) =>
                  handleStartTransferDrag(e, 'gas_extract', node.id, spId)
                }
                onClear={() => onClearGasCollector(node.id)}
                onDelete={() => onDeleteIds([node.id])}
              />
            )
          }

          if (node.kind === 'thermal_chamber') {
            const isTransferHovered = transferActive?.hoveredTargetId === node.id
            return (
              <ThermalChamberTile
                key={node.id}
                node={node}
                selected={isSelected}
                shaking={isShaking}
                fresh={isFresh}
                altCopy={altPressed && toolMode === 'select' && !spacePressed}
                isTransferSource={transferActive?.sourceNodeId === node.id}
                dropHovered={hoveredChamberId === node.id || isTransferHovered}
                dropHint={
                  isTransferHovered
                    ? transferActive.hoveredHint
                    : hoveredChamberId === node.id
                      ? hoveredChamberHint
                      : null
                }
                setElRef={setNodeElRef}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onStartExtractDrag={(e) =>
                  handleStartTransferDrag(e, 'chamber_extract', node.id)
                }
                onDelete={() => onDeleteIds([node.id])}
              />
            )
          }

          const pendingPourSource =
            pendingPour && pendingPour.targetFlaskId === node.id
              ? (nodes.find(
                  (n): n is CanvasFlaskNode =>
                    n.kind === 'flask' && n.id === pendingPour.sourceFlaskId,
                ) ?? null)
              : null
          const isTransferHovered = transferActive?.hoveredTargetId === node.id
          const effectiveDropHovered = activeHoveredFlaskId === node.id || isTransferHovered
          const effectiveDropHint = isTransferHovered
            ? transferActive.hoveredHint
            : activeHoveredFlaskId === node.id
              ? activeHoverHint
              : null

          return (
            <FlaskTile
              key={node.id}
              node={node}
              selected={isSelected}
              shaking={isShaking}
              fresh={isFresh}
              altCopy={altPressed && toolMode === 'select' && !spacePressed}
              pulsing={pulsingFlaskIds.has(node.id)}
              dripping={Boolean(
                titrationSession?.running && titrationSession.buretteId === node.id,
              )}
              isPourSource={
                (transferActive?.kind === 'pour' &&
                  transferActive.sourceNodeId === node.id) ||
                pendingPour?.sourceFlaskId === node.id
              }
              pendingPourSource={pendingPourSource}
              dropHovered={effectiveDropHovered}
              dropHint={effectiveDropHint}
              setElRef={setNodeElRef}
              onPointerDown={(e) => handleNodePointerDown(e, node)}
              onStartPourDrag={(e) => handleStartTransferDrag(e, 'pour', node.id)}
              onStartFilterCakeDrag={(e, spId) =>
                handleStartTransferDrag(e, 'filter_cake', node.id, spId)
              }
              onConfirmPour={(volumeMl) => {
                if (pendingPourSource) {
                  onPourBetweenFlasks(pendingPourSource.id, node.id, volumeMl)
                }
                setPendingPour(null)
              }}
              onCancelPour={() => setPendingPour(null)}
              onEmpty={() => onEmptyFlask(node.id)}
              onDelete={() => onDeleteIds([node.id])}
              onChangeReactionExtent={(xMol) =>
                onChangeFlaskReactionExtent(node.id, xMol)
              }
              onSelectReaction={(rxnId) => onSelectFlaskReaction(node.id, rxnId)}
              onCommitReaction={() => onCommitFlaskReaction(node.id)}
              onBalanceStoichiometry={
                onBalanceFlaskStoichiometry
                  ? () => onBalanceFlaskStoichiometry(node.id)
                  : undefined
              }
            />
          )
        })}

        {/* Live transfer / tubing connector curve (DOM-driven at 120fps) */}
        {transferActive && (
          <>
            <svg
              aria-hidden="true"
              className="pointer-events-none absolute left-0 top-0 overflow-visible"
              width="1"
              height="1"
            >
              {(() => {
                const stroke =
                  transferActive.hoveredHint && !transferActive.hoveredHint.valid
                    ? '#f59e0b'
                    : '#38bdf8'
                const sx = transferActive.startX
                const sy = transferActive.startY
                const cx = transferActive.currentX
                const cy = transferActive.currentY
                const mx = (sx + cx) * 0.5
                const arcLift = Math.min(
                  64,
                  Math.max(18, Math.hypot(cx - sx, cy - sy) * 0.22),
                )
                const my = Math.min(sy, cy) - arcLift
                return (
                  <g>
                    <path
                      ref={pourPathRef}
                      d={`M ${sx} ${sy} Q ${mx} ${my} ${cx} ${cy}`}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="2"
                      strokeDasharray="5 4"
                      strokeLinecap="round"
                    />
                    <circle cx={sx} cy={sy} r="3.5" fill={stroke} />
                    <circle ref={pourTipRef} cx={cx} cy={cy} r="4.5" fill={stroke} />
                  </g>
                )
              })()}
            </svg>
            {transferActive.moved &&
              !transferActive.hoveredTargetId &&
              (transferActive.kind === 'filter_cake' ||
                transferActive.kind === 'gas_extract' ||
                transferActive.kind === 'chamber_extract') && (
                <div
                  ref={transferTipLabelRef}
                  className="pointer-events-none absolute left-0 top-0 z-30 whitespace-nowrap rounded-md border border-border bg-zinc-950/95 px-2 py-0.5 text-[10px] font-medium text-zinc-100 shadow-md will-change-transform"
                  style={{
                    transform: `translate3d(${transferActive.currentX}px, ${transferActive.currentY - 14}px, 0) translate(-50%, -100%)`,
                  }}
                >
                  Déposer ici
                </div>
              )}
          </>
        )}
      </div>

      {/* Marquee selection rectangle (DOM-driven at 120fps, zero React re-renders) */}
      {marqueeActive && (
        <div
          ref={marqueeElRef}
          className="pointer-events-none absolute left-0 top-0 rounded-sm border border-zinc-400/70 bg-zinc-400/10 will-change-transform"
          style={{ width: 0, height: 0 }}
        />
      )}

      {/* Contextual floating action bar for selected nodes */}
      {selectedNodes.length > 0 && (() => {
        const singleSelectedFlask =
          selectedNodes.length === 1 && selectedNodes[0].kind === 'flask'
            ? selectedNodes[0]
            : null
        const singleFlaskMeta = singleSelectedFlask
          ? {
              hasFilter: Boolean(singleSelectedFlask.hasFilter),
              hasContent:
                singleSelectedFlask.solution.hasWater ||
                singleSelectedFlask.solution.solutes.length > 0 ||
                (singleSelectedFlask.filteredSolids?.length ?? 0) > 0,
            }
          : null
        return (
          <CanvasSelectionBar
            selectedCount={selectedNodes.length}
            canMergeSelected={canMergeSelected}
            mergeLabel={isSolidAlloyMerge ? 'Allier' : 'Fusionner'}
            canIonizeSelected={canIonizeSelected}
            canIonizeMinus={canIonizeMinus}
            canIonizePlus={canIonizePlus}
            selectedChargeSum={selectedChargeSum}
            canConvertSolidAtom={Boolean(singleSolidAtom)}
            onConvertSolidAtom={
              singleSolidAtom ? () => onConvertAtomToSolid(singleSolidAtom.id) : undefined
            }
            selectedFlask={singleFlaskMeta}
            onToggleFlaskFilter={
              singleSelectedFlask && onToggleFlaskFilter
                ? () => onToggleFlaskFilter(singleSelectedFlask.id)
                : undefined
            }
            onEmptyFlask={
              singleSelectedFlask
                ? () => onEmptyFlask(singleSelectedFlask.id)
                : undefined
            }
            onMergeSelected={onMergeSelected}
            onIonizeSelected={onIonizeSelected}
            onDuplicateSelected={onDuplicateSelected}
            onDeleteSelected={() => onDeleteIds([...selectedIds])}
          />
        )
      })()}

      {/* Floating constitutional isomer picker on multi-match merge */}
      {pendingMergeIsomers && (
        <IsomerPickerDialog
          key={`${pendingMergeIsomers.compositionFormula}:${pendingMergeIsomers.candidates.length}`}
          pending={pendingMergeIsomers}
          onPick={onPickMergeIsomer}
          onCancel={onCancelMergeIsomer}
        />
      )}

      {/* Non-intrusive chemistry status feedback */}
      {notice && (
        <CanvasNoticeBanner
          notice={notice}
          offsetBelowSelectionBar={selectedNodes.length > 0}
        />
      )}

      {/* Floating top-right TP & Paillasses control */}
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="pointer-events-auto absolute right-3 top-3 z-20 rounded-lg border border-border bg-panel/95 p-0.5 shadow-lg"
      >
        <LabPresetsPopover
          savedWorkbenches={savedWorkbenches}
          activeWorkbenchId={activeWorkbenchId}
          currentNodes={nodes}
          onLoadPreset={onLoadPreset}
          onSaveCurrentWorkbench={onSaveCurrentWorkbench}
          onUpdateSavedWorkbench={onUpdateSavedWorkbench}
          onRenameSavedWorkbench={onRenameSavedWorkbench}
          onDuplicateSavedWorkbench={onDuplicateSavedWorkbench}
          onNewWorkbench={onNewWorkbench}
          onLoadSavedWorkbench={onLoadSavedWorkbench}
          onDeleteSavedWorkbench={onDeleteSavedWorkbench}
          onExportCurrentWorkbench={onExportCurrentWorkbench}
          onExportSavedWorkbench={onExportSavedWorkbench}
          onImportWorkbenchFile={onImportWorkbenchFile}
        />
      </div>

      {/* Minimalist floating bottom-left viewport toolbar */}
      <CanvasViewportHud
        toolMode={toolMode}
        spacePressed={spacePressed}
        zoom={viewport.zoom}
        nodeCount={nodes.length}
        onSetToolMode={setToolMode}
        onZoomStep={zoomStep}
        onResetView={onResetView}
        onClearCanvas={onClearCanvas}
      />

      {/* Interactive titration console or quick reopen button */}
      {(() => {
        const flasks = nodes.filter(
          (n): n is CanvasFlaskNode => n.kind === 'flask',
        )
        const { burettes, analytes } = findTitrationPairs(flasks)
        if (titrationSession) {
          const b = flasks.find((f) => f.id === titrationSession.buretteId) ?? null
          const a = flasks.find((f) => f.id === titrationSession.analyteId) ?? null
          if (!b || !a) return null
          return (
            <TitrationDrawer
              session={titrationSession}
              burettes={burettes}
              analytes={analytes}
              burette={b}
              analyte={a}
              onChangePair={(bId, aId) => onOpenTitration(bId, aId)}
              onDispenseMl={onDispenseTitrationMl}
              onToggleRunning={onToggleTitrationRunning}
              onCycleSpeed={onCycleTitrationSpeed}
              onResetSession={onResetTitrationSession}
              onSetAnalyteIndicator={(ind) => onSetFlaskIndicator(a.id, ind)}
              onClose={onCloseTitration}
            />
          )
        }
        if (burettes.length > 0 && analytes.length > 0) {
          return (
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="pointer-events-auto absolute bottom-3 right-3 z-20"
            >
              <button
                type="button"
                onClick={() => onOpenTitration()}
                className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-panel/95 px-3 text-xs font-medium text-foreground shadow-lg hover:bg-accent"
              >
                <span>Suivi de titrage</span>
              </button>
            </div>
          )
        }
        return null
      })()}
    </div>
  )
}
