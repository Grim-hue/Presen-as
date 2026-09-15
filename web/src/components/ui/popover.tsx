import * as Primitive from '@radix-ui/react-popover'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A panel hung off the control that opens it.
 *
 * The third surface, after the dialog and the hover label, and it exists for the
 * choice that is too big for the bar it lives in and too small to stop the page for.
 * A dialog would: it takes the screen, and the whole reason the email page is a page
 * is that the answer has to stay visible while the question is being asked. So this is
 * deliberately **not modal** — the preview behind it goes on rendering, and clicking
 * into it closes the panel and does what was clicked.
 *
 * The surface is the card, matching `tooltip.tsx` and the dialog, for the reason given
 * there: `--elev` is darker than the card in the light theme and reads as a hole in
 * the page rather than as something floating over it.
 */
export function Popover({ trigger, children, align = 'start', side = 'bottom' }: {
  trigger: ReactNode
  children: ReactNode
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{trigger}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          align={align}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 rounded-md border border-line bg-card p-3 shadow-lg',
            'data-[state=open]:animate-rise'
          )}
        >
          {/* Bounded by the room the popper actually found rather than by a number
              chosen here, the way the hover label is: a panel that runs past the edge
              of the window cannot be reached at the bottom. */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: 'min(420px, var(--radix-popper-available-height, 420px))' }}
          >
            {children}
          </div>
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
