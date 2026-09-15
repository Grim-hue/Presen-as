import * as Primitive from '@radix-ui/react-tooltip'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export const TooltipProvider = Primitive.Provider

/**
 * A hover label that appears at once.
 *
 * The native `title` attribute would do the same job, but it waits about a second
 * before showing, cannot be styled, and arrives in the operating system's own
 * colours, which reads as a foreign object on a dark page.
 *
 * The surface is the card, matching the dialog. `--elev` names elevation but is a
 * darker grey than the card in the light theme, so a popover painted with it read as
 * a hole in the page rather than as something floating above it.
 */
export function Tooltip({
  content,
  children,
  side = 'top'
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}) {
  if (!content) return <>{children}</>
  return (
    <Primitive.Root>
      <Primitive.Trigger asChild>{children}</Primitive.Trigger>
      <Primitive.Portal>
        <Primitive.Content
          side={side}
          sideOffset={6}
          collisionPadding={8}
          className={cn(
            'z-50 max-w-[240px] rounded border border-line bg-card px-2.5 py-2',
            'text-[11.5px] leading-snug text-fg shadow-lg',
            'data-[state=delayed-open]:animate-rise data-[state=instant-open]:animate-rise'
          )}
        >
          {/* Bounded and scrolled on the inside, so the arrow stays put against the
              trigger while a long label moves. A day with forty people on it made a
              label taller than the window, and the popper could only answer by
              pushing the top of it off the screen, where it could not be read or
              reached.

              The ceiling is whatever room the popper actually found, not a number
              chosen here: `--radix-popper-available-height` is the distance from the
              trigger to the edge of the window on the side it opened, so the label
              can never reach past it however it is placed. The 280px is the smaller
              limit of the two, because a hover label that fills the window is its own
              kind of broken — it covers the days either side of the one being read. */}
          <div
            className="overflow-y-auto overscroll-contain"
            style={{ maxHeight: 'min(280px, var(--radix-popper-available-height, 280px))' }}
          >
            {content}
          </div>
          <Primitive.Arrow className="fill-[var(--card)]" width={9} height={4} />
        </Primitive.Content>
      </Primitive.Portal>
    </Primitive.Root>
  )
}
