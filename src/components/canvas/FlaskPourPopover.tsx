import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import type { CanvasFlaskNode } from '../../../shared/chemistry.ts'
import { formatFrNumber, formatVolumeMl } from '@/lib/chemistry-ui'
import { Button } from '@/components/ui/button'
import { InlineNumberInput, type InlineUnitOption } from '@/components/ui/inline-number-input'
import { Slider } from '@/components/ui/slider'

const POUR_INLINE_UNITS: InlineUnitOption[] = [
  { id: 'mL', label: 'mL', toBase: 1, decimals: 1 },
  { id: 'L', label: 'L', toBase: 1000, decimals: 3 },
]

interface FlaskPourPopoverProps {
  source: CanvasFlaskNode
  target: CanvasFlaskNode
  onConfirm: (volumeMl: number) => void
  onCancel: () => void
}

function buildPourSnapPoints(maxMl: number): number[] {
  const candidates = [
    maxMl * 0.25,
    maxMl * 0.5,
    maxMl * 0.75,
    maxMl,
    1,
    5,
    10,
    20,
    25,
    50,
    100,
    250,
  ]
  const unique: number[] = []
  for (const c of candidates) {
    if (c <= 0.05 || c > maxMl + 0.01) continue
    const rounded = Math.round(Math.min(maxMl, c) * 10) / 10
    if (!unique.some((u) => Math.abs(u - rounded) < maxMl * 0.04)) {
      unique.push(rounded)
    }
  }
  return unique.sort((a, b) => a - b)
}

export function FlaskPourPopover({
  source,
  target,
  onConfirm,
  onCancel,
}: FlaskPourPopoverProps) {
  const freeTargetMl = Math.max(0, target.vessel.capacityMl - target.solution.totalVolumeMl)
  const maxMl = Math.max(
    0,
    Math.round(Math.min(source.solution.totalVolumeMl, freeTargetMl) * 10) / 10,
  )

  const defaultVol = useMemo(() => {
    if (maxMl <= 0) return 0
    if (source.vessel.vesselType === 'burette') return Math.min(maxMl, 5)
    if (maxMl <= 10) return maxMl
    return Math.round(maxMl * 0.5 * 10) / 10
  }, [maxMl, source.vessel.vesselType])

  const [volumeMl, setVolumeMl] = useState(defaultVol)
  const snapPoints = useMemo(() => buildPourSnapPoints(maxMl), [maxMl])
  const step = maxMl <= 10 ? 0.1 : maxMl <= 100 ? 0.2 : 0.5

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      } else if (e.key === 'Enter' && volumeMl > 0.05) {
        e.preventDefault()
        onConfirm(volumeMl)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onCancel, onConfirm, volumeMl])

  const sourceTitle =
    source.customLabel || source.solution.labelFr || source.vessel.nameFr

  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      className="flex w-[256px] cursor-default flex-col rounded-xl border border-border bg-panel/98 p-3 shadow-2xl select-none"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11.5px] font-medium text-foreground">
            Verser depuis {sourceTitle}
          </p>
          <p className="text-[10px] tabular-nums text-muted-foreground">
            Disponible : {formatVolumeMl(maxMl)}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onCancel}
          aria-label="Annuler le versement"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" strokeWidth={1.6} />
        </Button>
      </div>

      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center justify-between gap-2 text-[11px]">
          <span className="font-medium text-muted-foreground">Volume</span>
          <div className="flex items-center gap-1.5">
            <InlineNumberInput
              value={volumeMl}
              onChange={setVolumeMl}
              min={0}
              max={maxMl}
              step={step}
              units={POUR_INLINE_UNITS}
              defaultUnitId="mL"
              inputWidthClass="w-[5.5ch]"
              ariaLabel="Volume à verser"
            />
            <button
              type="button"
              onClick={() => setVolumeMl(maxMl)}
              className="h-[22px] shrink-0 whitespace-nowrap rounded px-1.5 text-[10px] text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              Tout
            </button>
          </div>
        </div>

        <Slider
          min={0}
          max={Math.max(0.1, maxMl)}
          step={step}
          snapPoints={snapPoints}
          value={volumeMl}
          onChange={setVolumeMl}
          ariaLabel="Volume à verser en millilitres"
        />
      </div>

      <div className="mt-2.5 flex items-center justify-end gap-1.5">
        <Button
          size="sm"
          variant="ghost"
          onClick={onCancel}
          className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Annuler
        </Button>
        <Button
          size="sm"
          disabled={volumeMl <= 0.04}
          onClick={() => onConfirm(volumeMl)}
          className="h-7 min-w-[116px] justify-center px-3 text-[11px] tabular-nums"
        >
          Verser {formatFrNumber(volumeMl, volumeMl < 10 ? 1 : 0)} mL
        </Button>
      </div>
    </div>
  )
}
