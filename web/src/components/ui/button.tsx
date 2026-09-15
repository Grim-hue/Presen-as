import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const button = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded font-mono font-medium ' +
    'transition-colors disabled:pointer-events-none disabled:opacity-45',
  {
    variants: {
      variant: {
        default: 'bg-accent text-accent-fg hover:opacity-90',
        outline: 'border border-line text-fg hover:bg-[var(--hover2)] hover:text-fg-strong',
        ghost: 'text-fg-muted hover:bg-[var(--hover2)] hover:text-fg-strong',
        danger: 'border border-danger-line bg-danger-bg text-danger hover:opacity-90'
      },
      size: {
        default: 'h-[31px] px-3 text-xs',
        sm: 'h-7 px-2.5 text-[11px]',
        icon: 'h-7 w-7 p-0'
      }
    },
    defaultVariants: { variant: 'outline', size: 'default' }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return <Comp className={cn(button({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = 'Button'
