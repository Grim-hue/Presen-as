import { useEffect, useRef } from 'react'

/**
 * Whether the keys are being read on an Apple machine.
 *
 * Consulted for labels only — Kbd uses it to draw ⌘ where Windows draws Ctrl — and
 * never for behaviour: "mod" below matches either key, so the shortcut works with
 * whichever of the two the keyboard in front of the user actually has. A platform
 * does not change mid-session, so a constant read once is enough.
 */
export const isMac = /mac|iphone|ipad/i.test(
  (navigator as { userAgentData?: { platform?: string } }).userAgentData?.platform ??
    navigator.platform ??
    ''
)

/** The spellings a combo may use for keys whose `event.key` is spelled differently. */
const ALIASES: Record<string, string> = { esc: 'escape', space: ' ' }

/** One key combination, broken into the parts `event` reports separately. */
interface Combo {
  mod: boolean
  shift: boolean
  alt: boolean
  /** The printed key, lowercased, or '' when the combo is modifiers only. */
  key: string
  /**
   * Whether the key is punctuation ('?'), which a keyboard layout reaches through
   * its own shift and alt keys. Those belong to the layout, not to the person, so
   * they are not compared — '?' has to work wherever the keyboard happens to keep it.
   */
  loose: boolean
}

export function parseCombo(combo: string): Combo {
  const parts = combo.split('+').map((part) => part.trim().toLowerCase())
  const key = ALIASES[parts[parts.length - 1]] ?? parts[parts.length - 1] ?? ''
  return {
    mod: parts.includes('mod'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    key,
    loose: key.length === 1 && !/[a-z0-9]/.test(key)
  }
}

/**
 * What each part of a combo is called on screen, in the order it is pressed.
 *
 * Lives beside the matching above rather than in Kbd, so a key that one learns to
 * match is impossible for the other to fail to name.
 */
export function keyLabels(combo: string): string[] {
  return combo.split('+').map((part) => {
    const key = part.toLowerCase()
    if (key === 'mod') return isMac ? '⌘' : 'Ctrl'
    if (key === 'shift') return isMac ? '⇧' : 'Shift'
    if (key === 'alt') return isMac ? '⌥' : 'Alt'
    if (key === 'enter') return isMac ? '↵' : 'Enter'
    if (key === 'escape' || key === 'esc') return isMac ? '⎋' : 'Esc'
    if (key === 'arrowleft') return '←'
    if (key === 'arrowright') return '→'
    if (key === 'space') return 'Space'
    return key.length === 1 ? key.toUpperCase() : key
  })
}

/**
 * A combo as one line of text, for a tooltip or a title beside the button that
 * carries it: "⌘K" where the machine is Apple's, "Ctrl+K" where it is not.
 */
export function comboText(combo: string): string {
  return keyLabels(combo).join(isMac ? '' : '+')
}

/**
 * Calls [handler] when [combo] is pressed.
 *
 * Combos are written 'mod+k', 'arrowleft', '?': "mod" is either Meta or Ctrl, so one
 * spelling serves both platforms and either hand, and only the chip drawn beside it
 * says which. A punctuation key is matched on the printed character alone, because
 * the modifiers that produce it belong to the keyboard layout.
 *
 * A bare key is ignored while the focus is in a field someone is typing into — a
 * calendar cannot steal the arrow out of a note — but a combo with "mod" is not:
 * saving the dialog whose field has the focus is the one moment it is wanted.
 *
 * The handler is held in a ref, so call sites can pass an inline closure without
 * re-subscribing on every render; [enabled] is how a view scopes a key to the tab
 * or the screen where it means something.
 */
export function useHotkey(
  combo: string,
  handler: (e: KeyboardEvent) => void,
  opts: { enabled?: boolean } = {}
) {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })

  const enabled = opts.enabled ?? true
  useEffect(() => {
    if (!enabled) return
    const parsed = parseCombo(combo)
    const onKey = (e: KeyboardEvent) => {
      // Held keys repeat; a stepper that machine-gunned on a held arrow would be a
      // cursor that could not be aimed.
      if (e.repeat) return
      if (!parsed.loose) {
        if (parsed.mod !== (e.metaKey || e.ctrlKey)) return
        if (parsed.shift !== e.shiftKey) return
        if (parsed.alt !== e.altKey) return
      }
      if (parsed.key && e.key.toLowerCase() !== parsed.key) return
      if (!parsed.mod) {
        const t = e.target as HTMLElement | null
        if (
          t &&
          (t.tagName === 'INPUT' ||
            t.tagName === 'TEXTAREA' ||
            t.tagName === 'SELECT' ||
            t.isContentEditable)
        ) {
          return
        }
      }
      // The combination was ours, so whatever the browser would have done with it
      // — and Cmd+keys have assignments of their own — is not what the person meant.
      e.preventDefault()
      ref.current(e)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [combo, enabled])
}
