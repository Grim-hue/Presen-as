import * as Primitive from '@radix-ui/react-dropdown-menu'
import { MoreHorizontal } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The actions a row can take, behind one control.
 *
 * A row used to end in a button per action, which was fine at two and became a
 * toolbar at five: three of them only apply to some rows, so the column was a
 * different width of nothing on every line and the icons had to be read before they
 * could be told apart. A menu names each action in words instead, and costs the row
 * one button.
 *
 * Radix owns what is easy to get wrong: the roving focus, Escape, the click outside,
 * typeahead, and returning focus to the trigger on the way out.
 */
export function Menu({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Primitive.Root>
      <Primitive.Trigger
        aria-label={label}
        className={cn(
          'inline-flex h-[26px] w-[26px] items-center justify-center rounded',
          'text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong',
          'data-[state=open]:bg-[var(--hover2)] data-[state=open]:text-fg-strong'
        )}
      >
        <MoreHorizontal size={15} strokeWidth={1.8} />
      </Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          align="end"
          sideOffset={4}
          className={cn(
            'z-50 min-w-[190px] overflow-hidden rounded-md border border-line bg-card py-1 shadow-2xl',
            'animate-rise'
          )}
        >
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}

export function MenuItem({ onSelect, danger = false, disabled = false, children }: {
  onSelect: () => void
  danger?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Primitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 px-3 py-[6px] text-[12.5px] outline-none',
        'data-[highlighted]:bg-[var(--hover2)]',
        'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
        danger ? 'text-danger' : 'text-fg'
      )}
    >
      {children}
    </Primitive.Item>
  )
}

export function MenuSeparator() {
  return <Primitive.Separator className="my-1 h-px bg-line-soft" />
}
