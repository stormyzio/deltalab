import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  size?: 'sm' | 'md'
  ariaLabel?: string
  className?: string
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  size = 'sm',
  ariaLabel,
  className,
}: SwitchProps) {
  const isSm = size === 'sm'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        'relative inline-flex shrink-0 items-center rounded-full border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-45',
        isSm ? 'h-4 w-7 p-[2px]' : 'h-[18px] w-8 p-[2px]',
        checked
          ? 'border-zinc-200 bg-zinc-200'
          : 'border-zinc-700 bg-zinc-800/90 hover:border-zinc-600',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none block rounded-full transition-transform duration-150 ease-out',
          isSm ? 'h-2.5 w-2.5' : 'h-3 w-3',
          checked
            ? cn('bg-zinc-950', isSm ? 'translate-x-3' : 'translate-x-3.5')
            : 'translate-x-0 bg-zinc-400',
        )}
      />
    </button>
  )
}

interface DualSwitchProps {
  leftLabel: string
  rightLabel: string
  /** false = left active, true = right active */
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  ariaLabel?: string
  className?: string
}

export function DualSwitch({
  leftLabel,
  rightLabel,
  checked,
  onCheckedChange,
  disabled = false,
  ariaLabel,
  className,
}: DualSwitchProps) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 select-none',
        disabled && 'opacity-45',
        className,
      )}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={() => onCheckedChange(false)}
        className={cn(
          'whitespace-nowrap text-[11px] font-medium',
          !checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {leftLabel}
      </button>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={ariaLabel ?? `${leftLabel} / ${rightLabel}`}
        disabled={disabled}
        onClick={() => onCheckedChange(!checked)}
        className="relative inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-zinc-700 bg-zinc-800/90 p-[2px] hover:border-zinc-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none block h-2.5 w-2.5 rounded-full bg-zinc-200 transition-transform duration-150 ease-out',
            checked ? 'translate-x-3' : 'translate-x-0',
          )}
        />
      </button>

      <button
        type="button"
        disabled={disabled}
        onClick={() => onCheckedChange(true)}
        className={cn(
          'whitespace-nowrap text-[11px] font-medium',
          checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        )}
      >
        {rightLabel}
      </button>
    </div>
  )
}
