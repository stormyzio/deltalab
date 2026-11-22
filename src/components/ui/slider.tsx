import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cn } from '@/lib/utils'

export interface SliderScaleStop {
  /** Domain value within [min, max] */
  value: number
  /** Normalized visual track position in [0, 1] */
  position: number
}

interface SliderProps {
  value: number
  min: number
  max: number
  /** Step used for keyboard arrows and value rounding (dragging glides smoothly) */
  step?: number
  /** Optional magnetic snap points along [min, max] */
  snapPoints?: number[]
  /** Optional piecewise non-linear scale stops mapping domain values to [0, 1] track positions */
  scaleStops?: SliderScaleStop[]
  /** Optional lower floor within [min, max] below which the thumb cannot be dragged (keeps scale fixed) */
  minSelectable?: number
  /** Fraction of total track width within which dragging magnetically snaps (default 0.022) */
  snapThresholdRatio?: number
  onChange: (value: number) => void
  onCommit?: (value: number) => void
  disabled?: boolean
  ariaLabel: string
  className?: string
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function quantizeStep(v: number, min: number, step: number): number {
  if (!Number.isFinite(step) || step <= 0) return v
  const snapped = min + Math.round((v - min) / step) * step
  const decimals =
    step >= 1
      ? 2
      : Math.min(7, Math.max(2, Math.ceil(-Math.log10(Math.abs(step))) + 1))
  const factor = 10 ** decimals
  return Math.round(snapped * factor) / factor
}

function normalizeScaleStops(
  min: number,
  max: number,
  rawStops?: SliderScaleStop[],
): SliderScaleStop[] | null {
  if (!rawStops || rawStops.length < 2 || max <= min) return null
  const sorted = rawStops
    .filter(
      (s) =>
        Number.isFinite(s.value) &&
        Number.isFinite(s.position) &&
        s.value >= min - 1e-9 &&
        s.value <= max + 1e-9,
    )
    .map((s) => ({
      value: clamp(s.value, min, max),
      position: clamp(s.position, 0, 1),
    }))
    .sort((a, b) => a.value - b.value)

  // Ensure strictly increasing values & positions and anchor both ends
  const stops: SliderScaleStop[] = []
  for (const s of sorted) {
    const prev = stops[stops.length - 1]
    if (!prev || (s.value > prev.value + 1e-9 && s.position > prev.position + 1e-9)) {
      stops.push(s)
    }
  }
  if (stops.length === 0) return null
  if (stops[0].value > min + 1e-9 || stops[0].position > 1e-9) {
    stops.unshift({ value: min, position: 0 })
  } else {
    stops[0] = { value: min, position: 0 }
  }
  const last = stops[stops.length - 1]
  if (last.value < max - 1e-9 || last.position < 1 - 1e-9) {
    stops.push({ value: max, position: 1 })
  } else {
    stops[stops.length - 1] = { value: max, position: 1 }
  }
  return stops.length >= 2 ? stops : null
}

function domainToRatio(
  v: number,
  min: number,
  max: number,
  stops: SliderScaleStop[] | null,
): number {
  const clamped = clamp(v, min, max)
  if (!stops) return (clamped - min) / Math.max(1e-9, max - min)
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (clamped <= b.value || i === stops.length - 2) {
      const segSpan = Math.max(1e-9, b.value - a.value)
      const t = clamp((clamped - a.value) / segSpan, 0, 1)
      return a.position + t * (b.position - a.position)
    }
  }
  return 1
}

function ratioToDomain(
  ratio: number,
  min: number,
  max: number,
  stops: SliderScaleStop[] | null,
): number {
  const r = clamp(ratio, 0, 1)
  if (!stops) return min + r * Math.max(1e-9, max - min)
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i]
    const b = stops[i + 1]
    if (r <= b.position || i === stops.length - 2) {
      const segSpan = Math.max(1e-9, b.position - a.position)
      const t = clamp((r - a.position) / segSpan, 0, 1)
      return a.value + t * (b.value - a.value)
    }
  }
  return max
}

export function Slider({
  value,
  min,
  max,
  step,
  snapPoints = [],
  scaleStops,
  minSelectable,
  snapThresholdRatio = 0.022,
  onChange,
  onCommit,
  disabled = false,
  ariaLabel,
  className,
}: SliderProps) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const fillRef = useRef<HTMLDivElement | null>(null)
  const thumbRef = useRef<HTMLSpanElement | null>(null)

  const [dragging, setDragging] = useState(false)
  const lastValRef = useRef(value)
  const rafEmitRef = useRef<number | null>(null)
  const pendingEmitRef = useRef<number | null>(null)
  const cleanupDragRef = useRef<(() => void) | null>(null)

  const onChangeRef = useRef(onChange)
  const onCommitRef = useRef(onCommit)
  useEffect(() => {
    onChangeRef.current = onChange
    onCommitRef.current = onCommit
  }, [onChange, onCommit])

  useEffect(() => {
    return () => {
      cleanupDragRef.current?.()
      if (rafEmitRef.current !== null) cancelAnimationFrame(rafEmitRef.current)
    }
  }, [])

  const span = Math.max(1e-9, max - min)
  const effectiveFloor =
    minSelectable !== undefined ? clamp(minSelectable, min, max) : min
  const clampedValue = clamp(value, effectiveFloor, max)
  const keyboardStep = step ?? span / 100
  const normalizedStops = useMemo(
    () => normalizeScaleStops(min, max, scaleStops),
    [min, max, scaleStops],
  )
  const floorRatio = domainToRatio(effectiveFloor, min, max, normalizedStops)
  const currentRatio = domainToRatio(clampedValue, min, max, normalizedStops)

  const setVisualRatio = (ratio: number) => {
    const p = `${(clamp(ratio, 0, 1) * 100).toFixed(3)}%`
    if (fillRef.current) fillRef.current.style.width = p
    if (thumbRef.current) thumbRef.current.style.left = p
  }

  useLayoutEffect(() => {
    if (!dragging) {
      setVisualRatio(currentRatio)
    }
  }, [currentRatio, dragging])

  const computeFromClientX = (
    clientX: number,
    bypassSnap: boolean,
  ): { visualRatio: number; emittedValue: number } => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width <= 0) {
      return { visualRatio: currentRatio, emittedValue: clampedValue }
    }
    const rawRatio = clamp((clientX - rect.left) / rect.width, floorRatio, 1)

    if (!bypassSnap && snapPoints.length > 0) {
      let bestSnap: number | null = null
      let bestSnapRatio = rawRatio
      let bestRatioDist = snapThresholdRatio
      for (const sp of snapPoints) {
        if (sp < effectiveFloor - 1e-9 || sp > max + 1e-9) continue
        const spRatio = domainToRatio(sp, min, max, normalizedStops)
        const dist = Math.abs(rawRatio - spRatio)
        if (dist <= bestRatioDist) {
          bestRatioDist = dist
          bestSnap = sp
          bestSnapRatio = spRatio
        }
      }
      if (bestSnap !== null) {
        return {
          visualRatio: bestSnapRatio,
          emittedValue: clamp(bestSnap, effectiveFloor, max),
        }
      }
    }

    const rawVal = ratioToDomain(rawRatio, min, max, normalizedStops)
    const fineStep = step !== undefined ? Math.min(step, span / 250) : span / 400
    const smoothVal = clamp(quantizeStep(rawVal, min, fineStep), effectiveFloor, max)
    return { visualRatio: rawRatio, emittedValue: smoothVal }
  }

  const scheduleEmit = (nextVal: number) => {
    pendingEmitRef.current = nextVal
    if (rafEmitRef.current === null) {
      rafEmitRef.current = requestAnimationFrame(() => {
        rafEmitRef.current = null
        const latest = pendingEmitRef.current
        pendingEmitRef.current = null
        if (latest !== null) {
          onChangeRef.current(latest)
        }
      })
    }
  }

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    // Ensure any previous drag listeners are cleaned up before starting a new gesture
    cleanupDragRef.current?.()

    const pointerId = e.pointerId
    setDragging(true)

    const { visualRatio, emittedValue } = computeFromClientX(e.clientX, e.altKey)
    setVisualRatio(visualRatio)
    lastValRef.current = emittedValue
    onChangeRef.current(emittedValue)

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      cleanupDragRef.current = null
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowUp)
      window.removeEventListener('blur', finish)

      setDragging(false)
      if (rafEmitRef.current !== null) {
        cancelAnimationFrame(rafEmitRef.current)
        rafEmitRef.current = null
      }
      if (pendingEmitRef.current !== null) {
        const latest = pendingEmitRef.current
        pendingEmitRef.current = null
        onChangeRef.current(latest)
      }
      onCommitRef.current?.(lastValRef.current)
    }

    const onWindowMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      // Failsafe: if the primary mouse button is no longer held, stop immediately
      if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
        finish()
        return
      }
      const next = computeFromClientX(ev.clientX, ev.altKey)
      setVisualRatio(next.visualRatio)
      if (Math.abs(next.emittedValue - lastValRef.current) > 1e-10) {
        lastValRef.current = next.emittedValue
        scheduleEmit(next.emittedValue)
      }
    }

    const onWindowUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      finish()
    }

    cleanupDragRef.current = finish
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowUp)
    window.addEventListener('blur', finish)
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (disabled) return
    let next: number | null = null
    const mult = e.shiftKey ? 5 : 1
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      next = clamp(
        quantizeStep(clampedValue + keyboardStep * mult, min, keyboardStep),
        min,
        max,
      )
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      next = clamp(
        quantizeStep(clampedValue - keyboardStep * mult, min, keyboardStep),
        min,
        max,
      )
    } else if (e.key === 'Home') {
      next = min
    } else if (e.key === 'End') {
      next = max
    }
    if (next !== null) {
      e.preventDefault()
      lastValRef.current = next
      onChange(next)
      onCommit?.(next)
    }
  }

  const validSnaps = snapPoints
    .filter((sp) => sp >= min - 1e-9 && sp <= max + 1e-9)
    .map((sp) => ({
      value: sp,
      ratio: domainToRatio(sp, min, max, normalizedStops),
    }))
    .filter((item) => item.ratio > 0.01 && item.ratio < 0.99)

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={clampedValue}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      className={cn(
        'group/slider relative flex h-6 w-full cursor-default items-center select-none touch-none focus-visible:outline-none',
        disabled && 'opacity-45',
        className,
      )}
    >
      {/* Track background */}
      <div className="relative h-1.5 w-full rounded-full bg-zinc-800">
        {/* Filled range */}
        <div ref={fillRef} className="h-full rounded-full bg-zinc-200" />

        {/* Subtle magnetic snap notches */}
        {validSnaps.map((item, i) => {
          const isReached = currentRatio >= item.ratio - 0.002
          return (
            <span
              key={`${item.value}-${i}`}
              aria-hidden="true"
              className={cn(
                'pointer-events-none absolute top-1/2 h-2 w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full',
                isReached ? 'bg-zinc-950/65' : 'bg-zinc-600/80',
              )}
              style={{ left: `${item.ratio * 100}%` }}
            />
          )
        })}
      </div>

      {/* Thumb with crisp hover & active scale-up */}
      <span
        ref={thumbRef}
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-zinc-950 bg-zinc-100 shadow-sm transition-transform duration-150 ease-out will-change-transform group-focus-visible/slider:ring-2 group-focus-visible/slider:ring-ring',
          dragging
            ? 'scale-[1.35]'
            : !disabled && 'group-hover/slider:scale-125',
        )}
      />
    </div>
  )
}
