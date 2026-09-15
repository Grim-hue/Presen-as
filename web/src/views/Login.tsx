import { Eye, Lock, User as UserIcon } from 'lucide-react'
import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Card } from '@/components/ui/card'
import { Input, Label } from '@/components/ui/input'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '@/lib/useAsync'

/*
 * Wide enough that the diamond still covers the corners of a large screen once the
 * plane is rotated.
 *
 * This is a count, not a size: twenty six tiles at the 48px pitch in index.css reach
 * exactly as far as the thirty five smaller ones they replaced, so the plane covers
 * the same screen out of half as many pieces. Change the pitch there and this has to
 * move with it, which is why the grid takes the count from here rather than keeping
 * its own copy.
 */
const COLS = 26
const ROWS = 26

/*
 * How full the field is, and how tall a day is allowed to stand.
 *
 * The share is lower than it looks: it used to be taken over working days only, with
 * two columns in seven ruled out before the roll, and it is now taken over every tile
 * on the plane. Forty five of these is about sixty of those.
 */
const RAISED_IN_HUNDRED = 45
const HEIGHTS = ['12px', '23px', '36px', '50px']

/*
 * A block in eight is on its way up or down rather than standing still.
 *
 * This is the part that stops the plane being a picture of one particular month. A
 * shifting block spends about a third of a long cycle raised and the rest flat, and
 * since each one is offset by its own share of that cycle, some are always going up
 * while others are coming down and most are doing neither.
 *
 * They are excluded from the arrival rather than layered on top of it. A shifting
 * block already starts flat and unfilled, which is exactly where the arrival would
 * have put it, so it needs no entrance of its own and no second delay to sequence one
 * against the other.
 */
const SHIFT_IN_HUNDRED = 12
const SHIFT_CYCLE = 26000

/*
 * About one standing block in ten is never quite still.
 *
 * Sparse because the cost is permanent. The entrance is hundreds of animations that
 * run once and are done; a breathing block is one that never stops, and the plane is
 * behind a form somebody is typing into on a laptop that may also be running the rest
 * of their afternoon.
 */
const BREATHE_IN_HUNDRED = 10

/*
 * A breather waits for the arrival to finish before it starts, then for a share of
 * six seconds more.
 *
 * The wait matters twice. It keeps the two animations off the same property at the
 * same time, and it stops the breathers anywhere on the plane from rising and falling
 * in step, which is the thing that would give the whole effect away as a loop.
 */
const BREATHE_SETTLE = 1500
const BREATHE_SPREAD = 6000

/**
 * A scatter that depends on where the tile is and on nothing else in the render.
 *
 * The seed it is salted with is drawn once per visit, below, and never again. That
 * split is the whole point: the plane is dealt differently every time somebody opens
 * the page, and identically for as long as they are looking at it. Rolling per render
 * instead would move every block on the field behind someone who is halfway through
 * typing a password.
 */
function scatter(index: number) {
  const mixed = Math.imul(index ^ 0x9e3779b9, 2654435761)
  return (mixed ^ (mixed >>> 15)) >>> 0
}

/**
 * The ground plane: the office seen from above and to the side, with the days
 * somebody is in as blocks standing out of it.
 *
 * The heights are scattered rather than real, because nobody at this screen has a
 * session yet, so the plan is not ours to show, and a sign in page that needs a
 * request before it can paint itself is a sign in page that flashes.
 */
function usePlane() {
  return useMemo(() => {
    const seed = (Math.random() * 0x100000000) >>> 0
    const roll = (index: number, salt: number) => scatter((index ^ seed) + salt)

    return Array.from({ length: COLS * ROWS }, (_, index) => {
      const draw = roll(index, 0)
      const height = draw % 100 < RAISED_IN_HUNDRED ? HEIGHTS[draw % HEIGHTS.length] : '0'
      const column = index % COLS
      // The wave starts under the card and runs outwards, so the first blocks arrive
      // where the eye already is. Fewer rings to cross than there were on the finer
      // grid, so each one is held longer and the sweep still takes about the same
      // half second end to end.
      const ring = Math.max(Math.abs(column - (COLS - 1) / 2), Math.abs(Math.floor(index / COLS) - (ROWS - 1) / 2))
      const at = Math.round(ring) * 34 + (draw % 3) * 30

      const life = roll(index, 0x5f356495)
      const shifting = height !== '0' && life % 100 < SHIFT_IN_HUNDRED
      // Only a block that holds still can breathe: a scale that never settles would
      // fight the breath for the same property.
      const steady = height !== '0' && !shifting
      const breathing = steady && (life >>> 7) % 100 < BREATHE_IN_HUNDRED

      return {
        height,
        // A shifter is driven entirely by its own cycle, and where it starts in that
        // cycle is the only thing keeping the field from pulsing as one.
        shift: shifting ? `${(life >>> 3) % SHIFT_CYCLE}ms` : null,
        breathe: breathing ? `${BREATHE_SETTLE + ((life >>> 11) % BREATHE_SPREAD)}ms` : null,
        // Two clocks: a block takes its colour first and starts lifting afterwards.
        fill: `${at}ms`,
        rise: `${at + 90}ms`
      }
    })
  }, [])
}

/*
 * The slash that cuts across the eye, in the icon's own 24x24 space.
 *
 * 3.6 to 20.4 on both axes is 23.8 units of diagonal, which is where the 24 in the
 * .eye-slash rule comes from: the dash is the whole line, so moving the offset from
 * one end of it to nothing draws the line end to end. Both numbers are in the 24x24
 * the path is written in, so neither changes with the size the icon is rendered at.
 */
const SLASH = 'M3.6 3.6 L20.4 20.4'

/**
 * Shows the password, and says so by drawing a line through the eye.
 *
 * lucide has an EyeOff, and swapping the two icons on click is the obvious way to do
 * this and the wrong one: they are two different drawings, so the swap is a cut, and a
 * cut under the finger that just pressed it reads as a flicker rather than as an
 * answer. lucide renders children inside its own <svg>, so the slash is drawn over the
 * Eye instead and the eye never moves. The paths inherit the icon's stroke, its width
 * and its round caps, and nothing here has to know what size it was asked for.
 *
 * Two paths, not one. The first is the colour of the field and twice as wide, so it
 * erases a band of the eye as it travels and the slash reads as cutting through the
 * drawing rather than lying across it. It has to be the field colour and not a token
 * that merely looks like it, which is also why this button has no hover fill: a band
 * painted in the wrong colour would show as a scar.
 *
 * The draw is a CSS transition on the dash offset, keyed off the attribute below,
 * rather than anything driven from script. Every other animation in the application
 * is CSS, one curve, and the reduced-motion rule at the bottom of index.css already
 * covers all of it; a script-driven version would have to opt out of that by hand and
 * would stop dead whenever the tab stopped getting frames.
 */
function Reveal({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const label = shown ? 'Ocultar palavra-passe' : 'Mostrar palavra-passe'

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      data-eye-shown={shown ? '' : undefined}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-soft transition-colors hover:text-fg-strong"
    >
      <Eye size={15} strokeWidth={1.6} aria-hidden="true">
        <path className="eye-slash" d={SLASH} stroke="var(--field)" strokeWidth={3.4} />
        <path className="eye-slash" d={SLASH} />
      </Eye>
    </button>
  )
}

export function Login() {
  const { signIn } = useAuth()
  const plane = usePlane()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username, password)
    } catch (e) {
      setError(errorText(e))
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-bg">
      <div className="iso-sway pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="iso absolute left-1/2 top-1/2" style={{ '--cols': COLS } as CSSProperties}>
          {plane.map((tile, index) =>
            tile.height === '0' ? (
              <div key={index} className="iso-flat" />
            ) : (
              <div
                key={index}
                className="iso-cell"
                data-breathe={tile.breathe ? '' : undefined}
                data-shift={tile.shift ? '' : undefined}
                /*
                 * The height and the delays live on the cell rather than on the block
                 * because the fill and the lift are driven from the two of them
                 * together. A breathing cell runs two animations and so carries two
                 * delays, in the order the animation list in index.css declares them.
                 */
                style={
                  {
                    '--h': tile.height,
                    '--d': tile.shift ?? tile.fill,
                    animationDelay: tile.shift ?? (tile.breathe ? `${tile.rise}, ${tile.breathe}` : tile.rise)
                  } as CSSProperties
                }
              >
                <div className="iso-block" />
              </div>
            )
          )}
        </div>
      </div>
      <div className="iso-scrim pointer-events-none absolute inset-0" aria-hidden="true" />

      <div className="relative w-[376px] animate-rise">
        <Card className="relative overflow-hidden shadow-xl">
          {/* The window chrome: three lights that do nothing, and the one control on
              this screen that is not the form. The lights are hidden from assistive
              technology because they are decoration, which leaves the heading below to
              say what the screen is; the toggle is not, because it does something.

              The strip holds its 32px whatever is in it, and the toggle is pulled out
              of the padding by its own, so the icon lands the same distance from the
              right edge as the first light is from the left.

              The colours come from style rather than from a utility because they are
              the only three in the palette that do not change with the theme, so
              there is no token pair for Tailwind to hold. Same shape as the member and
              commitment colours in lib/utils. */}
          <div className="flex h-8 items-center justify-between border-b border-line bg-elev px-3.5">
            <div aria-hidden="true" className="flex items-center gap-2">
              <span className="h-[10px] w-[10px] rounded-full" style={{ background: 'var(--mac-close)' }} />
              <span className="h-[10px] w-[10px] rounded-full" style={{ background: 'var(--mac-min)' }} />
              <span className="h-[10px] w-[10px] rounded-full" style={{ background: 'var(--mac-zoom)' }} />
            </div>
            <ThemeToggle className="-mr-1.5" />
          </div>

          <div className="px-[30px] pb-[26px] pt-[24px]">
            <h1 className="mb-6 text-[15px] font-semibold text-fg-strong">Iniciar sessão</h1>

            <form onSubmit={submit}>
              <Label htmlFor="username">UTILIZADOR</Label>
              <div className="relative mb-[17px]">
                <UserIcon
                  size={15}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft"
                />
                <Input
                  id="username"
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-[38px] pl-9"
                />
              </div>

              <Label htmlFor="password">PALAVRA-PASSE</Label>
              <div className="relative mb-[17px]">
                <Lock
                  size={15}
                  strokeWidth={1.6}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-soft"
                />
                <Input
                  id="password"
                  type={shown ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-[38px] pl-9 pr-9"
                />
                <Reveal shown={shown} onToggle={() => setShown((v) => !v)} />
              </div>

              {error && (
                <p role="alert" className="mb-3.5 text-[12.5px] text-danger">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !username || !password}
                className="h-[38px] w-full rounded bg-accent font-mono text-[12.5px] font-semibold tracking-[0.03em] text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-45"
              >
                {busy ? 'A ENTRAR' : 'ENTRAR'}
              </button>
              <button
                type="button"
                className="mt-3.5 w-full font-mono text-[11px] tracking-[0.02em] text-fg-soft transition-colors hover:text-fg-strong"
              >
                Esqueceu-se da palavra-passe?
              </button>
            </form>
          </div>
        </Card>
      </div>

      {/* The mark and the build, in the two bottom corners of the screen rather than
          under the card.

          They are the page's footnotes, not the window's: neither has anything to do
          with signing in, and hung off the card they read as part of it and pulled the
          form off centre by their own height. Out here the card sits in the middle of
          the plane and these sit at the edge of it, which is the order they should be
          read in.

          They come after the scrim so they paint over it. The scrim is the page colour
          laid on top of the plane, so anything underneath it comes out washed. */}
      <img src="/pse-logo.png" alt="PSE" className="pse-mark absolute bottom-6 left-6 h-[17px] w-auto" />
      <span className="absolute bottom-6 right-6 font-mono text-[9.5px] tracking-[0.06em] text-fg-faint">
        v{__APP_VERSION__}
      </span>
    </div>
  )
}
