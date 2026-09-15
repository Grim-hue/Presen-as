import { Fragment } from 'react'
import { isMac, keyLabels } from '@/lib/hotkey'
import { cn } from '@/lib/utils'

/**
 * A key combination, as it is pressed on this machine.
 *
 * Takes the same string useHotkey takes — '<Kbd combo="mod+enter" />' beside a
 * binding of 'mod+enter' — and both read it with the same parser, so the chip can
 * never disagree with the binding, and the modifier is drawn as ⌘ or Ctrl after
 * whichever platform is watching. One chip per key, in the order they are pressed.
 */
export function Kbd({ combo, className }: { combo: string; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)} aria-hidden>
      {keyLabels(combo).map((label, i) => (
        <Fragment key={i}>
          {/* Joined with a plus where the keys are spelled out, and with nothing
              where they are symbols: ⌘K is one gesture, Ctrl+K is two names. */}
          {i > 0 && !isMac && <span className="text-[9px] text-fg-faint">+</span>}
          <kbd
            className={cn(
              'inline-flex h-[19px] min-w-[19px] items-center justify-center rounded border',
              'border-line bg-elev px-1.5 font-mono text-[10px] font-medium text-fg-muted'
            )}
          >
            {label}
          </kbd>
        </Fragment>
      ))}
    </span>
  )
}
