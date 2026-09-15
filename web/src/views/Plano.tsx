import { ArrowLeftRight, Check, Mail, NotebookPen, Plane, Send, Sparkles, Trash2, X } from 'lucide-react'
import { Fragment, useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Banner, Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { TeamSwitcher } from '@/components/layout/TeamSwitcher'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Orb } from '@/components/ui/orb'
import { Dialog } from '@/components/ui/dialog'
import { Select } from '@/components/ui/input'
import { SkeletonRows } from '@/components/ui/skeleton'
import { Table, Td, Th, Tr } from '@/components/ui/table'
import { useAuth } from '@/context/AuthContext'
import { useTeam } from '@/context/TeamContext'
import { indexAbsences } from '@/lib/calendar'
import { comboText } from '@/lib/hotkey'
import { errorText, useAsync } from '@/lib/useAsync'
import { stagger } from '@/lib/motion'
import { cn, monthName, ptDate, shortDate, todayIso, WEEKDAYS_LONG } from '@/lib/utils'
import { capped } from '@/lib/utils'
import { absences as absencesApi, plans as plansApi, teams as teamsApi } from '@/services'
import type { Plan, PlanDay, TeamMember, User } from '@/services/types'

/**
 * A member, in the one form they take across the whole application.
 *
 * [away] is the same person seen from the other side: greyed, first name only and
 * carrying the Férias icon, so a row reads as who is in and who is out without
 * having to read a sentence about it.
 *
 * [conflict] is both at once — assigned to a day their férias cover. The name stays
 * strong, because the plan really does put them there, but the plane turns warn so
 * the row says so without the reader having to match the name against the away list
 * by eye. The plan can legitimately be overridden; it must not be quietly wrong.
 */
function Person({ user, away = false, conflict = false }: { user: User; away?: boolean; conflict?: boolean }) {
  return (
    <span
      title={conflict ? `${user.displayName} está de férias neste dia` : undefined}
      className={cn('inline-flex items-center gap-1.5 text-xs', away ? 'text-fg-soft' : 'text-fg')}
    >
      <Avatar
        user={user}
        className={cn('h-[18px] w-[18px] text-[8px]', away && 'opacity-40')}
      />
      {away ? user.forename : user.displayName}
      {away && <Plane size={11} strokeWidth={1.7} className="text-fg-faint" />}
      {conflict && <Plane size={11} strokeWidth={1.7} className="text-warn" />}
    </span>
  )
}

function Chip({ active, onClick, title, children }: {
  active: boolean
  onClick: () => void
  title?: string
  children: ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-pressed={active}
      className={cn(
        'inline-flex h-[26px] items-center gap-1.5 rounded border px-2',
        'font-mono text-[10.5px] tracking-[0.02em] transition-colors',
        active
          ? 'border-accent bg-accent text-accent-fg'
          : 'border-line text-fg-muted hover:text-fg-strong'
      )}
    >
      {children}
    </button>
  )
}

/**
 * How many people a plan row names before it starts counting instead.
 *
 * Eight wraps to two lines in the column the table gives it. Forty wrapped to
 * fourteen, and a row a third of a screen tall is not a row.
 */
const ROW_NAMES = 8

function DayRow({ day, members, away, canEdit, onSwap, index, today }: {
  day: PlanDay
  members: TeamMember[]
  /** Who is on holiday this day, whether or not they are assigned to it. */
  away: User[]
  canEdit: boolean
  onSwap: (date: string, userIds: number[]) => void
  index: number
  today: string
}) {
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<number[]>(day.assigned.map((u) => u.id))
  const [shownAssigned, moreAssigned] = capped(day.assigned, ROW_NAMES)
  const [shownAway, moreAway] = capped(away, ROW_NAMES)
  const isToday = day.date === today
  const past = day.date < today
  // The plan was generated before these férias were known (or was edited over
  // them), and it still puts somebody on a day they are away. Not the same as
  // understaffed, but the same colour of problem: the row needs a hand.
  const awayIds = new Set(away.map((u) => u.id))
  const conflicting = !day.isHoliday && day.assigned.some((u) => awayIds.has(u.id))

  // The date column carries the row's whole state as a rule down its edge: an
  // inset shadow rather than a border, because a border on one row's first cell
  // shifts its text out of line with every other row's.
  const rule = (day.understaffed || conflicting) && !day.isHoliday
    ? 'shadow-[inset_2px_0_0_var(--wnfg)]'
    : isToday
      ? 'shadow-[inset_2px_0_0_var(--acc)]'
      : ''

  const date = (
    <Td
      className={cn(
        'font-mono font-medium',
        day.isHoliday || past ? 'text-fg-soft' : 'text-fg-strong',
        rule
      )}
    >
      {ptDate(day.date)}
    </Td>
  )
  const weekday = (
    <Td className={past ? 'text-fg-soft' : 'text-fg-muted'}>{WEEKDAYS_LONG[day.weekday - 1]}</Td>
  )
  const row = cn('animate-rise', isToday && 'bg-accent-wash')

  if (day.isHoliday) {
    return (
      <Tr className={row} style={stagger(index)}>
        {date}
        {weekday}
        <Td className="text-fg-faint">—</Td>
        <Td>
          <Badge>FERIADO</Badge>
          <span className="ml-2.5 text-[11.5px] text-fg-soft">{day.holidayName}</span>
        </Td>
        <Td />
      </Tr>
    )
  }

  return (
    <Tr className={row} style={stagger(index)}>
      {date}
      {weekday}
      <Td>
        {editing ? (
          <div className="flex flex-wrap gap-1.5">
            {members.filter((m) => !m.leftAt).map((m) => {
              const on = picked.includes(m.user.id)
              // Someone on holiday can still be picked — the plan is the team's to
              // override — but never without being told.
              const isAway = away.some((u) => u.id === m.user.id)
              return (
                <button
                  key={m.user.id}
                  onClick={() =>
                    setPicked((p) => (on ? p.filter((id) => id !== m.user.id) : [...p, m.user.id]))
                  }
                  title={isAway ? `${m.user.forename} está de férias neste dia` : undefined}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs transition-colors',
                    on
                      ? 'border-accent bg-accent text-accent-fg'
                      : 'border-line text-fg-muted hover:text-fg-strong',
                    isAway && !on && 'opacity-60'
                  )}
                >
                  <Avatar user={m.user} className="h-[15px] w-[15px] text-[7px]" />
                  {m.user.forename}
                  {isAway && (
                    <Plane size={11} strokeWidth={1.7} className={on ? 'opacity-75' : 'text-warn'} />
                  )}
                </button>
              )
            })}
          </div>
        ) : (
          /* Named up to what a row can hold, then counted. Forty names wrapped a
             row to nearly three hundred pixels, so two days filled the screen and
             a four month plan ran to seven of them. Editing the day still offers
             everybody. */
          <div className="flex flex-wrap gap-x-3.5 gap-y-1">
            {day.assigned.length === 0 ? (
              <span className="text-fg-faint">—</span>
            ) : (
              <>
                {shownAssigned.map((u) => (
                  <Person key={u.id} user={u} conflict={awayIds.has(u.id)} />
                ))}
                {moreAssigned > 0 && (
                  <span className="font-mono text-[11px] text-fg-faint">+{moreAssigned}</span>
                )}
              </>
            )}
          </div>
        )}
      </Td>
      {/* Only what is out of the ordinary. A badge that says COMPLETO on every row
          is a wall of green that has to be read before it can be dismissed. */}
      <Td>
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {day.understaffed && (
            <Badge tone="warn">{day.assigned.length} DE {day.requiredCount || '?'}</Badge>
          )}
          {shownAway.map((u) => <Person key={u.id} user={u} away />)}
          {moreAway > 0 && <span className="font-mono text-[11px] text-fg-faint">+{moreAway}</span>}
        </div>
      </Td>
      <Td className="text-right">
        {canEdit &&
          (editing ? (
            <div className="flex justify-end gap-1.5">
              <Button
                size="icon"
                variant="ghost"
                title="Cancelar"
                aria-label="Cancelar a troca"
                onClick={() => { setEditing(false); setPicked(day.assigned.map((u) => u.id)) }}
              >
                <X size={15} strokeWidth={1.8} />
              </Button>
              <Button
                size="icon"
                variant="default"
                title="Guardar"
                aria-label="Guardar a troca"
                onClick={() => { onSwap(day.date, picked); setEditing(false) }}
              >
                <Check size={15} strokeWidth={1.8} />
              </Button>
            </div>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              title="Trocar elementos"
              aria-label={`Trocar os elementos de ${ptDate(day.date)}`}
              onClick={() => setEditing(true)}
            >
              <ArrowLeftRight size={15} strokeWidth={1.6} />
            </Button>
          ))}
      </Td>
    </Tr>
  )
}

export function Plano() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { team } = useTeam()
  const today = todayIso()
  // Remembered with the schedule it was picked under. A plan belongs to one
  // commitment, so carrying the choice across a switch would show one schedule's
  // plan under the other's name.
  const [selected, setSelected] = useState<{ teamId: number; planId: number } | null>(null)
  const [busy, setBusy] = useState(false)
  // Both of these are one-way doors: a plan cannot be recovered, and there is no
  // unpublish. Neither should happen on a single stray click.
  const [confirming, setConfirming] = useState<'publish' | 'delete' | null>(null)
  const [noting, setNoting] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [who, setWho] = useState<number | null>(null)
  const [onlyShort, setOnlyShort] = useState(false)
  const [onlyAhead, setOnlyAhead] = useState(false)

  const base = useAsync(async () => {
    if (!team) return null
    const [summaries, members] = await Promise.all([
      plansApi.list(team.id),
      teamsApi.members(team.id)
    ])
    return { team, summaries, members }
  }, [team?.id])

  const planId =
    (selected?.teamId === team?.id ? selected?.planId : null) ?? base.data?.summaries[0]?.id ?? null
  // The absences come with the plan and over the same period: who is away is what
  // explains an understaffed day, so the two arrive together or the explanation
  // pops in late.
  const detail = useAsync(async () => {
    if (!planId) return null
    const plan = await plansApi.get(planId)
    // Who is away is context for reading the plan, not the plan itself: if that
    // call fails the table still has everything it needs to be useful.
    const absences = await absencesApi
      .list({ from: plan.periodStart, to: plan.periodEnd })
      .catch(() => [])
    return { plan, awayByDate: indexAbsences(absences) }
  }, [planId])
  const plan: Plan | null = detail.data?.plan ?? null
  const awayByDate = detail.data?.awayByDate ?? new Map<string, User[]>()

  const days = useMemo(
    () =>
      (plan?.days ?? []).filter((day) => {
        if (onlyShort && !day.understaffed) return false
        if (onlyAhead && day.date < today) return false
        if (who !== null && !day.assigned.some((u) => u.id === who)) return false
        return true
      }),
    [plan, onlyShort, onlyAhead, who, today]
  )

  const byMonth = useMemo(() => {
    const groups = new Map<string, PlanDay[]>()
    days.forEach((day) => {
      const key = day.date.slice(0, 7)
      groups.set(key, [...(groups.get(key) ?? []), day])
    })
    // The offset keeps the entrance cascading down the whole table instead of
    // restarting at every month heading.
    let offset = 0
    return [...groups.entries()].map(([key, group]) => {
      const entry = { key, days: group, offset }
      offset += group.length
      return entry
    })
  }, [days])

  const short = plan?.days.filter((day) => day.understaffed) ?? []
  const shortDays = short.map((day) => shortDate(day.date))
  const shortList = shortDays.length > 3
    ? `${shortDays.slice(0, 3).join(', ')} e mais ${shortDays.length - 3}`
    : shortDays.join(', ')
  const filtered = who !== null || onlyShort || onlyAhead
  const members = (base.data?.members ?? []).filter((m) => !m.leftAt)


  // The route is already closed to everyone else, and the API has always refused
  // these writes. This is the third lock rather than the only one.
  const canEdit = Boolean(user?.isAdmin)

  /**
   * Runs a write, then reloads what it could have changed. A delete is the one
   * case that must not reload the detail: the plan it would ask for is the one
   * that just stopped existing, and the 404 would land on screen as an error.
   */
  async function act<T>(work: () => Promise<T>, done: string, { keepDetail = true } = {}) {
    setBusy(true)
    try {
      await work()
      toast.success(done)
      base.reload()
      if (keepDetail) detail.reload()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  /*
   * The two dialogs' primary actions, written once each because two things reach
   * them: the button in the footer, and mod+Enter through the dialog's onSubmit.
   * The confirm dialog's action is whichever one-way door it was opened for, so
   * the key presses what the dialog is asking, never the other one.
   */
  function saveNotes() {
    if (busy || !plan) return
    act(async () => {
      await plansApi.updateNotes(plan.id, noteDraft)
      setNoting(false)
    }, 'Notas guardadas.')
  }

  function confirmAction() {
    if (busy || !plan || confirming === null) return
    if (confirming === 'delete') {
      act(async () => {
        await plansApi.remove(plan.id)
        setSelected(null)
        setConfirming(null)
      }, 'Plano apagado.', { keepDetail: false })
    } else {
      act(async () => {
        await plansApi.publish(plan.id)
        setConfirming(null)
      }, 'Plano publicado.')
    }
  }

  return (
    <Shell
      title={
        <>
          Plano
          <TeamSwitcher />
          {plan && (
            <Badge tone={plan.status === 'PUBLISHED' ? 'ok' : 'muted'}>
              {plan.status === 'PUBLISHED' ? 'PUBLICADO' : 'RASCUNHO'}
            </Badge>
          )}
          {/* Where the plan came from, next to what it is, rather than in a bar
              along the bottom of the table. */}
          {plan && (
            <span className="whitespace-nowrap font-mono text-[11px] font-normal text-fg-soft">
              {plan.status === 'PUBLISHED'
                ? `em ${ptDate(plan.publishedAt!.slice(0, 10))}`
                : `por ${plan.generatedBy.displayName} · ${ptDate(plan.generatedAt.slice(0, 10))}`}
            </span>
          )}
        </>
      }
      actions={
        <>
          {base.data && base.data.summaries.length > 0 && (
            <Select
              value={planId ?? ''}
              onChange={(e) => setSelected({ teamId: team!.id, planId: Number(e.target.value) })}
            >
              {base.data.summaries.map((p) => (
                <option key={p.id} value={p.id}>
                  {shortDate(p.periodStart)} — {shortDate(p.periodEnd)} {p.periodEnd.slice(0, 4)}
                </option>
              ))}
            </Select>
          )}
          <Button variant="default" onClick={() => navigate('/plano/gerar')} disabled={busy || !base.data}>
            <Sparkles size={14} strokeWidth={1.6} />
            GERAR
          </Button>
        </>
      }
    >
      <Dialog
        open={noting}
        onOpenChange={setNoting}
        width={560}
        title="Notas do email"
        description="Vão no email, a seguir ao primeiro parágrafo e antes do calendário. Uma linha por parágrafo."
        onSubmit={saveNotes}
        footer={
          <>
            <Button variant="ghost" onClick={() => setNoting(false)}>CANCELAR</Button>
            <Button
              variant="default"
              disabled={busy}
              onClick={saveNotes}
              // The key that presses this button, said in the tooltip rather than
              // on the button: the notes are what the footer should be spent on.
              title={comboText('mod+enter')}
            >
              GUARDAR
            </Button>
          </>
        }
      >
        <textarea
          rows={6}
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder={
            'Nota 1: nos dias 12 e 26 a escala contempla apenas cinco colaboradores, uma vez que ' +
            'os restantes se encontrarão em período de férias.'
          }
          className="w-full rounded border border-line bg-field px-3 py-2 text-[13px] text-fg-strong placeholder:text-fg-faint"
        />
      </Dialog>

      <Dialog
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirming === 'delete' ? 'Apagar plano' : 'Publicar plano'}
        description={
          confirming === 'delete'
            ? 'O plano e as trocas feitas nele desaparecem. Não há como voltar atrás.'
            : 'O plano passa a contar para o balanço. Não há como despublicar.'
        }
        onSubmit={confirmAction}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(null)}>CANCELAR</Button>
            {confirming === 'delete' ? (
              <Button variant="danger" disabled={busy} onClick={confirmAction} title={comboText('mod+enter')}>
                <Trash2 size={13} strokeWidth={1.6} />
                APAGAR
              </Button>
            ) : (
              <Button variant="default" disabled={busy} onClick={confirmAction} title={comboText('mod+enter')}>
                {busy ? (
                  <Orb state="working" label="A publicar o plano" onAccent />
                ) : (
                  <Send size={13} strokeWidth={1.6} />
                )}
                PUBLICAR
              </Button>
            )}
          </>
        }
      >
        <p className="text-[12.5px] text-fg-muted">
          {plan && `${ptDate(plan.periodStart)} a ${ptDate(plan.periodEnd)}`}
          {plan && short.length > 0 && confirming === 'publish' && (
            <>
              {' · '}
              <span className="text-warn">
                {short.length} {short.length === 1 ? 'dia' : 'dias'} sem equipa completa
              </span>
            </>
          )}
        </p>
      </Dialog>

      {/* A failed load left the table looking merely empty, which reads as "there
          is no plan" rather than "the plan could not be fetched". */}
      {(base.error || detail.error) && <Banner tone="danger">{base.error ?? detail.error}</Banner>}

      {plan && short.length > 0 && (
        <Banner>
          <b className="font-semibold">
            {short.length} {short.length === 1 ? 'dia' : 'dias'} sem equipa completa.
          </b>{' '}
          {shortList}. Troque manualmente ou verifique as férias.
        </Banner>
      )}

      <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {plan && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft px-3.5 py-2.5">
            {/* One control rather than a chip per person: a chip each was three
                rows of toolbar once a schedule had ten people on it. */}
            <Select
              aria-label="Filtrar por elemento"
              className="h-[26px]"
              value={who ?? ''}
              onChange={(e) => setWho(e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">TODOS OS ELEMENTOS</option>
              {members.map((m) => (
                <option key={m.user.id} value={m.user.id}>
                  {m.user.displayName}
                </option>
              ))}
            </Select>
            <span className="mx-0.5 h-4 w-px bg-line" />
            <Chip active={onlyShort} onClick={() => setOnlyShort((v) => !v)}>
              POR RESOLVER{short.length > 0 && ` ${short.length}`}
            </Chip>
            <Chip active={onlyAhead} onClick={() => setOnlyAhead((v) => !v)}>
              A PARTIR DE HOJE
            </Chip>
            {filtered && (
              <span className="font-mono text-[10.5px] text-fg-faint">
                {days.length} de {plan.days.length}
              </span>
            )}

            <div className="ml-auto flex items-center gap-2">
              {/* The notes ride out with the email, so they are edited next to the
                  button that copies it. */}
              <Button
                size="sm"
                disabled={busy}
                title="Notas do email"
                onClick={() => { setNoteDraft(plan.notes ?? ''); setNoting(true) }}
              >
                <NotebookPen size={13} strokeWidth={1.6} />
                NOTAS
                {plan.notes && <span className="h-1.5 w-1.5 rounded-full bg-accent" />}
              </Button>
              {/* The message is a page: what goes in it is a handful of choices
                  worth seeing answered, and a modal has nowhere to show them. */}
              <Button
                size="sm"
                onClick={() => navigate(`/plano/email?plan=${plan.id}`)}
                disabled={busy}
              >
                <Mail size={13} strokeWidth={1.6} />
                EMAIL
              </Button>
              {plan.status === 'DRAFT' && (
                <Button
                  size="sm"
                  variant="default"
                  disabled={busy}
                  onClick={() => setConfirming('publish')}
                >
                  <Send size={13} strokeWidth={1.6} />
                  PUBLICAR
                </Button>
              )}
              <Button
                size="icon"
                variant="ghost"
                title="Apagar plano"
                aria-label="Apagar plano"
                disabled={busy}
                onClick={() => setConfirming('delete')}
              >
                <Trash2 size={14} strokeWidth={1.6} />
              </Button>
            </div>
          </div>
        )}

        <Table className="table-fixed" minWidth={800}>
          <colgroup>
            <col className="w-[118px]" />
            <col className="w-[150px]" />
            <col />
            <col className="w-[300px]" />
            <col className="w-[56px]" />
          </colgroup>
          <thead>
            <tr>
              <Th>DATA</Th>
              <Th>DIA</Th>
              <Th>ELEMENTOS</Th>
              <Th>ESTADO</Th>
              <Th />
            </tr>
          </thead>
          <tbody>
            {detail.loading && <SkeletonRows rows={6} cols={5} />}
            {!detail.loading && !plan && !detail.error && !base.error && (
              <tr>
                <td colSpan={5}>
                  <Empty title="Ainda não há planos." hint="Carregue em Gerar para criar o primeiro." />
                </td>
              </tr>
            )}
            {!detail.loading && plan && days.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <Empty
                    title="Nenhum dia corresponde ao filtro."
                    hint="Carregue em Todos para ver o plano inteiro."
                  />
                </td>
              </tr>
            )}
            {!detail.loading &&
              byMonth.map(({ key, days: group, offset }) => {
                const missing = group.filter((day) => day.understaffed).length
                const holidays = group.filter((day) => day.isHoliday).length
                return (
                  <Fragment key={key}>
                    <tr>
                      <td colSpan={5} className="border-t border-line-soft px-3.5 pb-1.5 pt-4">
                        <span className="font-mono text-[9.5px] tracking-[0.14em] text-fg-strong">
                          {monthName(Number(key.slice(5, 7))).toUpperCase()} {key.slice(0, 4)}
                        </span>
                        <span className="ml-2.5 font-mono text-[9.5px] tracking-[0.14em] text-fg-faint">
                          {group.length} {group.length === 1 ? 'DIA' : 'DIAS'}
                          {holidays > 0 && ` · ${holidays} FERIADO${holidays === 1 ? '' : 'S'}`}
                          {missing > 0 && ` · ${missing} POR RESOLVER`}
                        </span>
                      </td>
                    </tr>
                    {group.map((day, index) => (
                      <DayRow
                        key={day.date}
                        index={offset + index}
                        day={day}
                        today={today}
                        members={base.data?.members ?? []}
                        away={awayByDate.get(day.date) ?? []}
                        canEdit={canEdit}
                        onSwap={(date, ids) =>
                          act(() => plansApi.setDay(plan!.id, date, ids), 'Dia atualizado.')
                        }
                      />
                    ))}
                  </Fragment>
                )
              })}
          </tbody>
        </Table>
      </Card>
    </Shell>
  )
}
