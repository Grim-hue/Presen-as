import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * [minWidth] is the width the columns were laid out for. Below it the wrapper
 * scrolls. Without it a table-fixed layout keeps compressing the columns instead,
 * until the text in one lands on top of the next.
 */
export function Table({
  className,
  minWidth = 640,
  ...props
}: React.TableHTMLAttributes<HTMLTableElement> & { minWidth?: number }) {
  return (
    <div className="min-h-0 w-full flex-1 overflow-auto">
      <table
        className={cn('w-full border-collapse', className)}
        style={{ minWidth: `${minWidth}px` }}
        {...props}
      />
    </div>
  )
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        // Sticky so the columns stay named while a long table scrolls. The rule
        // underneath is an inset shadow rather than a border: with
        // border-collapse a border on a sticky cell is painted by the table and
        // scrolls away from the cell it belongs to.
        'sticky top-0 z-10 bg-card px-3.5 pb-2.5 pt-3.5 text-left align-bottom',
        'font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fg-muted',
        'shadow-[inset_0_-1px_0_var(--line)]',
        className
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={cn('border-t border-line-soft px-3.5 py-2.5 text-[12.5px] align-middle [tr:first-child_&]:border-t-0', className)} {...props} />
  )
}

export function Tr({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('hover:bg-[var(--row)]', className)} {...props} />
}
