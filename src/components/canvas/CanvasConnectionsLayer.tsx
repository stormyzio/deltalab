import {
  type RefObject,
  forwardRef,
  memo,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react'
import type {
  CanvasFlaskNode,
  CanvasGasCollectorNode,
  CanvasNode,
} from '../../../shared/chemistry.ts'
import { NODE_HALF_SIZE } from '@/lib/canvas-geometry'

export interface CanvasConnectionsLayerHandle {
  syncLivePositions: (
    overrides?: ReadonlyArray<{ id: string; x: number; y: number }>,
  ) => void
}

interface CanvasConnectionsLayerProps {
  nodes: CanvasNode[]
  nodeElMapRef: RefObject<Map<string, HTMLDivElement>>
}

type BoxSide = 'top' | 'right' | 'bottom' | 'left'

interface ArrowPose {
  x: number
  y: number
  angleDeg: number
}

interface GasHoseGeometry {
  path: string
  sx: number
  sy: number
  tx: number
  ty: number
  arrows: [ArrowPose, ArrowPose]
}

function getSideAnchor(
  cx: number,
  cy: number,
  hw: number,
  hh: number,
  side: BoxSide,
): { x: number; y: number; nx: number; ny: number } {
  switch (side) {
    case 'right':
      return { x: cx + hw, y: cy, nx: 1, ny: 0 }
    case 'left':
      return { x: cx - hw, y: cy, nx: -1, ny: 0 }
    case 'bottom':
      return { x: cx, y: cy + hh, nx: 0, ny: 1 }
    case 'top':
      return { x: cx, y: cy - hh, nx: 0, ny: -1 }
  }
}

const ALL_SIDES: readonly BoxSide[] = ['top', 'right', 'bottom', 'left']

function chooseBoxSides(
  sx: number,
  sy: number,
  shw: number,
  shh: number,
  tx: number,
  ty: number,
  thw: number,
  thh: number,
): { sourceSide: BoxSide; targetSide: BoxSide } {
  let bestSource: BoxSide = 'top'
  let bestTarget: BoxSide = 'bottom'
  let bestScore = Number.POSITIVE_INFINITY

  for (const sSide of ALL_SIDES) {
    const start = getSideAnchor(sx, sy, shw, shh, sSide)
    for (const tSide of ALL_SIDES) {
      const end = getSideAnchor(tx, ty, thw, thh, tSide)
      const vx = end.x - start.x
      const vy = end.y - start.y
      const dist = Math.max(1, Math.hypot(vx, vy))

      // Cosine of angle between each border's outward normal and the chord connecting the two anchors.
      // Must be positive so the hose never exits a side only to double back in the opposite direction.
      const cos1 = (start.nx * vx + start.ny * vy) / dist
      const cos2 = (end.nx * -vx + end.ny * -vy) / dist

      let score: number
      if (cos1 <= 0.12 || cos2 <= 0.12) {
        // Heavy penalty when an anchor faces away from or almost tangent to the other anchor
        score = 1e6 + dist - (cos1 + cos2) * 1e4
      } else {
        score = dist / ((cos1 + 0.25) * (cos2 + 0.25))
      }

      if (score < bestScore) {
        bestScore = score
        bestSource = sSide
        bestTarget = tSide
      }
    }
  }

  return { sourceSide: bestSource, targetSide: bestTarget }
}

function evalCubicBezierPose(
  p0x: number,
  p0y: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number,
  p3x: number,
  p3y: number,
  t: number,
): ArrowPose {
  const u = 1 - t
  const uu = u * u
  const tt = t * t
  const x =
    uu * u * p0x + 3 * uu * t * p1x + 3 * u * tt * p2x + tt * t * p3x
  const y =
    uu * u * p0y + 3 * uu * t * p1y + 3 * u * tt * p2y + tt * t * p3y

  const dxdt =
    3 * uu * (p1x - p0x) + 6 * u * t * (p2x - p1x) + 3 * tt * (p3x - p2x)
  const dydt =
    3 * uu * (p1y - p0y) + 6 * u * t * (p2y - p1y) + 3 * tt * (p3y - p2y)

  const angleDeg = (Math.atan2(dydt, dxdt) * 180) / Math.PI
  return { x, y, angleDeg }
}

function computeGasHoseGeometry(
  sxCenter: number,
  syCenter: number,
  shw: number,
  shh: number,
  txCenter: number,
  tyCenter: number,
  thw: number,
  thh: number,
): GasHoseGeometry {
  const { sourceSide, targetSide } = chooseBoxSides(
    sxCenter,
    syCenter,
    shw,
    shh,
    txCenter,
    tyCenter,
    thw,
    thh,
  )
  const start = getSideAnchor(sxCenter, syCenter, shw, shh, sourceSide)
  const end = getSideAnchor(txCenter, tyCenter, thw, thh, targetSide)

  const dist = Math.hypot(end.x - start.x, end.y - start.y)
  const ctrl = Math.max(26, Math.min(92, dist * 0.42))
  const c1x = start.x + start.nx * ctrl
  const c1y = start.y + start.ny * ctrl
  const c2x = end.x + end.nx * ctrl
  const c2y = end.y + end.ny * ctrl

  const path = `M ${start.x} ${start.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${end.x} ${end.y}`
  const arrow1 = evalCubicBezierPose(
    start.x,
    start.y,
    c1x,
    c1y,
    c2x,
    c2y,
    end.x,
    end.y,
    0.34,
  )
  const arrow2 = evalCubicBezierPose(
    start.x,
    start.y,
    c1x,
    c1y,
    c2x,
    c2y,
    end.x,
    end.y,
    0.68,
  )

  return {
    path,
    sx: start.x,
    sy: start.y,
    tx: end.x,
    ty: end.y,
    arrows: [arrow1, arrow2],
  }
}

interface LinkDomRefs {
  outerPath: SVGPathElement | null
  innerPath: SVGPathElement | null
  startDot: SVGCircleElement | null
  endDot: SVGCircleElement | null
  arrow1: SVGGElement | null
  arrow2: SVGGElement | null
}

/**
 * Renders live flexible gas delivery hoses between connected flasks & gas collectors.
 * Anchors cleanly from border to border, shows directional flow chevrons (Flask -> Collector),
 * and updates at 120fps during node drag via `syncLivePositions`.
 */
export const CanvasConnectionsLayer = memo(
  forwardRef<CanvasConnectionsLayerHandle, CanvasConnectionsLayerProps>(
    function CanvasConnectionsLayer({ nodes, nodeElMapRef }, ref) {
      const linkDomMapRef = useRef<Map<string, LinkDomRefs>>(new Map())

      const gasLinks = useMemo(() => {
        const flasksById = new Map<string, CanvasFlaskNode>()
        const collectors: CanvasGasCollectorNode[] = []

        for (const n of nodes) {
          if (n.kind === 'flask') flasksById.set(n.id, n)
          else if (n.kind === 'gas_collector') collectors.push(n)
        }

        const list: Array<{
          key: string
          source: CanvasFlaskNode
          target: CanvasGasCollectorNode
          active: boolean
        }> = []

        for (const col of collectors) {
          if (!col.sourceFlaskId) continue
          const src = flasksById.get(col.sourceFlaskId)
          if (!src) continue
          const active =
            (src.temperatureC ?? 20) >= 55 &&
            typeof src.heaterTargetC === 'number' &&
            (src.solution.hasWater || src.solution.solutes.length > 0)
          list.push({
            key: `gas-${src.id}-${col.id}`,
            source: src,
            target: col,
            active,
          })
        }
        return list
      }, [nodes])

      const getBoxHalfSize = useCallback(
        (node: CanvasNode): { hw: number; hh: number } => {
          const el = nodeElMapRef.current?.get(node.id)
          if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
            return { hw: el.offsetWidth / 2, hh: el.offsetHeight / 2 }
          }
          return NODE_HALF_SIZE[node.kind]
        },
        [nodeElMapRef],
      )

      const syncLivePositions = useCallback(
        (overrides?: ReadonlyArray<{ id: string; x: number; y: number }>) => {
          if (gasLinks.length === 0) return
          const overrideMap = new Map<string, { x: number; y: number }>()
          if (overrides) {
            for (const u of overrides) overrideMap.set(u.id, u)
          }

          for (const { key, source, target } of gasLinks) {
            const dom = linkDomMapRef.current.get(key)
            if (!dom) continue
            const srcPos = overrideMap.get(source.id) ?? source
            const tgtPos = overrideMap.get(target.id) ?? target
            const srcHalf = getBoxHalfSize(source)
            const tgtHalf = getBoxHalfSize(target)

            const geom = computeGasHoseGeometry(
              srcPos.x,
              srcPos.y,
              srcHalf.hw,
              srcHalf.hh,
              tgtPos.x,
              tgtPos.y,
              tgtHalf.hw,
              tgtHalf.hh,
            )

            dom.outerPath?.setAttribute('d', geom.path)
            dom.innerPath?.setAttribute('d', geom.path)
            dom.startDot?.setAttribute('cx', String(geom.sx))
            dom.startDot?.setAttribute('cy', String(geom.sy))
            dom.endDot?.setAttribute('cx', String(geom.tx))
            dom.endDot?.setAttribute('cy', String(geom.ty))
            dom.arrow1?.setAttribute(
              'transform',
              `translate(${geom.arrows[0].x}, ${geom.arrows[0].y}) rotate(${geom.arrows[0].angleDeg})`,
            )
            dom.arrow2?.setAttribute(
              'transform',
              `translate(${geom.arrows[1].x}, ${geom.arrows[1].y}) rotate(${geom.arrows[1].angleDeg})`,
            )
          }
        },
        [gasLinks, getBoxHalfSize],
      )

      useImperativeHandle(
        ref,
        () => ({
          syncLivePositions,
        }),
        [syncLivePositions],
      )

      // Measure actual DOM tile dimensions right after layout (and after child refs attach)
      useLayoutEffect(() => {
        syncLivePositions()
        const raf = requestAnimationFrame(() => {
          syncLivePositions()
        })
        return () => cancelAnimationFrame(raf)
      }, [syncLivePositions])

      if (gasLinks.length === 0) return null

      return (
        <svg
          className="pointer-events-none absolute inset-0 overflow-visible"
          width="1"
          height="1"
          aria-hidden="true"
        >
          {gasLinks.map(({ key, source, target, active }) => {
            const srcHalf = getBoxHalfSize(source)
            const tgtHalf = getBoxHalfSize(target)
            const geom = computeGasHoseGeometry(
              source.x,
              source.y,
              srcHalf.hw,
              srcHalf.hh,
              target.x,
              target.y,
              tgtHalf.hw,
              tgtHalf.hh,
            )
            const strokeColor = active ? '#38bdf8' : '#71717a'
            const arrowColor = active ? '#7dd3fc' : '#a1a1aa'

            const ensureEntry = (k: string): LinkDomRefs => {
              let entry = linkDomMapRef.current.get(k)
              if (!entry) {
                entry = {
                  outerPath: null,
                  innerPath: null,
                  startDot: null,
                  endDot: null,
                  arrow1: null,
                  arrow2: null,
                }
                linkDomMapRef.current.set(k, entry)
              }
              return entry
            }

            return (
              <g key={key}>
                <path
                  ref={(el) => {
                    ensureEntry(key).outerPath = el
                  }}
                  d={geom.path}
                  fill="none"
                  stroke="#3f3f46"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
                <path
                  ref={(el) => {
                    ensureEntry(key).innerPath = el
                  }}
                  d={geom.path}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2"
                  strokeDasharray={active ? '6 6' : undefined}
                  strokeLinecap="round"
                  opacity={active ? 0.92 : 0.7}
                >
                  {active && (
                    <animate
                      attributeName="stroke-dashoffset"
                      from="24"
                      to="0"
                      dur="1.1s"
                      repeatCount="indefinite"
                    />
                  )}
                </path>

                {/* Directional flow arrows (Flask -> Gas Collector) */}
                <g
                  ref={(el) => {
                    ensureEntry(key).arrow1 = el
                  }}
                  transform={`translate(${geom.arrows[0].x}, ${geom.arrows[0].y}) rotate(${geom.arrows[0].angleDeg})`}
                >
                  <path
                    d="M -4 -3.8 L 3.5 0 L -4 3.8"
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -4 -3.8 L 3.5 0 L -4 3.8"
                    fill="none"
                    stroke={arrowColor}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                <g
                  ref={(el) => {
                    ensureEntry(key).arrow2 = el
                  }}
                  transform={`translate(${geom.arrows[1].x}, ${geom.arrows[1].y}) rotate(${geom.arrows[1].angleDeg})`}
                >
                  <path
                    d="M -4 -3.8 L 3.5 0 L -4 3.8"
                    fill="none"
                    stroke="#18181b"
                    strokeWidth="3.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M -4 -3.8 L 3.5 0 L -4 3.8"
                    fill="none"
                    stroke={arrowColor}
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>

                <circle
                  ref={(el) => {
                    ensureEntry(key).startDot = el
                  }}
                  cx={geom.sx}
                  cy={geom.sy}
                  r="3.2"
                  fill="#71717a"
                />
                <circle
                  ref={(el) => {
                    ensureEntry(key).endDot = el
                  }}
                  cx={geom.tx}
                  cy={geom.ty}
                  r="3.2"
                  fill={strokeColor}
                />
              </g>
            )
          })}
        </svg>
      )
    },
  ),
)
