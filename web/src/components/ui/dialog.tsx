import * as Primitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { usePrefersReducedMotion } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * A modal for work that needs a few fields and a decision.
 *
 * Radix handles what is easy to get wrong by hand: focus moves in and is trapped,
 * Escape and the backdrop close it, focus returns to whatever opened it, and the
 * rest of the page is hidden from screen readers while it is open.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 460,
  bare = false,
  onSubmit
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  /**
   * Drops the header and the body's padding, leaving the caller the whole surface.
   *
   * For the one modal that is not a few fields and a decision: the command palette,
   * whose first row is its own search box and whose list runs to the edges. The title
   * is still rendered, just only to a screen reader — Radix requires one, and a modal
   * that announces nothing is a modal nobody blind can place.
   */
  bare?: boolean
  /**
   * The primary action, reached with mod+Enter.
   *
   * Not the form's own submit — each dialog decides what "done" means and passes a
   * closure that already carries its busy and validity guards, so the key can never
   * do more than the button beside it does. Listened for here on the dialog surface
   * rather than on the window, so it exists only while this dialog is the one open,
   * and Radix's focus trap is what guarantees the focus it reads is inside.
   */
  onSubmit?: () => void
}) {
  const reduced = usePrefersReducedMotion()
  return (
    <Primitive.Root open={open} onOpenChange={onOpenChange}>
      <Primitive.Portal>
        <Primitive.Overlay className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[1px]" />
        <Primitive.Content
          onKeyDown={(e) => {
            if (onSubmit && (e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault()
              onSubmit()
            }
          }}
          // Without a Description, Radix warns unless the association is
          // explicitly cleared.
          {...(description ? {} : { 'aria-describedby': undefined })}
          style={{ width }}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[85vh] w-full max-w-[calc(100vw-32px)]',
            '-translate-x-1/2 -translate-y-1/2 overflow-auto',
            // Centred by the animation, not only by the translate utilities above:
            // those are the fallback for when the animation does not run.
            'animate-rise-centred rounded-md border border-line bg-card shadow-2xl'
          )}
        >
          {bare ? (
            <>
              <Primitive.Title className="sr-only">{title}</Primitive.Title>
              {description && <Primitive.Description className="sr-only">{description}</Primitive.Description>}
            </>
          ) : (
            <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
              <div>
                <Primitive.Title className="text-sm font-semibold text-fg-strong">{title}</Primitive.Title>
                {description && (
                  <Primitive.Description className="mt-1 text-xs text-fg-muted">
                    {description}
                  </Primitive.Description>
                )}
              </div>
              <Primitive.Close
                aria-label="Fechar"
                className="rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
              >
                <X size={15} strokeWidth={1.8} />
              </Primitive.Close>
            </div>
          )}

          {/*
            * The body carries the resize, so a modal whose contents change size moves
            * its own edge rather than snapping to a new one. Answering the last swap
            * in the bell, or stepping between the questions of a trade, is the same
            * box becoming a different size — which is the thing that says it is still
            * the box you opened. Material calls it a container transform.
            *
            * On the body rather than on the Content: the Content is centred with a
            * transform that the entrance animation owns for the whole life of the
            * element, and a layout animation there would be measuring against it.
            * Height changes here recentre for free, because the translate is a
            * proportion of the element's own size.
            */}
          <motion.div
            layout={!reduced}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className={bare ? '' : 'px-5 pb-4'}
          >
            {children}
          </motion.div>

          {footer && (
            <div className="flex justify-end gap-2 border-t border-line-soft px-5 py-3.5">{footer}</div>
          )}
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
