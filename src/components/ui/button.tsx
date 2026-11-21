import type { ButtonHTMLAttributes, Ref } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { type VariantProps, cva } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonStyles = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40 select-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'bg-secondary text-secondary-foreground border border-border hover:bg-accent',
        outline: 'border border-border bg-transparent text-foreground hover:bg-accent',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
        destructive:
          'border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[11px]',
        icon: 'h-7 w-7 p-0',
        'icon-sm': 'h-6 w-6 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean
  ref?: Ref<HTMLButtonElement>
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...rest
}: ButtonProps) {
  const Element = asChild ? Slot : 'button'
  return (
    <Element
      type={asChild ? undefined : type}
      className={cn(buttonStyles({ variant, size }), className)}
      {...rest}
    />
  )
}
