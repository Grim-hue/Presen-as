import { Moon, Sun } from 'lucide-react'
import { useTheme } from '@/context/ThemeContext'
import { cn } from '@/lib/utils'

/**
 * Switches the theme, in the one chrome that is showing.
 *
 * There are two of those and they have nothing else in common: the application
 * header, and the window on the sign in screen, which is the only chrome anyone has
 * before they have a session. Written once here rather than twice, so the icon, the
 * label and the hover cannot drift apart.
 *
 * The icon and the label are the theme it switches *to*, not the one showing. That is
 * what pressing it does, and a moon that means "you are in the dark theme" and a moon
 * that means "go dark" cannot both be right.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const label = theme === 'dark' ? 'Tema claro' : 'Tema escuro'

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className={cn('rounded p-1.5 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong', className)}
    >
      {theme === 'dark' ? <Sun size={15} strokeWidth={1.6} /> : <Moon size={15} strokeWidth={1.6} />}
    </button>
  )
}
