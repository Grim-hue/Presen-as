import * as React from 'react'
import { cn } from '@/lib/utils'

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-[34px] w-full rounded border border-line bg-field px-3 text-[13px] text-fg-strong',
        'placeholder:text-fg-soft disabled:opacity-50',
        className
      )}
      {...props}
    />
  )
)
Input.displayName = 'Input'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        'mb-[7px] block font-mono text-[9.5px] font-semibold tracking-[0.13em] text-fg-soft',
        className
      )}
      {...props}
    />
  )
}

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'h-[31px] rounded border border-line bg-transparent px-2.5 font-mono text-xs text-fg',
        'hover:text-fg-strong',
        className
      )}
      {...props}
    />
  )
)
Select.displayName = 'Select'
