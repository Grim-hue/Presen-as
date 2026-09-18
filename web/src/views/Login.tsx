import { Eye, Lock, User as UserIcon } from 'lucide-react'
import { useRef, useState, type FormEvent } from 'react'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Card } from '@/components/ui/card'
import { GravityParticles } from '@/components/ui/gravity-particles'
import { Input, Label } from '@/components/ui/input'
import { Orb } from '@/components/ui/orb'
import { useAuth } from '@/context/AuthContext'
import { errorText } from '@/lib/useAsync'
import { cn } from '@/lib/utils'

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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [shown, setShown] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  /** The form, for the dust to gather around and be thrown off. */
  const card = useRef<HTMLDivElement>(null)
  /** How many sign ins have been refused on this screen. Each one is a throw. */
  const [refused, setRefused] = useState(0)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await signIn(username, password)
    } catch (e) {
      setError(errorText(e))
      setRefused((n) => n + 1)
      setBusy(false)
    }
  }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden bg-bg">
      {/* The background is the page colour, a light behind the form, and points of
          the theme's ink drifting over both. The light comes up a little while a sign
          in is being checked, in step with the dust gathering in. Nothing here takes a
          click, so the form is still the only thing on the screen that answers one. */}
      <div
        aria-hidden="true"
        className={cn(
          'login-glow pointer-events-none absolute inset-0 transition-opacity duration-700',
          busy ? 'opacity-100' : 'opacity-75'
        )}
      />
      <GravityParticles
        anchor={card}
        gather={busy}
        scatter={refused}
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      <div ref={card} className="relative w-[376px] animate-rise">
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

              {/* The wait with the least to show for itself: one field, one button,
                  and a server that either knows you or does not. `connecting` is the
                  orb that wires a constellation together, which is the shape of what
                  is actually happening behind it. */}
              <button
                type="submit"
                disabled={busy || !username || !password}
                className="flex h-[38px] w-full items-center justify-center gap-2 rounded bg-accent font-mono text-[12.5px] font-semibold tracking-[0.03em] text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-45"
              >
                {busy && <Orb state="connecting" label="A entrar" onAccent />}
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
          the screen and these sit at the edge of it, which is the order they should be
          read in. */}
      <img src="/pse-logo.png" alt="PSE" className="pse-mark absolute bottom-6 left-6 h-[17px] w-auto" />
      <span className="absolute bottom-6 right-6 font-mono text-[9.5px] tracking-[0.06em] text-fg-faint">
        v{__APP_VERSION__}
      </span>
    </div>
  )
}
