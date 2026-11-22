import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { MoveHorizontal } from 'lucide-react'
import type { ScrubUnitOption } from '@/lib/quantity-units'
import { cn } from '@/lib/utils'
import { ChemText } from '@/components/ui/chem-text'

interface ScrubNumberInputProps {
  /** Current value in base unit */
  value: number
  /** Called during scrub, arrow step, or text commit with value in base unit */
  onChange: (nextBaseValue: number) => void
  /** Optional callback fired once when a scrub gesture finishes */
  onScrubEnd?: (finalBaseValue: number) => void
  /** Short symbol displayed next to the left drag handle (e.g. "n", "m", "C", <ChemVar base="C" sub="m" />) */
  prefixLabel?: ReactNode
  /** Static unit label when unit switching isn't needed */
  unit?: string
  /** Optional switchable units; clicking the right unit cycles through them */
  units?: ScrubUnitOption[]
  /** Initial unit id when `units` is provided (defaults to first or auto-selected) */
  defaultUnitId?: string
  min?: number
  max?: number
  /** Explicit step in DISPLAYED unit (used when `units` has no per-unit step) */
  step?: number
  /** Pixels of horizontal drag per base step at slow speed (default 5) */
  dragPixelsPerStep?: number
  disabled?: boolean
  ariaLabel: string
  className?: string
}

function getAdaptiveStep(displayVal: number): number {
  const abs = Math.abs(displayVal)
  if (abs === 0) return 0.1
  if (abs < 0.05) return 0.002
  if (abs < 0.2) return 0.01
  if (abs < 1) return 0.05
  if (abs < 5) return 0.1
  if (abs < 20) return 0.5
  if (abs < 100) return 1
  if (abs < 500) return 5
  return 10
}

function roundClean(val: number, step: number): number {
  if (!Number.isFinite(val)) return 0
  const decimals =
    step >= 1
      ? 1
      : Math.min(5, Math.max(2, Math.ceil(-Math.log10(Math.abs(step))) + 1))
  const factor = 10 ** decimals
  return Math.round(val * factor) / factor
}

function formatDisplayValue(val: number): string {
  if (!Number.isFinite(val)) return '0'
  const abs = Math.abs(val)
  if (abs === 0) return '0'
  let digits = 2
  if (abs >= 100) digits = 1
  else if (abs >= 10) digits = 2
  else if (abs >= 1) digits = 2
  else if (abs >= 0.01) digits = 3
  else digits = 4
  const rounded = Number(val.toFixed(digits))
  return String(rounded).replace('.', ',')
}

/**
 * Evaluates plain numbers (with `.` or `,`) as well as simple Figma-style math
 * expressions like `2*5`, `10/2`, `1,5+0,5`.
 */
function parseFlexibleNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '.').replace(/\s+/g, '')
  if (!cleaned) return null
  if (/^[+-]?(\d+\.?\d*|\.\d+)$/.test(cleaned)) {
    const n = Number(cleaned)
    return Number.isFinite(n) ? n : null
  }
  const m = cleaned.match(/^([+-]?\d*\.?\d+)([*/+-])(\d*\.?\d+)$/)
  if (!m) return null
  const a = Number(m[1])
  const op = m[2]
  const b = Number(m[3])
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null
  if (op === '*') return a * b
  if (op === '/') return b !== 0 ? a / b : null
  if (op === '+') return a + b
  if (op === '-') return a - b
  return null
}

function wrapCoord(val: number, max: number): number {
  if (max <= 0) return val
  return ((val % max) + max) % max
}

export function ScrubNumberInput({
  value,
  onChange,
  onScrubEnd,
  prefixLabel,
  unit,
  units,
  defaultUnitId,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step,
  dragPixelsPerStep = 5,
  disabled = false,
  ariaLabel,
  className,
}: ScrubNumberInputProps) {
  const [unitId, setUnitId] = useState<string>(() => {
    if (!units || units.length === 0) return ''
    if (defaultUnitId && units.some((u) => u.id === defaultUnitId)) {
      return defaultUnitId
    }
    return units[0].id
  })

  const activeUnit: ScrubUnitOption =
    units && units.length > 0
      ? (units.find((u) => u.id === unitId) ?? units[0])
      : { id: 'default', label: unit ?? '', toBase: 1 }

  const displayValue = activeUnit.toBase > 0 ? value / activeUnit.toBase : value

  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')
  const [scrubbing, setScrubbing] = useState(false)
  const [pointerLockOrigin, setPointerLockOrigin] = useState<{ x: number; y: number } | null>(
    null,
  )

  const handleRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const virtualCursorRef = useRef<HTMLDivElement | null>(null)
  const virtualPosRef = useRef({ x: 0, y: 0 })
  const cleanupScrubRef = useRef<(() => void) | null>(null)

  const onChangeRef = useRef(onChange)
  const onScrubEndRef = useRef(onScrubEnd)
  useEffect(() => {
    onChangeRef.current = onChange
    onScrubEndRef.current = onScrubEnd
  }, [onChange, onScrubEnd])

  useEffect(() => {
    return () => {
      cleanupScrubRef.current?.()
    }
  }, [])

  const clampBase = (rawBase: number) => Math.max(min, Math.min(max, rawBase))

  const resolveStep = (dispVal: number) =>
    activeUnit.step ?? step ?? getAdaptiveStep(dispVal)

  const commitDraft = () => {
    setFocused(false)
    const parsed = parseFlexibleNumber(draft)
    if (parsed === null) return
    const nextBase = clampBase(parsed * activeUnit.toBase)
    if (Math.abs(nextBase - value) > 1e-9) {
      onChange(nextBase)
      onScrubEnd?.(nextBase)
    }
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitDraft()
      e.currentTarget.blur()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setFocused(false)
      e.currentTarget.blur()
      return
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault()
      const dir = e.key === 'ArrowUp' ? 1 : -1
      const effectiveStep = resolveStep(displayValue)
      const nextDisplay = roundClean(displayValue + dir * effectiveStep, effectiveStep)
      const nextBase = clampBase(nextDisplay * activeUnit.toBase)
      setDraft(formatDisplayValue(nextBase / activeUnit.toBase))
      onChange(nextBase)
      onScrubEnd?.(nextBase)
    }
  }

  const handleScrubDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    cleanupScrubRef.current?.()

    const handleEl = handleRef.current
    const pointerId = e.pointerId
    const toBase = activeUnit.toBase
    const baseStep = resolveStep(displayValue)
    const minDisplay = Number.isFinite(min) ? min / toBase : Number.NEGATIVE_INFINITY
    const maxDisplay = Number.isFinite(max) ? max / toBase : Number.POSITIVE_INFINITY

    let rawDisplay = displayValue
    let lastBase = value
    let lastClientX = e.clientX
    let lastTime = performance.now()
    let smoothedSpeed = 0
    let isLocked = false
    let skipFirstLockDelta = false

    virtualPosRef.current = { x: e.clientX, y: e.clientY }

    setScrubbing(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    let finished = false

    const syncVirtualCursor = () => {
      const el = virtualCursorRef.current
      if (!el) return
      const { x, y } = virtualPosRef.current
      el.style.transform = `translate3d(${x}px, ${y}px, 0)`
    }

    const onPointerLockChange = () => {
      const lockedNow = Boolean(handleEl && document.pointerLockElement === handleEl)
      if (finished && lockedNow) {
        try {
          document.exitPointerLock?.()
        } catch {
          // ignore
        }
        return
      }
      isLocked = lockedNow
      setPointerLockOrigin(
        lockedNow
          ? { x: virtualPosRef.current.x, y: virtualPosRef.current.y }
          : null,
      )
      if (lockedNow) {
        skipFirstLockDelta = true
        requestAnimationFrame(syncVirtualCursor)
      }
    }

    const finish = () => {
      if (finished) return
      finished = true
      cleanupScrubRef.current = null
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowUp)
      window.removeEventListener('blur', finish)
      document.removeEventListener('pointerlockchange', onPointerLockChange)

      if (handleEl && document.pointerLockElement === handleEl) {
        try {
          document.exitPointerLock?.()
        } catch {
          // ignore
        }
      }

      setPointerLockOrigin(null)
      setScrubbing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onScrubEndRef.current?.(lastBase)
    }

    const onWindowMove = (ev: PointerEvent) => {
      if (!isLocked && ev.pointerId !== pointerId) return
      if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
        finish()
        return
      }

      let deltaX = 0
      if (isLocked) {
        deltaX = ev.movementX
        // Guard against occasional macOS/Chrome pointer-lock activation jump
        if (skipFirstLockDelta) {
          skipFirstLockDelta = false
          if (Math.abs(deltaX) > 120) return
        }
        if (Math.abs(deltaX) > 300) return
        virtualPosRef.current.x = wrapCoord(
          virtualPosRef.current.x + deltaX,
          window.innerWidth,
        )
        virtualPosRef.current.y = Math.max(
          8,
          Math.min(window.innerHeight - 8, virtualPosRef.current.y + ev.movementY * 0.25),
        )
        syncVirtualCursor()
      } else {
        deltaX = ev.clientX - lastClientX
        lastClientX = ev.clientX
      }

      if (deltaX === 0) return

      const now = performance.now()
      const dtMs = Math.max(4, Math.min(80, now - lastTime))
      lastTime = now

      const instantSpeed = Math.abs(deltaX) / dtMs // px / ms
      smoothedSpeed = smoothedSpeed * 0.55 + instantSpeed * 0.45

      // Slow drag (<= 0.25 px/ms) stays strictly 1x for fine precision;
      // faster movement accelerates smoothly with pointer speed.
      const excess = Math.max(0, smoothedSpeed - 0.25)
      const velocityMult = Math.min(20, 1 + 2.8 * Math.pow(excess, 1.45))

      const nextRawDisplay = Math.max(
        minDisplay,
        Math.min(maxDisplay, rawDisplay + (deltaX / dragPixelsPerStep) * baseStep * velocityMult),
      )
      rawDisplay = nextRawDisplay

      const snappedDisplay = roundClean(
        Math.round(rawDisplay / baseStep) * baseStep,
        baseStep,
      )
      const nextBase = clampBase(snappedDisplay * toBase)
      if (Math.abs(nextBase - lastBase) > 1e-9) {
        lastBase = nextBase
        onChangeRef.current(nextBase)
      }
    }

    const onWindowUp = (ev: PointerEvent) => {
      if (!isLocked && ev.pointerId !== pointerId) return
      finish()
    }

    cleanupScrubRef.current = finish
    document.addEventListener('pointerlockchange', onPointerLockChange)
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowUp)
    window.addEventListener('blur', finish)

    // Request Pointer Lock for desktop mouse drags so the cursor wraps infinitely
    if (e.pointerType === 'mouse' && handleEl?.requestPointerLock) {
      try {
        const maybePromise = handleEl.requestPointerLock() as unknown as
          | Promise<void>
          | undefined
        if (maybePromise && typeof maybePromise.catch === 'function') {
          maybePromise.catch(() => {
            // Pointer lock unavailable/cancelled — fallback to standard clientX delta
          })
        }
      } catch {
        // Fallback silently
      }
    }
  }

  const cycleUnit = () => {
    if (!units || units.length < 2 || disabled) return
    const idx = units.findIndex((u) => u.id === activeUnit.id)
    const next = units[(idx + 1) % units.length]
    setUnitId(next.id)
  }

  const hasUnitSwitcher = Boolean(units && units.length > 1)
  const maxUnitChars =
    units && units.length > 0
      ? Math.max(...units.map((u) => u.label.length))
      : (activeUnit.label?.length ?? 0)

  return (
    <div
      className={cn(
        'flex h-7 min-w-0 items-center rounded-md border bg-card',
        scrubbing || focused
          ? 'border-zinc-500 ring-1 ring-ring'
          : 'border-border hover:border-zinc-600',
        disabled && 'opacity-50',
        className,
      )}
    >
      {/* Left horizontal scrub handle (velocity-sensitive + infinite wrap) */}
      <div
        ref={handleRef}
        role="slider"
        aria-label={`Ajuster ${ariaLabel} par glissement horizontal`}
        aria-valuenow={Math.round(displayValue * 1000) / 1000}
        aria-valuemin={Number.isFinite(min) ? min / activeUnit.toBase : undefined}
        aria-valuemax={Number.isFinite(max) ? max / activeUnit.toBase : undefined}
        tabIndex={-1}
        onPointerDown={handleScrubDown}
        title="Glisser horizontalement pour ajuster (plus vite = incrément plus grand)"
        className={cn(
          'flex h-full shrink-0 items-center gap-1 border-r border-border/60 px-1.5 select-none',
          disabled
            ? 'text-muted-foreground/50'
            : scrubbing
              ? 'cursor-ew-resize bg-accent/70 text-foreground'
              : 'cursor-ew-resize text-muted-foreground hover:bg-accent/50 hover:text-foreground',
        )}
      >
        <MoveHorizontal className="h-2.5 w-2.5 shrink-0 opacity-70" strokeWidth={1.8} />
        {prefixLabel && (
          <span className="text-[10px] font-medium leading-none">
            {prefixLabel}
          </span>
        )}
      </div>

      {/* Numeric text input */}
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        value={focused ? draft : formatDisplayValue(displayValue)}
        onFocus={(e) => {
          setFocused(true)
          setDraft(formatDisplayValue(displayValue))
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={handleKeyDown}
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 text-right text-[11px] tabular-nums text-foreground focus:outline-none"
      />

      {/* Right unit badge (fixed width across all unit options to prevent shift) */}
      {activeUnit.label &&
        (hasUnitSwitcher ? (
          <button
            type="button"
            disabled={disabled}
            onClick={cycleUnit}
            title="Cliquer pour changer d’unité"
            aria-label={`Unité : ${activeUnit.label} (cliquer pour changer)`}
            style={{ minWidth: `calc(${maxUnitChars}ch + 0.75rem)` }}
            className="flex h-full shrink-0 items-center justify-center border-l border-border/60 px-1.5 text-[10px] font-medium text-muted-foreground hover:bg-accent/60 hover:text-foreground disabled:pointer-events-none"
          >
            <ChemText value={activeUnit.label} />
          </button>
        ) : (
          <span className="flex h-full shrink-0 items-center pr-1.5 text-[10px] text-muted-foreground select-none">
            <ChemText value={activeUnit.label} />
          </span>
        ))}

      {/* Virtual wrapping ew-resize cursor while Pointer Lock is active */}
      {pointerLockOrigin &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="pointer-events-none fixed inset-0 z-[9999]">
            <div
              ref={virtualCursorRef}
              style={{
                transform: `translate3d(${pointerLockOrigin.x}px, ${pointerLockOrigin.y}px, 0)`,
              }}
              className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center will-change-transform"
            >
              <svg
                width="20"
                height="12"
                viewBox="0 0 20 12"
                fill="none"
                className="drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]"
              >
                <path
                  d="M1 6L6 1.5V4.5H14V1.5L19 6L14 10.5V7.5H6V10.5L1 6Z"
                  fill="#ffffff"
                  stroke="#09090b"
                  strokeWidth="1.2"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
