import {
  ArrowLeftRight, CalendarDays, Flag, LayoutDashboard, LogOut, Menu, Plane, Scale, Users,
  type LucideIcon
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { SearchButton } from '@/components/layout/PeopleSearch'
import { SwapBell } from '@/components/layout/SwapBell'
import { ThemeToggle } from '@/components/layout/ThemeToggle'
import { Avatar } from '@/components/ui/avatar'
import { Drawer } from '@/components/ui/drawer'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Exact match only, so the dashboard is not lit up by every other route. */
  end?: boolean
  /** Only an administrator may reach it, so nobody else is shown the way in. */
  admin?: boolean
}

const NAV: { group: string; items: NavItem[] }[] = [
  { group: 'PLANEAMENTO', items: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/plano', label: 'Plano', icon: CalendarDays, admin: true },
    { to: '/balanco', label: 'Balanço', icon: Scale, admin: true },
    { to: '/trocas', label: 'Trocas', icon: ArrowLeftRight }
  ] },
  { group: 'DADOS', items: [
    { to: '/ferias', label: 'Férias', icon: Plane },
    { to: '/equipa', label: 'Equipa', icon: Users, admin: true },
    { to: '/feriados', label: 'Feriados', icon: Flag }
  ] }
]

export function Shell({ title, actions, children }: {
  title: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  const { user, signOut } = useAuth()
  const { pathname } = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  // A section that loses every item loses its heading with it, so the column can
  // never show a label with nothing under it.
  const nav = NAV
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.admin || user?.isAdmin)
    }))
    .filter((section) => section.items.length > 0)

  /*
   * The column itself, written once and rendered twice: in place beside the page on
   * a window wide enough to hold it, and inside the drawer on one that is not. The
   * two are the same list of links to the same pages, and a second copy of it would
   * be a second place to forget.
   */
  const column = (
    <>
      {/* The house lockup. The mark and the sigla are gone and the expansion that
          used to explain them underneath is now the lockup itself: PPI told a first
          time reader nothing that the four words did not, and the four words needed
          no key.
          Mono, because JetBrains Mono is the only family loaded at 700 and it is
          what every other word in this column is set in. It breaks over two lines at
          this width, which is what the size is chosen for: it reads as a plate at the
          top of the column rather than as one long line squeezed to fit. */}
      <div className="px-[18px] pb-[24px]">
        <div className="font-mono text-[19px] font-bold leading-[1.2] tracking-tight text-fg-strong">
          Presenças nas Instalações
        </div>
      </div>

      {nav.map((section) => (
        <div key={section.group}>
          <div className="px-[18px] pb-[7px] pt-[18px] font-mono text-[9.5px] tracking-[0.14em] text-fg-faint">
            {section.group}
          </div>
          <nav className="flex flex-col">
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                // Every item is a way out of the drawer, including the one already
                // lit: on a window this narrow the column covers the page it points
                // at, so choosing where you already are still has to give it back.
                onClick={() => setNavOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2.5 border-l-2 border-transparent px-[18px] py-2',
                    'font-mono text-[12.5px] text-fg-muted transition-colors',
                    'hover:bg-[var(--hover)] hover:text-fg-strong',
                    isActive && 'border-l-accent bg-accent-wash text-fg-strong'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={16} strokeWidth={1.6} className={cn(isActive && 'text-accent')} />
                    {label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>
      ))}

      <div className="mt-auto flex items-center gap-2.5 border-t border-line-soft px-[18px] pt-3.5">
        {user && (
          <>
            <Avatar user={user} className="h-6 w-6 text-[9px]" />
            <span className="truncate font-mono text-[11px] text-fg-muted">{user.username}</span>
          </>
        )}
        <button
          onClick={signOut}
          title="Terminar sessão"
          aria-label="Terminar sessão"
          className="ml-auto rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
        >
          <LogOut size={15} strokeWidth={1.6} />
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-line-soft px-[18px] pt-3">
        <img
          src="/pse-logo.png"
          alt="PSE"
          className="pse-mark h-[15px] w-auto"
        />
        <span className="font-mono text-[9.5px] tracking-[0.06em] text-fg-faint">
          v{__APP_VERSION__}
        </span>
      </div>
    </>
  )

  return (
    <div className="flex h-full overflow-x-hidden">
      {/* Below the breakpoint the column would take more than half the window before
          the page got a pixel, so it stands down and the drawer takes over. */}
      <aside className="hidden w-[214px] shrink-0 flex-col border-r border-line-soft bg-side py-[18px] md:flex">
        {column}
      </aside>

      <Drawer open={navOpen} onOpenChange={setNavOpen} title="Navegação">
        <div className="flex h-full flex-col py-[18px]">{column}</div>
      </Drawer>

      <main className="flex min-w-0 flex-1 flex-col">
        {/* The row wraps rather than holding one line at every width: a page whose
            actions are a button and a month stepper cannot fit them beside a title
            on a phone, and a fixed height would push them off the edge instead. */}
        <header className="flex min-h-[54px] shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line-soft px-4 py-2 md:h-[54px] md:flex-nowrap md:px-6 md:py-0">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Abrir navegação"
              className="-ml-1 shrink-0 rounded p-1.5 text-fg-muted hover:bg-[var(--hover2)] hover:text-fg-strong md:hidden"
            >
              <Menu size={17} strokeWidth={1.6} />
            </button>
            <div className="flex min-w-0 items-center gap-3.5 text-sm font-semibold tracking-tight text-fg-strong">
              {title}
            </div>
          </div>
          {/* Wraps for the same reason the row does. A page whose actions are a
              button and a month stepper overran a narrow window by about eighty
              pixels, and the shell hides that overflow rather than scrolling it, so
              what went past the edge was the bell and the theme switch. */}
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-2.5">
            {actions}
            <SwapBell />
            <SearchButton />
            <ThemeToggle />
          </div>
        </header>
        {/* The scroll container fills the window; the column inside it stops
            growing, so nothing sprawls across an ultrawide monitor. */}
        <div key={pathname} className="min-h-0 flex-1 animate-rise overflow-auto p-4 md:p-6">
          <div className="mx-auto flex h-full w-full max-w-[1700px] flex-col gap-4">{children}</div>
        </div>
      </main>
    </div>
  )
}
