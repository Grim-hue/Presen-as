import { cva, type VariantProps } from 'class-variance-authority'
import type * as React from 'react'
import { cn } from '@/lib/utils'

const badge = cva(
  'inline-flex h-[21px] items-center gap-1.5 rounded border px-[7px] font-mono ' +
    'text-[10.5px] font-medium tracking-[0.02em] whitespace-nowrap',
  {
    variants: {
      tone: {
        muted: 'border-line bg-[var(--mtbg)] text-fg-muted',
        // Emphasis by inversion rather than by hue, so it reads in both themes.
        accent: 'border-accent bg-accent text-accent-fg',
        ok: 'border-ok-line bg-ok-bg text-ok',
        warn: 'border-warn-line bg-warn-bg text-warn',
        danger: 'border-danger-line bg-danger-bg text-danger',
        info: 'border-info-line bg-info-bg text-info'
      }
    },
    defaultVariants: { tone: 'muted' }
  }
)

export function Badge({
  className,
  tone,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badge>) {
  return <span className={cn(badge({ tone, className }))} {...props} />
}
