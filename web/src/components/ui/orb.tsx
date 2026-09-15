import { useReducedMotion } from 'motion/react'
import { ThinkingOrb, type OrbState } from 'thinking-orbs'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * The one thing in this application that moves while it waits.
 *
 * Everywhere else, waiting is a skeleton holding the row heights it is about to be
 * replaced by, and that is still the rule: a skeleton says how much is coming and
 * where it will sit. It says nothing at all about a wait with no shape — generating a
 * rotation, publishing, composing a message — where there is one button, no incoming
 * layout to hold, and the honest question is only whether the thing is still working.
 *
 * `thinking-orbs` draws that, and it is the one loop in the application. §8 of
 * AGENTS.md says motion is entrance only and nothing loops; this is the exception and
 * is named there. It opts out of `prefers-reduced-motion` itself rather than relying
 * on the CSS rule, because a canvas is not reached by a stylesheet.
 *
 * [onAccent] is which ground it stands on, and it is not decoration: the library
 * draws light ink for a dark surface and dark ink for a light one, and this
 * application's accent is white on the dark theme and near black on the light one. An
 * orb inside a filled button therefore wants the opposite of the page it is on, or it
 * is a white orb on white.
 */
export function Orb({ state, size = 20, label, onAccent = false, className }: {
  state: OrbState
  size?: 20 | 64
  /** What it is waiting for, for anybody who cannot see it turning. */
  label: string
  onAccent?: boolean
  className?: string
}) {
  const { theme } = useTheme()
  const still = useReducedMotion()
  const ground = onAccent ? (theme === 'dark' ? 'light' : 'dark') : theme
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={ground}
      paused={still ?? false}
      role="img"
      aria-label={label}
      className={cn('shrink-0', className)}
    />
  )
}
