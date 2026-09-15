import { ArrowLeft, Copy, LogOut, Mail, Search, SunMoon, Sparkles, type LucideIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { NAV } from '@/components/layout/Shell'
import { Avatar } from '@/components/ui/avatar'
import { Dialog } from '@/components/ui/dialog'
import { Kbd } from '@/components/ui/kbd'
import { useAuth } from '@/context/AuthContext'
import { useSearch } from '@/context/SearchContext'
import { useTeam } from '@/context/TeamContext'
import { useTheme } from '@/context/ThemeContext'
import { comboText, useHotkey } from '@/lib/hotkey'
import { cn, matchesQuery, shortDate, todayIso } from '@/lib/utils'
import { absences as absencesApi, plans as plansApi, teams as teamsApi, users as usersApi } from '@/services'
import type { Absence, MemberBalance, Plan, User } from '@/services/types'

/** How many of a person's next days are worth naming before it is a calendar. */
const NEXT_DAYS = 4

/**
 * What somebody owes the rota, said in words.
 *
 * Balanço carries the ledger to two decimals because it is the page where the number
 * is argued with. Here it is a glance, and "37 de 37,48" is a glance nobody finishes:
 * half a day either way is square, and the rest rounds to days, which is the unit the
 * thing is actually scheduled in.
 */
function owing(debt: number) {
  if (debt >= 0.5) return `${Math.round(debt)} em falta`
  if (debt <= -0.5) return `${Math.round(-debt)} a mais`
  return 'em dia'
}

/** One thing that can be reached by typing, whatever kind of thing it is. */
type Row =
  | { id: string; group: string; kind: 'person'; person: User; hint: string }
  | { id: string; group: string; kind: 'go'; label: string; icon: LucideIcon; to: string; hint?: string }
  | { id: string; group: string; kind: 'do'; label: string; icon: LucideIcon; run: () => void; hint?: string }

/**
 * Everything reachable by typing, in one box.
 *
 * It was a people search: the roster filtered by a substring of a name, and choosing
 * somebody put their email on the clipboard. That is a thin use of the one shortcut
 * the interface says out loud — it reached one kind of thing out of seven pages, it
 * could not take you to any of them, and having been opened with a key it then needed
 * the mouse, because there was nothing to move with an arrow and Enter always took the
 * first match however far down the list you had reached.
 *
 * So: people, pages and actions in one list, moved through with the arrows and chosen
 * with Enter. Matching folds the accents away and takes the words in any order, which
 * is the way a name is actually typed by somebody who already knows it — "vieira joao"
 * as often as "João Vieira".
 *
 * A person opens into a second face of the same box rather than a page: what is wanted
 * nine times out of ten is when they are next in, whether they are square with the
 * rota and whether they are away — three lines, read without leaving whatever you were
 * doing. The jumps are underneath for the tenth time.
 */
export function CommandPalette() {
  const { isOpen, open, close } = useSearch()
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const { team } = useTeam()
  const { toggle: toggleTheme } = useTheme()

  const [query, setQuery] = useState('')
  const [person, setPerson] = useState<User | null>(null)
  const [active, setActive] = useState(0)

  useHotkey('mod+k', () => (isOpen ? close() : open()))

  const [people, setPeople] = useState<User[]>([])
  const [balances, setBalances] = useState<MemberBalance[]>([])
  const [plan, setPlan] = useState<Plan | null>(null)
  const [away, setAway] = useState<Absence[]>([])
  const [loaded, setLoaded] = useState(false)

  /*
   * Read once, on the first opening, and kept. A palette that spent four requests
   * every time it opened would be slower than the menu it replaces, and none of this
   * moves inside a session: the roster, this team's ledger, the plan in force and who
   * is away are the same answers a minute later.
   *
   * Settled rather than awaited together, because three of the four are behind the
   * administrator's door. A member gets the people and the rest comes back empty,
   * which is exactly what their palette should show.
   */
  useEffect(() => {
    if (!isOpen || loaded) return
    setLoaded(true)
    const today = todayIso()
    Promise.allSettled([
      usersApi.list(),
      team ? teamsApi.balance(team.id) : Promise.reject(),
      team ? plansApi.list(team.id) : Promise.reject(),
      absencesApi.list({ from: today })
    ]).then(async ([roster, ledger, plans, absences]) => {
      if (roster.status === 'fulfilled') setPeople(roster.value)
      if (ledger.status === 'fulfilled') setBalances(ledger.value)
      if (absences.status === 'fulfilled') setAway(absences.value)
      if (plans.status === 'fulfilled' && plans.value[0]) {
        // The list carries no days; the plan in force is the one with the answers.
        await plansApi.get(plans.value[0].id).then(setPlan).catch(() => undefined)
      }
    })
  }, [isOpen, loaded, team?.id])

  // Every opening starts from nothing, so the box never answers a question left in it
  // last time — and never opens onto the person somebody looked up yesterday.
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setPerson(null)
      setActive(0)
    }
  }, [isOpen])

  /** A person's next days on site, the soonest first. */
  const daysOf = (who: User) => {
    const today = todayIso()
    return (plan?.days ?? [])
      .filter((day) => day.date >= today && day.assigned.some((u) => u.id === who.id))
      .map((day) => day.date)
      .sort()
  }

  const balanceOf = (who: User) => balances.find((b) => b.user.id === who.id) ?? null
  const awayOf = (who: User) => away.filter((a) => a.user.id === who.id).sort((a, b) => a.startDate.localeCompare(b.startDate))

  /** The pages this person is allowed to reach, which is the column they already see. */
  const pages = useMemo(
    () =>
      NAV.flatMap((section) => section.items).filter((item) => !item.admin || user?.isAdmin),
    [user?.isAdmin]
  )

  const rows: Row[] = useMemo(() => {
    if (person) {
      // Plano and Balanço are the administrator's doors; a member gets Férias and the
      // address, which are the two things about somebody they can actually reach.
      const out: Row[] = []
      if (user?.isAdmin) {
        out.push(
          { id: 'go-plano', group: 'IR PARA', kind: 'go', label: 'Ver no Plano', icon: NAV[0].items[1].icon, to: '/plano' },
          { id: 'go-balanco', group: 'IR PARA', kind: 'go', label: 'Ver no Balanço', icon: NAV[0].items[2].icon, to: '/balanco' }
        )
      }
      out.push({
        id: 'go-ferias', group: 'IR PARA', kind: 'go', label: 'Ver as férias', icon: NAV[1].items[0].icon, to: '/ferias'
      })
      out.push({
        id: 'copy-email',
        group: 'ACÇÕES',
        kind: 'do',
        label: 'Copiar o email',
        icon: Copy,
        hint: person.email,
        run: () => copy(person.email, `Email de ${person.forename} copiado.`)
      })
      return query.trim()
        ? out.filter((row) => matchesQuery(query, row.kind === 'person' ? '' : row.label, row.hint))
        : out
    }

    const matching = <T,>(items: T[], fields: (item: T) => (string | null | undefined)[]) =>
      query.trim() ? items.filter((item) => matchesQuery(query, ...fields(item))) : items

    const peopleRows: Row[] = matching(people, (u) => [u.displayName, u.email, u.username]).map((u) => {
      const balance = balanceOf(u)
      return {
        id: `person-${u.id}`,
        group: 'PESSOAS',
        kind: 'person',
        person: u,
        hint: balance ? `${balance.assigned} dias · ${owing(balance.debt)}` : ''
      }
    })

    const goRows: Row[] = matching(pages, (p) => [p.label]).map((p) => ({
      id: `go-${p.to}`, group: 'IR PARA', kind: 'go', label: p.label, icon: p.icon, to: p.to
    }))

    const actions: { label: string; icon: LucideIcon; run: () => void; admin?: boolean }[] = [
      { label: 'Gerar um plano', icon: Sparkles, admin: true, run: () => navigate('/plano/gerar') },
      { label: 'Escrever o email do plano', icon: Mail, admin: true, run: () => navigate('/plano/email') },
      { label: 'Trocar entre claro e escuro', icon: SunMoon, run: toggleTheme },
      { label: 'Terminar sessão', icon: LogOut, run: signOut }
    ]
    const doRows: Row[] = matching(
      actions.filter((a) => !a.admin || user?.isAdmin),
      (a) => [a.label]
    ).map((a) => ({ id: `do-${a.label}`, group: 'ACÇÕES', kind: 'do', label: a.label, icon: a.icon, run: a.run }))

    return [...peopleRows, ...goRows, ...doRows]
  }, [person, query, people, balances, plan, away, pages, user?.isAdmin])

  // A list that has changed under the cursor has no business keeping the old one.
  useEffect(() => setActive(0), [query, person])

  async function copy(text: string, said: string) {
    close()
    try {
      await navigator.clipboard.writeText(text)
      toast.success(said)
    } catch {
      // Clipboard access can be refused, and a silent no-op would look like a bug.
      toast.error('Não foi possível copiar. Verifique as permissões do browser.')
    }
  }

  function choose(row: Row) {
    if (row.kind === 'person') {
      setPerson(row.person)
      setQuery('')
      return
    }
    if (row.kind === 'go') {
      close()
      navigate(row.to)
      return
    }
    row.run()
    if (row.id !== 'copy-email') close()
  }

  const listRef = useRef<HTMLDivElement>(null)

  /** Keeps the chosen row on screen while the arrows run past the bottom of the box. */
  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  }, [active, rows.length])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (rows.length === 0) return
      const step = e.key === 'ArrowDown' ? 1 : -1
      setActive((i) => (i + step + rows.length) % rows.length)
      return
    }
    if (e.key === 'Enter' && rows[active]) {
      e.preventDefault()
      choose(rows[active])
      return
    }
    if (e.key === 'Backspace' && person && query === '') {
      e.preventDefault()
      setPerson(null)
      return
    }
    // Back out of a person before backing out of the box, so Escape is one step at a
    // time rather than a trapdoor.
    if (e.key === 'Escape' && person) {
      e.preventDefault()
      e.stopPropagation()
      setPerson(null)
    }
  }

  let group = ''

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => !next && close()}
      title="Procurar"
      description="Pessoas, páginas e acções."
      width={520}
      bare
    >
      {/* ------------------------------------------------------------ the box */}
      {/*
        * The box stays, whatever it is showing.
        *
        * A person used to replace it, which read well and left nothing holding the
        * focus: the arrows stopped working the moment somebody was opened, in a box
        * whose whole point is that it is worked from the keyboard. So the person
        * becomes a chip in front of the box instead, the way a filter does, and the
        * typing carries on — now over that person's own actions. Backspace on an
        * empty box takes the chip off again, which is where the hand already is.
        */}
      <div className="flex items-center gap-2 border-b border-line-soft px-3.5 py-2.5">
        {person ? (
          <button
            type="button"
            onClick={() => setPerson(null)}
            aria-label="Voltar à procura"
            className="-ml-1 rounded p-1 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
          >
            <ArrowLeft size={15} strokeWidth={1.8} />
          </button>
        ) : (
          <Search size={15} strokeWidth={1.6} className="shrink-0 text-fg-muted" />
        )}
        {person && (
          <span className="flex shrink-0 items-center gap-1.5 rounded bg-[var(--accbg)] py-0.5 pl-0.5 pr-2 text-[12px] text-fg-strong">
            <Avatar user={person} className="h-[18px] w-[18px] text-[8px]" />
            {person.displayName}
          </span>
        )}
        <input
          // Radix moves the focus into the dialog when it opens; the box is what it
          // is opened for, so it takes the focus the dialog receives.
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={person ? 'Ir para, copiar…' : 'Pessoa, página ou acção'}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-fg-strong outline-none placeholder:text-fg-soft"
        />
        <span className="shrink-0">
          <Kbd combo="mod+k" />
        </span>
      </div>

      {/* --------------------------------------------------- what the person is */}
      {person && (
        <div className="border-b border-line-soft px-3.5 py-2.5">
          <Summary
            label="PRÓXIMOS DIAS"
            value={
              daysOf(person).slice(0, NEXT_DAYS).map(shortDate).join(' · ') ||
              (plan ? 'Nenhum dia atribuído' : '—')
            }
          />
          <Summary
            label="BALANÇO"
            value={(() => {
              const b = balanceOf(person)
              if (!b) return '—'
              // Two decimals here, as Balanço has them: this is the line somebody
              // reads before they go and argue with that page.
              const expected = b.expected.toFixed(2).replace('.', ',')
              return `${b.assigned} de ${expected} · ${owing(b.debt)}`
            })()}
          />
          <Summary
            label="FÉRIAS"
            value={
              awayOf(person)
                .slice(0, 2)
                .map((a) => `${shortDate(a.startDate)} — ${shortDate(a.endDate)}`)
                .join(' · ') || 'Nada marcado'
            }
          />
        </div>
      )}

      {/* ----------------------------------------------------------- the list */}
      <div ref={listRef} className="max-h-[min(50vh,340px)] overflow-y-auto py-1.5">
        {rows.length === 0 && (
          <p className="px-3.5 py-3 text-xs text-fg-muted">
            Nada corresponde a “{query.trim()}”.
          </p>
        )}
        {rows.map((row, index) => {
          const heading = row.group !== group ? ((group = row.group), row.group) : null
          return (
            <div key={row.id}>
              {heading && (
                <div className="px-3.5 pb-1 pt-2 font-mono text-[9px] font-semibold tracking-[0.13em] text-fg-faint">
                  {heading}
                </div>
              )}
              <button
                type="button"
                data-row={index}
                onClick={() => choose(row)}
                onMouseMove={() => setActive(index)}
                className={cn(
                  'flex w-full items-center gap-2.5 px-3.5 py-[7px] text-left',
                  index === active && 'bg-[var(--hover2)]'
                )}
              >
                {row.kind === 'person' ? (
                  <Avatar user={row.person} className="h-[22px] w-[22px] text-[9px]" />
                ) : (
                  <row.icon size={15} strokeWidth={1.6} className="shrink-0 text-fg-muted" />
                )}
                <span className="truncate text-[12.5px] text-fg-strong">
                  {row.kind === 'person' ? row.person.displayName : row.label}
                </span>
                {row.hint && (
                  <span className="ml-auto shrink-0 truncate font-mono text-[10.5px] text-fg-muted">
                    {row.hint}
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      {/* The three keys this box is worked with, said once at the bottom where a
          palette says them, rather than not at all. */}
      <div className="flex items-center gap-3 border-t border-line-soft px-3.5 py-2 font-mono text-[9.5px] tracking-[0.08em] text-fg-faint">
        <span>↑↓ NAVEGAR</span>
        <span>↵ ABRIR</span>
        <span>{person ? '⎋ VOLTAR' : '⎋ FECHAR'}</span>
      </div>
    </Dialog>
  )
}

/** A line of the person's card: what it is, then what it says. */
function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2.5 py-[3px]">
      <span className="w-[104px] shrink-0 font-mono text-[9px] font-semibold tracking-[0.12em] text-fg-faint">
        {label}
      </span>
      <span className="truncate text-[12px] text-fg">{value}</span>
    </div>
  )
}

/**
 * The header's way in, and the one place outside the box itself that shows a key.
 */
export function SearchButton() {
  const { open } = useSearch()
  return (
    <button
      type="button"
      onClick={open}
      title={`Procurar (${comboText('mod+k')})`}
      aria-label="Procurar"
      className="flex items-center gap-1.5 rounded p-1.5 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
    >
      <Search size={15} strokeWidth={1.6} />
      <Kbd combo="mod+k" />
    </button>
  )
}
