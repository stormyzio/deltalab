import type { RefObject } from 'react'
import type { ActiveExternalDrag } from '@/types/drag'
import { CATEGORY_META } from '@/lib/chemistry-ui'
import { cn } from '@/lib/utils'
import { ChemFormula, StateTag } from '@/components/ui/chem-text'
import {
  GasCollectorArtwork,
  SpeciesPhaseGlyph,
  ThermalChamberArtwork,
} from '@/components/MachineArtwork'
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
        <div
          className="relative flex h-14 w-14 flex-col items-center justify-center rounded-full border border-zinc-400 bg-card/95 shadow-2xl"
          style={{
            backgroundImage:
              'radial-gradient(circle at 30% 24%, rgba(255,255,255,0.11), transparent 62%)',
          }}
        >
          <span className="text-[8.5px] leading-none tabular-nums text-muted-foreground">
            {externalDrag.item.element.atomicNumber}
          </span>
          <span className="mt-0.5 text-[15px] font-semibold leading-none text-foreground">
            {externalDrag.item.element.symbol}
          </span>
          <span
            className="mt-1 h-1 w-3.5 rounded-full"
            style={{
              backgroundColor:
                CATEGORY_META[externalDrag.item.element.category].accentHex,
            }}
          />
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

      {externalDrag.item.kind === 'molecule' && (() => {
        const sp = externalDrag.item.species
        const isIon = sp.kind === 'ion'
        const phase = sp.standardState
        const glyphColor =
          sp.solutionColorHex ?? sp.colorHex ?? (sp.isSolvent ? '#bae6fd' : null)
        return (
          <div
            className={cn(
              'flex items-center gap-2 border border-zinc-400 bg-card/95 px-3 py-2 shadow-2xl',
              isIon
                ? 'rounded-xl'
                : phase === 'gas'
                  ? 'rounded-full border-dashed px-3.5'
                  : phase === 'liquid'
                    ? 'rounded-2xl'
                    : 'rounded-md',
            )}
          >
            <SpeciesPhaseGlyph
              phase={phase}
              isIon={isIon}
              charge={sp.charge}
              colorHex={glyphColor}
            />
            <span className="text-sm font-semibold text-foreground">
              <ChemFormula value={sp.displayFormula} />
              {!isIon && <StateTag state={phase} />}
            </span>
            <span className="text-[11px] text-muted-foreground">{sp.nameFr}</span>
          </div>
        )
      })()}

      {externalDrag.item.kind === 'gas_collector' && (
        <div className="flex flex-col items-center rounded-xl border border-zinc-400 bg-card/95 px-4 py-2.5 shadow-2xl">
          <GasCollectorArtwork fillRatio={0.2} gasColorHex="#7dd3fc" size="md" />
          <span className="mt-1 text-xs font-medium text-foreground">
            Collecteur de gaz
          </span>
        </div>
      )}

      {externalDrag.item.kind === 'thermal_chamber' && (
        <div className="flex flex-col items-center rounded-xl border border-zinc-400 bg-card/95 px-4 py-2.5 shadow-2xl">
          <ThermalChamberArtwork
            temperatureC={externalDrag.item.initialTargetC ?? -20}
            powerOn
            size="md"
          />
          <span className="mt-1 text-xs font-medium text-foreground">
            Chambre thermique
          </span>
        </div>
      )}
    </div>
  )
}
