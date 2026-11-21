import type { RefObject } from 'react'
import type { ActiveExternalDrag } from '@/types/drag'
import { CATEGORY_META } from '@/lib/chemistry-ui'
import { VesselArtwork } from '@/components/VesselArtwork'

interface ExternalDragGhostProps {
  externalDrag: ActiveExternalDrag | null
  ghostRef: RefObject<HTMLDivElement | null>
}

export function ExternalDragGhost({ externalDrag, ghostRef }: ExternalDragGhostProps) {
  if (!externalDrag?.started) return null

  return (
    <div
      ref={ghostRef}
      className="pointer-events-none fixed left-0 top-0 z-50 will-change-transform"
      style={{
        transform: `translate3d(${externalDrag.clientX}px, ${externalDrag.clientY}px, 0) translate(-50%, -50%)`,
      }}
    >
      {externalDrag.item.kind === 'atom' && (
        <div className="relative flex h-14 w-14 flex-col items-center justify-center rounded-xl border border-zinc-400 bg-card/95 shadow-2xl">
          <span className="absolute left-1.5 top-1 font-mono text-[9px] tabular-nums text-muted-foreground">
            {externalDrag.item.element.atomicNumber}
          </span>
          <span
            className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor:
                CATEGORY_META[externalDrag.item.element.category].accentHex,
            }}
          />
          <span className="mt-1 text-base font-semibold leading-none text-foreground">
            {externalDrag.item.element.symbol}
          </span>
          <span className="mt-0.5 max-w-[46px] truncate text-[8.5px] text-muted-foreground">
            {externalDrag.item.element.nameFr}
          </span>
        </div>
      )}

      {externalDrag.item.kind === 'vessel' && (
        <div className="flex flex-col items-center rounded-xl border border-zinc-400 bg-card/95 px-4 py-2.5 shadow-2xl">
          <VesselArtwork
            vesselType={externalDrag.item.vessel.vesselType}
            fillRatio={0}
            liquidColorHex={null}
            liquidOpacity={0}
            size="md"
          />
          <span className="mt-1 text-xs font-medium text-foreground">
            {externalDrag.item.vessel.nameFr}
          </span>
        </div>
      )}

      {externalDrag.item.kind === 'molecule' && (
        <div className="flex items-center gap-2 rounded-xl border border-zinc-400 bg-card/95 px-3 py-2 shadow-2xl">
          <span className="text-sm font-semibold text-foreground">
            {externalDrag.item.species.displayFormula}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {externalDrag.item.species.nameFr}
          </span>
        </div>
      )}
    </div>
  )
}
