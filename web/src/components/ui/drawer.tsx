import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A panel that comes in from the edge of the window.
 *
 * The same Radix dialog as [Dialog] and for the same reasons: focus moves in and is
 * trapped, Escape and the backdrop close it, focus returns to whatever opened it,
 * and the page behind is hidden from screen readers while it is open. Only the
 * shape differs, so the two share the primitive rather than one wrapping the other.
 *
 * It exists for the navigation column on a narrow window, where the column cannot
 * hold its place beside the page and a centred modal is the wrong shape for a list
 * that is a fixed part of the furniture at every other width.
 */
export function Drawer({ open, onOpenChange, title, children, width = 262 }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Names the panel for assistive technology. The panel itself shows no heading. */
  title: string
  children: ReactNode
  width?: number
}) {
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]" />
        <Primitive.Content
          // Without a Description, Radix warns unless the association is
          // explicitly cleared.
          aria-describedby={undefined}
          style={{ width }}
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex max-w-[calc(100vw-48px)] flex-col',
            'animate-slide-in border-r border-line bg-side'
          )}
        >
          <Primitive.Title className="sr-only">{title}</Primitive.Title>
          <Primitive.Close
            aria-label="Fechar"
            className="absolute right-2 top-2 rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
          >
            <X size={15} strokeWidth={1.8} />
          </Primitive.Close>
          {children}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
