import { cn } from '@/lib/utils'

export function DeltaLabLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-6 w-6 shrink-0', className)}
    >
      <rect width="32" height="32" rx="7.5" fill="#09090b" />
      <rect
        x="0.75"
        y="0.75"
        width="30.5"
        height="30.5"
        rx="6.75"
        stroke="#27272e"
        strokeWidth="1.5"
      />
      <path
        d="M12.5 6.8 H19.5 M14 6.8 V11.2 L7.2 23.5 Q6.4 25 8.1 25 H23.9 Q25.6 25 24.8 23.5 L18 11.2 V6.8"
        stroke="#f4f4f5"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11.6 19.2 H20.4 L22.1 22.4 Q22.4 23 21.7 23 H10.3 Q9.6 23 9.9 22.4 Z"
        fill="#f4f4f5"
      />
    </svg>
  )
}
