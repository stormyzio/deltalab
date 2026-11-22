import { type KeyboardEvent as ReactKeyboardEvent, useState } from 'react'
import { cn } from '@/lib/utils'

export interface InlineUnitOption {
  id: string
  label: string
  /** Multiply displayed value by this factor to obtain base value */
  toBase: number
  decimals?: number
}

interface InlineNumberInputProps {
  /** Value in base unit */
  value: number
  onChange: (nextBaseValue: number) => void
  min: number
  max: number
  step?: number
  decimals?: number
  /** Static suffix unit (e.g. "°C", "%", "bar", "mmol") */
  unit?: string
  /** Optional switchable units (e.g. mL / L) */
  units?: InlineUnitOption[]
  defaultUnitId?: string
  disabled?: boolean
  ariaLabel: string
  /** Fixed width class for the numeric input itself (e.g. "w-[4.5ch]") */
  inputWidthClass?: string
  className?: string
}

function formatNumberFr(val: number, decimals: number): string {
  if (!Number.isFinite(val)) return '0'
  const rounded = Number(val.toFixed(decimals))
  return String(rounded).replace('.', ',')
}

function parseNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s+/g, '').replace(/,/g, '.')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function InlineNumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  unit,
  units,
  defaultUnitId,
  disabled = false,
  ariaLabel,
  inputWidthClass = 'w-[5ch]',
  className,
}: InlineNumberInputProps) {
  const [unitId, setUnitId] = useState<string>(() => {
    if (!units || units.length === 0) return ''
    if (defaultUnitId && units.some((u) => u.id === defaultUnitId)) {
      return defaultUnitId
    }
    return units[0].id
  })
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState('')

  const activeUnit: InlineUnitOption =
    units && units.length > 0
      ? (units.find((u) => u.id === unitId) ?? units[0])
      : { id: 'default', label: unit ?? '', toBase: 1, decimals }

  const activeDecimals = activeUnit.decimals ?? decimals
  const displayValue = activeUnit.toBase > 0 ? value / activeUnit.toBase : value
  const formatted = formatNumberFr(displayValue, activeDecimals)

  const clampBase = (rawBase: number) => Math.max(min, Math.min(max, rawBase))

  const commit = () => {
    setFocused(false)
    const parsed = parseNumber(draft)
    if (parsed === null) return
    const nextBase = clampBase(parsed * activeUnit.toBase)
    if (Math.abs(nextBase - value) > 1e-9) {
      onChange(nextBase)
    }
  }

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
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
      const stepInDisplay =
        activeUnit.toBase !== 1 ? step / activeUnit.toBase : step
      const nextBase = clampBase((displayValue + dir * stepInDisplay) * activeUnit.toBase)
      setDraft(formatNumberFr(nextBase / activeUnit.toBase, activeDecimals))
      onChange(nextBase)
    }
  }

  const hasUnitSwitcher = Boolean(units && units.length > 1)
  const maxUnitChars =
    units && units.length > 0
      ? Math.max(...units.map((u) => u.label.length))
      : (activeUnit.label?.length ?? 0)

  const cycleUnit = () => {
    if (!units || units.length < 2 || disabled) return
    const idx = units.findIndex((u) => u.id === activeUnit.id)
    setUnitId(units[(idx + 1) % units.length].id)
  }

  return (
    <span
      className={cn(
        'inline-flex h-[22px] shrink-0 items-center rounded border px-1 text-[11px] tabular-nums',
        focused
          ? 'border-zinc-500 bg-card text-foreground'
          : 'border-border/60 bg-card/55 text-foreground hover:border-zinc-600 hover:bg-card',
        disabled && 'opacity-50',
        className,
      )}
    >
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        aria-label={ariaLabel}
        value={focused ? draft : formatted}
        onFocus={(e) => {
          setFocused(true)
          setDraft(formatted)
          requestAnimationFrame(() => e.target.select())
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        className={cn(
          'h-full bg-transparent text-right text-[11px] tabular-nums text-foreground focus:outline-none',
          inputWidthClass,
        )}
      />
      {activeUnit.label &&
        (hasUnitSwitcher ? (
          <button
            type="button"
            disabled={disabled}
            onClick={cycleUnit}
            title="Cliquer pour changer d’unité"
            aria-label={`Unité : ${activeUnit.label}`}
            style={{ minWidth: `${maxUnitChars}ch` }}
            className="ml-1 inline-flex items-center justify-center rounded px-0.5 text-[10px] text-muted-foreground hover:bg-accent/70 hover:text-foreground disabled:pointer-events-none"
          >
            {activeUnit.label}
          </button>
        ) : (
          <span className="ml-0.5 select-none text-[10px] text-muted-foreground">
            {activeUnit.label}
          </span>
        ))}
    </span>
  )
}
