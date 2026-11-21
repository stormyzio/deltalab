import {
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react'
import { MoveHorizontal } from 'lucide-react'
import type { ScrubUnitOption } from '@/lib/quantity-units'
import { cn } from '@/lib/utils'

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
  /** Explicit step in DISPLAYED unit; if omitted, computed adaptively from magnitude */
  step?: number
  /** Pixels of horizontal drag per step (default 5) */
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

  const inputRef = useRef<HTMLInputElement | null>(null)
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
      const baseStep = step ?? getAdaptiveStep(displayValue)
      const mult = e.shiftKey ? 10 : e.altKey ? 0.1 : 1
      const effectiveStep = baseStep * mult
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

    const pointerId = e.pointerId
    const startX = e.clientX
    const startDisplay = displayValue
    const baseStep = step ?? getAdaptiveStep(displayValue)
    const toBase = activeUnit.toBase
    let lastBase = value

    setScrubbing(true)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'

    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      cleanupScrubRef.current = null
      window.removeEventListener('pointermove', onWindowMove)
      window.removeEventListener('pointerup', onWindowUp)
      window.removeEventListener('pointercancel', onWindowUp)
      window.removeEventListener('blur', finish)

      setScrubbing(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      onScrubEndRef.current?.(lastBase)
    }

    const onWindowMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) {
        finish()
        return
      }
      const dx = ev.clientX - startX
      const mult = ev.shiftKey ? 10 : ev.altKey ? 0.1 : 1
      const effectiveStep = baseStep * mult
      const stepsMoved = Math.round(dx / dragPixelsPerStep)
      const nextDisplay = roundClean(
        startDisplay + stepsMoved * effectiveStep,
        effectiveStep,
      )
      const nextBase = clampBase(nextDisplay * toBase)
      if (Math.abs(nextBase - lastBase) > 1e-9) {
        lastBase = nextBase
        onChangeRef.current(nextBase)
      }
    }

    const onWindowUp = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return
      finish()
    }

    cleanupScrubRef.current = finish
    window.addEventListener('pointermove', onWindowMove)
    window.addEventListener('pointerup', onWindowUp)
    window.addEventListener('pointercancel', onWindowUp)
    window.addEventListener('blur', finish)
  }

  const cycleUnit = () => {
    if (!units || units.length < 2 || disabled) return
    const idx = units.findIndex((u) => u.id === activeUnit.id)
    const next = units[(idx + 1) % units.length]
    setUnitId(next.id)
  }

  const hasUnitSwitcher = Boolean(units && units.length > 1)

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
      {/* Left Figma-style horizontal scrub handle */}
      <div
        role="slider"
        aria-label={`Ajuster ${ariaLabel} par glissement horizontal`}
        aria-valuenow={Math.round(displayValue * 1000) / 1000}
        aria-valuemin={Number.isFinite(min) ? min / activeUnit.toBase : undefined}
        aria-valuemax={Number.isFinite(max) ? max / activeUnit.toBase : undefined}
        tabIndex={-1}
        onPointerDown={handleScrubDown}
        title="Glisser horizontalement pour ajuster (Shift ×10 · Alt ×0,1)"
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
          <span className="font-mono text-[10px] font-medium leading-none">
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
        value={focused ? draft : formatDisplayValue(displayValue)}
        onFocus={(e) => {
          setDraft(formatDisplayValue(displayValue))
          setFocused(true)
          const el = e.currentTarget
          window.requestAnimationFrame(() => el.select())
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={handleKeyDown}
        aria-label={ariaLabel}
        className="h-full min-w-0 flex-1 bg-transparent px-1.5 font-mono text-[11px] tabular-nums text-foreground focus:outline-none"
      />

      {/* Right unit badge / switcher */}
      {activeUnit.label &&
        (hasUnitSwitcher ? (
          <button
            type="button"
            disabled={disabled}
            onClick={cycleUnit}
            title="Cliquer pour changer d’unité"
            className="h-full shrink-0 whitespace-nowrap border-l border-border/50 px-1.5 font-mono text-[9.5px] text-muted-foreground hover:bg-accent/60 hover:text-foreground"
          >
            {activeUnit.label}
          </button>
        ) : (
          <span className="shrink-0 whitespace-nowrap pr-1.5 font-mono text-[9.5px] text-muted-foreground select-none">
            {activeUnit.label}
          </span>
        ))}
    </div>
  )
}
