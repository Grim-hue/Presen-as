import { ArrowLeftRight, CalendarCheck, ChevronLeft, ChevronRight, MapPin } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/ui/avatar'
import { Card } from '@/components/ui/card'
import { Dialog } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { Tooltip } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { dayOf, firstUpcoming, indexAbsences, indexPlanDays, monthGrid, type ScheduledDay } from '@/lib/calendar'
import { capped, cn, density, memberGradient, longDate, memberColour, monthName, monthShort, ptDate, shortDate, teamMark, teamTag, todayIso, WEEKDAYS_SHORT } from '@/lib/utils'
import { errorText, useAsync } from '@/lib/useAsync'
import { comboText, useHotkey } from '@/lib/hotkey'
import { stagger, usePrefersReducedMotion } from '@/lib/motion'
import { Bar } from '@/components/ui/bar'
import { AvatarCircles } from '@/components/ui/avatar-circles'
import { DayCalendar } from '@/components/ui/day-calendar'
import { Counter } from '@/components/ui/counter'
import { absences as absencesApi, plans as plansApi, swaps as swapsApi, teams as teamsApi } from '@/services'
import type { Team, User } from '@/services/types'
import { useAuth } from '@/context/AuthContext'
import { useSwaps } from '@/context/SwapContext'

/**
 * How many people a box shows before it starts counting instead.
 *
 * The number is the box, not the roster: the tile is seventy pixels of aside, and a
 * cell has a sixty six pixel floor and six neighbours in its row that inherit
 * whatever it becomes. Everything past them is one move away — the tile opens the day
 * list, the cell has its label. The tile carries marks rather than names because the
 * figure beside them is already the total: forty two names stretched it to nine
 * hundred and forty six pixels and took the three tiles sharing its row with it.
 */
const TILE_MARKS = 5
const CELL_MARKS = 8
const LEGEND_NAMES = 10

/**
 * How many people can be away before the strip stops marking them one by one.
 *
 * A mark each is the better answer while the marks are still marks: five of them in a
 * cell are three or four pixels wide, tellable apart, and named on hover. Past that
 * they crowd — and past about twenty seven the gaps alone are wider than the cell, so
 * every mark solves to nothing and the strip draws empty. The ribbon takes over
 * before that happens rather than after.
 */
const AWAY_MARKS = 5

function Stat({ label, value, count, tone, aside, index = 0, onClick }: {
  label: string
  value?: string
  count?: number
  tone?: 'accent' | 'warn'
  aside?: React.ReactNode
  index?: number
  /** Makes the whole tile the way in to what it counts. */
  onClick?: () => void
}) {
  return (
    <Card
      className={cn(
        'flex animate-rise items-center justify-between px-4 py-3',
        onClick && 'cursor-pointer text-left hover:border-accent'
      )}
      style={stagger(index, 70)}
      {...(onClick
        ? {
            onClick,
            role: 'button',
            tabIndex: 0,
            // A div carrying a role has to answer the keyboard itself.
            onKeyDown: (e: React.KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick()
              }
            }
          }
        : {})}
    >
      <div>
        <div className="mb-1.5 font-mono text-[9.5px] tracking-[0.13em] text-fg-soft">{label}</div>
        <div
          className={cn(
            'font-mono text-[21px] leading-none',
            tone === 'accent' && 'text-fg-strong',
            tone === 'warn' && 'text-warn',
            !tone && 'text-fg-strong'
          )}
        >
          {count === undefined ? value : <Counter value={count} />}
        </div>
      </div>
      {aside}
    </Card>
  )
}

/**
 * Asking somebody to trade a day.
 *
 * The day given up comes first, then who takes it, then the day taken on. The reader
 * arrives already holding the first answer: the way in is a cell on the calendar, and
 * even from the button in the header it is a day they have in mind that sent them
 * here, not a colleague. Asking who first made them park the one fact they had and
 * answer a question they had not got to yet — and it made a day arriving from the
 * calendar a guess rather than an answer, honoured only once a name had been chosen
 * and asked for again whenever that name ruled it out.
 *
 * Every list is narrowed by the choice above it, so a combination that would be
 * refused is never offered. Only published days count: a draft can still be
 * regenerated, and two drafts can cover the same date. The one rule that cannot be
 * checked here is whether somebody has left the team since the plan was published,
 * which the API refuses with a sentence of its own.
 *
 * Mounted only while a request is being made, so each one starts empty.
 */
function SwapDialog({
  days, awayByDate, userId, today, preset, onClose, onRequested
}: {
  days: ScheduledDay[]
  awayByDate: Map<string, User[]>
  userId: number
  today: string
  /** The day the request started from, when it started from the calendar. */
  preset: ScheduledDay | null
  onClose: () => void
  onRequested: () => void
}) {
  const away = (id: number, iso: string) => (awayByDate.get(iso) ?? []).some((u) => u.id === id)

  const open = days.filter(
    (day) => day.planStatus === 'PUBLISHED' && !day.isHoliday && day.date > today
  )
  const myDays = open.filter((day) => day.assigned.some((u) => u.id === userId))

  /**
   * Days [them] could hand back for [myDay]: the same commitment, another date, and
   * they must be on it. The mirror of the rules below applies to me — I must not
   * already be on the day, and must not be away, or the ledger would owe me a day I
   * cannot work.
   */
  const theyCouldGive = (them: User, myDay: ScheduledDay) =>
    open.filter(
      (day) =>
        day.teamId === myDay.teamId &&
        day.date !== myDay.date &&
        day.assigned.some((u) => u.id === them.id) &&
        !day.assigned.some((u) => u.id === userId) &&
        !away(userId, day.date)
    )

  /*
   * Anybody a trade could be made with at all. Being assigned to a published day is
   * itself proof of membership on that date, so there is no roster to fetch.
   */
  const myTeams = new Set(myDays.map((day) => day.teamId))
  const roster = [
    ...new Map(
      open
        .filter((day) => myTeams.has(day.teamId))
        .flatMap((day) => day.assigned)
        .filter((u) => u.id !== userId)
        .map((u) => [u.id, u] as const)
    ).values()
  ].sort((a, b) => a.forename.localeCompare(b.forename))

  /**
   * Who could take [myDay] off me. They must not already be on it, and must not be
   * away for it, or the ledger would credit them a day they cannot work.
   *
   * Narrowed all the way to the end rather than as far as the next question only: a
   * name offered here and then found to hold no day free for me is an answer the form
   * had before it asked.
   */
  const takers = (myDay: ScheduledDay) =>
    roster.filter(
      (u) =>
        !myDay.assigned.some((x) => x.id === u.id) &&
        !away(u.id, myDay.date) &&
        theyCouldGive(u, myDay).length > 0
    )

  /** My days that lead somewhere, for the same reason. */
  const myOptions = myDays.filter((day) => takers(day).length > 0)

  /*
   * The day the calendar started from, and only while it is one of those: a day
   * nobody can take would open the form on a question with no answers in it. Then the
   * first question stands, with that day on screen, which is the shortest way to say
   * why.
   */
  const start = preset && myOptions.some((day) => day.id === preset.id) ? preset : null

  const [myDayId, setMyDayId] = useState<number | null>(start?.id ?? null)
  const [personId, setPersonId] = useState<number | null>(null)
  const [theirDayId, setTheirDayId] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  /*
   * One question on screen at a time, and which one. A day carried in from the
   * calendar is the first question already answered, so the form opens on the second
   * and the arrow back is what changes it.
   *
   * All three used to stand stacked. That was a fair shape while the people were six
   * chips: you could see the whole request at once. At forty it was seven hundred
   * pixels of one question, and the others were below the fold of a dialog that had
   * not been answered yet — so the form opened already scrolled away from the only
   * part of it you could act on.
   *
   * [dir] is which way the last move went, so the leaving step and the arriving one
   * travel the same way. Material calls a step forward and back a horizontal slide;
   * the box itself resizing under them is the container carrying the change.
   */
  const [stage, setStage] = useState(start ? 1 : 0)
  const [dir, setDir] = useState(1)
  const reduced = usePrefersReducedMotion()

  const go = (next: number) => {
    setDir(next > stage ? 1 : -1)
    setStage(next)
  }

  const mine = myOptions.find((day) => day.id === myDayId) ?? null

  // Both lists below the day belong to it, so neither can outlive a change of mind
  // about which day is being given: whoever cannot take the new one drops out here
  // rather than being cleared by the hand that picked it.
  const people = mine ? takers(mine) : []
  const person = people.find((u) => u.id === personId) ?? null

  const theirOptions = person && mine ? theyCouldGive(person, mine) : []
  const theirs = theirOptions.find((day) => day.id === theirDayId) ?? null

  async function request() {
    if (!person || !mine || !theirs) return
    setBusy(true)
    try {
      await swapsApi.create({
        myPlanDayId: mine.id,
        targetPlanDayId: theirs.id,
        targetUserId: person.id,
        note: note.trim() || undefined
      })
      toast.success('Pedido enviado.')
      onRequested()
      onClose()
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  /** Where you are in the three questions, and the way back to the ones behind. */
  const rail = (label: string) => (
    <div className="mb-3.5 flex items-center gap-2.5 border-b border-line-soft pb-2.5">
      {stage > 0 && (
        <button
          type="button"
          onClick={() => go(stage - 1)}
          aria-label="Voltar"
          className="-ml-1 rounded p-0.5 text-fg-soft hover:bg-[var(--hover2)] hover:text-fg-strong"
        >
          <ChevronLeft size={15} strokeWidth={1.8} />
        </button>
      )}
      <span className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn(
              'h-[5px] rounded-full transition-all',
              i === stage ? 'w-[14px] bg-accent' : 'w-[5px]',
              i < stage && 'bg-accent',
              i > stage && 'bg-line'
            )}
          />
        ))}
      </span>
      <span className="font-mono text-[9.5px] font-semibold tracking-[0.13em] text-fg-soft">
        {label}
      </span>
      {/* What has been answered already, so the question on screen has its context. */}
      {stage > 0 && mine && (
        <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-fg-muted">
          <span className="font-mono text-fg-soft">{shortDate(mine.date)}</span>
          {stage > 1 && person && (
            <>
              <span className="text-fg-faint">·</span>
              <Avatar user={person} className="h-[17px] w-[17px] text-[7.5px]" />
              {person.forename}
            </>
          )}
        </span>
      )}
    </div>
  )

  return (
    <Dialog
      open
      onOpenChange={(next) => !next && onClose()}
      title="Pedir troca"
      width={660}
      // The key does what PEDIR does and no more: the same guards the button
      // carries, so the last question is the only one it can answer.
      onSubmit={() => {
        if (stage === 2 && !busy && theirs) request()
      }}
      footer={
        <>
          {/* What is about to be asked, in one line, so PEDIR is never a guess. */}
          <span className="mr-auto flex items-center gap-2 font-mono text-[11.5px] text-fg-muted">
            {mine && theirs && person ? (
              <>
                <span className="text-fg-strong">{shortDate(mine.date)}</span>
                <ArrowLeftRight size={13} strokeWidth={1.6} className="text-fg-faint" />
                <span className="text-fg-strong">{shortDate(theirs.date)}</span>
                <span className="text-fg-soft">com {person.forename}</span>
              </>
            ) : (
              <span className="text-fg-faint">Escolha o dia, com quem, e o dia de volta.</span>
            )}
          </span>
          <Button variant="ghost" onClick={onClose}>CANCELAR</Button>
          {stage === 2 && (
            <Button
              variant="default"
              disabled={busy || !theirs}
              onClick={request}
              // The key that presses this button, said in the tooltip rather than
              // on the button: the footer already carries the request in one line.
              title={comboText('mod+enter')}
            >
              PEDIR
            </Button>
          )}
        </>
      }
    >
      {myDays.length === 0 ? (
        <Empty title="Não tem dias para trocar." hint="Só contam dias futuros de um plano publicado." />
      ) : myOptions.length === 0 ? (
        <Empty
          title="Ninguém com quem trocar."
          hint="Uma troca precisa de um dia seu que o outro possa aceitar e de um dia dele que possa aceitar."
        />
      ) : (
        /*
         * The box takes the height of whichever question is in it, and the questions
         * slide the way you are travelling. `layout` on the frame is what makes the
         * edge move rather than jump: the same container, a different size, which is
         * what tells you this is one form progressing and not three dialogs.
         */
        <motion.div
          layout={!reduced}
          transition={{ duration: reduced ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="min-h-[290px] overflow-hidden"
        >
          <AnimatePresence mode="wait" initial={false} custom={dir}>
            <motion.div
              key={stage}
              initial={reduced ? false : { opacity: 0, x: dir * 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: dir * -18 }}
              transition={{ duration: reduced ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              {stage === 0 && (
                <div>
                  {rail('QUE DIA ENTREGA')}
                  <DayCalendar
                    days={myOptions}
                    selected={mine}
                    onSelect={(day) => {
                      // The day taken on is read against the day given up, so it goes
                      // when that changes. Who is being asked survives it when they
                      // can take the new day, and falls out of the list when not.
                      if (day.id !== myDayId) setTheirDayId(null)
                      setMyDayId(day.id)
                      go(1)
                    }}
                  />
                </div>
              )}

              {stage === 1 && mine && (
                <div>
                  {rail('COM QUEM')}
                  {/* Bounded, so forty people scroll inside the question rather than
                      making the dialog taller than the window. */}
                  <div className="flex max-h-[340px] flex-wrap content-start gap-1.5 overflow-y-auto pr-1">
                    {people.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => {
                          setPersonId(u.id)
                          // The day ahead belongs to the person chosen here, so it
                          // cannot outlive a change of mind about who is being asked.
                          setTheirDayId(null)
                          go(2)
                        }}
                        aria-pressed={u.id === personId}
                        className={cn(
                          'flex h-[30px] shrink-0 items-center gap-2 rounded border py-0.5 pl-0.5 pr-2.5 transition-colors',
                          u.id === personId
                            ? 'border-accent bg-accent-wash text-fg-strong'
                            : 'border-line-soft text-fg-muted hover:border-line hover:bg-[var(--hover2)]'
                        )}
                      >
                        <Avatar user={u} className="h-[21px] w-[21px] text-[8.5px]" />
                        <span className="text-[12px]">{u.displayName}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {stage === 2 && person && (
                <div>
                  {rail(`FICA COM ${person.forename.toUpperCase()}`)}
                  <DayCalendar
                    days={theirOptions}
                    selected={theirs}
                    onSelect={(day) => setTheirDayId(day.id)}
                  />
                  {theirs && (
                    <div className="mt-3">
                      <Label htmlFor="troca-nota">NOTA</Label>
                      <Input
                        id="troca-nota"
                        className="w-full"
                        maxLength={256}
                        placeholder="Opcional"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </Dialog>
  )
}

/** The days this person owes, as a list they can start a trade from. */
function MyDays({
  days, teams, userId, today, open, onOpenChange, onTrade
}: {
  days: ScheduledDay[]
  teams: Team[]
  userId: number
  today: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onTrade: (day: ScheduledDay) => void
}) {
  const teamName = new Map(teams.map((t) => [t.id, t.name]))
  const mine = days
    .filter(
      (day) =>
        day.planStatus === 'PUBLISHED' &&
        !day.isHoliday &&
        day.date > today &&
        day.assigned.some((u) => u.id === userId)
    )
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="As minhas presenças" width={520}>
      {mine.length === 0 ? (
        <Empty title="Sem presenças marcadas." hint="Só contam os planos publicados." />
      ) : (
        <div className="flex flex-col">
          {mine.map((day) => (
            <div
              key={`${day.teamId}-${day.id}`}
              className="flex items-center gap-2.5 border-b border-line-soft py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-mono text-[12.5px] text-fg-strong">{ptDate(day.date)}</span>
                  {teams.length > 1 && (
                    <span
                      className="rounded px-1 font-mono text-[9.5px] tracking-[0.06em]"
                      style={teamMark(teamName.get(day.teamId) ?? '')}
                    >
                      {teamTag(teamName.get(day.teamId) ?? '')}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {day.assigned.filter((u) => u.id !== userId).map((u) => <Who key={u.id} user={u} />)}
                </div>
              </div>
              <Button size="sm" onClick={() => onTrade(day)}>
                <ArrowLeftRight size={13} strokeWidth={1.6} />
                TROCAR
              </Button>
            </div>
          ))}
        </div>
      )}
    </Dialog>
  )
}
function Who({ user }: { user: User }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-fg">
      <Avatar user={user} className="h-[18px] w-[18px] text-[8px]" />
      {user.forename}
    </span>
  )
}

function BigMonth({ year, month, byDate, awayByDate, members, weekdays, teamName, showTags, today, userId, onTrade }: {
  year: number
  month: number
  byDate: Map<string, ScheduledDay[]>
  awayByDate: Map<string, User[]>
  members: User[]
  /** Every weekday some commitment wants, as JS day numbers. */
  weekdays: Set<number>
  teamName: Map<number, string>
  /** Only worth naming the schedule when there is more than one to tell apart. */
  showTags: boolean
  today: string
  userId: number | null
  /** Starts a trade from a day the reader is on. */
  onTrade: (day: ScheduledDay) => void
}) {
  const [legend, legendMore] = capped(members, LEGEND_NAMES)
  return (
    <Card className="flex min-w-0 flex-1 flex-col p-4">
      <div className="mb-3.5 flex items-center justify-between gap-4">
        <div className="text-[15px] font-semibold capitalize text-fg-strong">
          {monthName(month)} <span className="font-mono font-normal text-fg-soft">{year}</span>
        </div>
        {/* A key is only a key while it can be read. Forty two names wrapped it into
            three lines standing on top of the month it was meant to annotate, and
            nobody matches a colour to a name by scanning three lines. It names as
            many as a line holds and counts the rest. */}
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
          {legend.map((member) => (
            <span key={member.id} className="inline-flex items-center gap-1.5 text-[11px] text-fg-muted">
              <i
                className="h-[3px] w-3.5 rounded-full not-italic"
                style={{ background: memberColour(member.id) }}
              />
              {member.forename}
            </span>
          ))}
          {legendMore > 0 && (
            <span className="font-mono text-[10px] text-fg-faint">+{legendMore}</span>
          )}
          <span className="font-mono text-[10px] tracking-[0.06em] text-fg-faint">FÉRIAS</span>
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-7 gap-px">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="pl-1.5 font-mono text-[9.5px] font-semibold tracking-[0.1em] text-fg-faint">
            {d.toUpperCase()}
          </span>
        ))}
      </div>
      {/* The rows grow to whatever the fullest day needs. A fixed cap was fine
          while a day meant two people and silently cut the sixth off an AT day. */}
      {/* One ruled sheet rather than thirty five boxes. The grid draws a single
          hairline and the days are cells inside it, so the one line weight on the
          page belongs to the grid itself and nothing is left over for a cell to
          spend saying it has a plan, that it is yours, or that it is today. Those
          three are said away from the cell edge: by the surface it stands on, by the
          pin beside the date, and by the date itself in inverse video. */}
      <div className="grid flex-1 auto-rows-[minmax(66px,auto)] content-stretch grid-cols-7 gap-px border border-line-soft bg-line-soft">
        {monthGrid(year, month).map((iso, index) => {
          // The days either side of the month are still cells of the sheet, so they
          // carry the page colour rather than leaving a hole in the ruling.
          if (!iso) return <div key={index} className="bg-card" />
          const days = byDate.get(iso) ?? []
          const holiday = days.find((d) => d.isHoliday)
          const scheduled = days.filter((d) => !d.isHoliday)
          const away = awayByDate.get(iso) ?? []
          const isOnSite = weekdays.has(new Date(iso + 'T00:00:00Z').getUTCDay())
          // The day the reader themselves has to be somewhere. It is the one thing
          // they scan this grid for, so it is marked rather than left to be found by
          // reading every name.
          const own = userId === null
            ? undefined
            : scheduled.find((d) => d.assigned.some((u) => u.id === userId))
          const canTrade = Boolean(own && own.planStatus === 'PUBLISHED' && iso > today)
          const cell = (
            <div
              style={stagger(index, 14, 34)}
              className={cn(
                'animate-rise',
                'flex min-h-0 flex-col gap-0.5 overflow-hidden bg-card p-1.5',
                scheduled.length > 0 && 'bg-elev',
                holiday && scheduled.length === 0 && 'hatch',
                // A day the team is normally on site with nobody on it yet. The page
                // colour is a step under the card in both themes, so the cell reads
                // as a slot with nothing in it rather than as a day off.
                days.length === 0 && isOnSite && 'bg-bg',
                canTrade && 'cursor-pointer hover:bg-[var(--hover2)]'
              )}
              {...(canTrade && own
                ? {
                    onClick: () => onTrade(own),
                    role: 'button',
                    tabIndex: 0,
                    title: 'Pedir troca deste dia',
                    onKeyDown: (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onTrade(own)
                      }
                    }
                  }
                : {})}
            >
              <div className="flex items-baseline justify-between gap-1">
                <span
                  className={cn(
                    'flex items-center gap-1 font-mono text-xs text-fg-soft',
                    scheduled.length > 0 && 'font-semibold text-fg-strong',
                    holiday && scheduled.length === 0 && 'text-fg-faint line-through'
                  )}
                >
                  {/* Today, in inverse video on the date. It is the flattest mark on
                      the grid and it spends no line at all, which is the whole point
                      of moving it off the cell. */}
                  <span className={cn(iso === today && 'bg-accent px-1 text-accent-fg')}>
                    {dayOf(iso)}
                  </span>
                  {own && (
                    <MapPin
                      size={11}
                      strokeWidth={2}
                      className="shrink-0 text-accent"
                      aria-label="Tem de estar presente"
                    />
                  )}
                </span>
                {/* The mark sits in the corner beside the date rather than on a line
                    of its own: it labels the cell, it is not one of its entries. */}
                {showTags && scheduled.length > 0 && (
                  <span className="flex gap-1 font-mono text-[8.5px] font-semibold tracking-[0.1em]">
                    {scheduled.map((d) => {
                      const name = teamName.get(d.teamId) ?? ''
                      return (
                        <span key={d.teamId} style={teamMark(name)} title={name}>
                          {teamTag(name)}
                        </span>
                      )
                    })}
                  </span>
                )}
              </div>
              {holiday && (
                <span className="truncate text-[8.5px] leading-tight text-fg-soft">{holiday.holidayName}</span>
              )}
              {/* One line per commitment, each drawing itself at whatever density its
                  own numbers call for.

                  Naming everybody was right while a day meant two people and a full
                  one meant six: the list simply grew. Forty took it to nearly eight
                  hundred pixels, and because a grid row is as tall as its tallest
                  cell, the six days either side became eight hundred pixels of
                  nothing. Stacking two shortened lists was worse still: a person on
                  both rosters was printed twice, under two counts, with nothing to
                  say which list was which. The label behind the cell is where the
                  names live now, and it is what the count points at. */}
              {scheduled.map((day) => {
                const shape = density(day.assigned.length)
                return (
                  <div key={day.teamId} className="flex min-w-0 flex-col gap-0.5">
                    {shape === 'names' &&
                      day.assigned.map((user) => (
                        <span key={user.id} className="flex min-w-0 items-center gap-1 text-[9.5px] text-fg">
                          <Avatar user={user} className="h-[13px] w-[13px] shrink-0 text-[6.5px]" />
                          <span className="hidden truncate lg:inline">{user.displayName}</span>
                        </span>
                      ))}

                    {shape === 'marks' && <AvatarCircles users={day.assigned} limit={CELL_MARKS} size={14} />}

                    {/* Set as a name is set, because it stands in the same list and
                        in place of the names. In mono at twelve pixels beside sans at
                        nine and a half it read as a different kind of thing
                        altogether — a heading over the list rather than the last line
                        of it. */}
                    {shape === 'count' && (
                      <span className="flex min-w-0 items-center gap-1 text-[9.5px] text-fg">
                        {day.assigned.length} pessoas
                      </span>
                    )}
                  </div>
                )
              })}
              {/* Absences sit quieter than assignments: the plan is what the page is
                  about, and who is away is context for reading it.

                  One bar for the quantity rather than one mark per person. Split
                  between forty of them, the gaps alone came to more than the cell was
                  wide and every mark solved to nothing, so a day with the whole team
                  away drew an empty strip. Given a floor instead they filled the
                  width and read as a dotted rule. How much of the roster is gone is
                  the fact the cell can carry at this size; who they are is in the
                  label. */}
              {away.length > 0 && (
                <div className="mt-auto flex shrink-0 gap-[3px] pt-0.5">
                  {away.length <= AWAY_MARKS ? (
                    // Few enough to keep a mark each, which is worth more than the
                    // ribbon: at this size you can still tell one person from
                    // another, and hovering names them.
                    away.map((user) => (
                      <i
                        key={user.id}
                        title={user.displayName}
                        className="h-[3px] flex-1 rounded-full not-italic"
                        style={{ background: memberColour(user.id), opacity: 0.75 }}
                      />
                    ))
                  ) : (
                    <Bar className="h-[3px] w-full" fraction={1} colour={memberGradient(away)} />
                  )}
                </div>
              )}
            </div>
          )
          // Always the Tooltip, never a bare wrapper: with no content it renders a
          // fragment, so the cell stays the grid item. Wrapping only the empty days
          // in a div made them size to their contents while their neighbours
          // stretched, and the row came out ragged.
          return (
            <Tooltip
              key={iso}
              content={
                days.length || away.length
                  ? <DayLabel iso={iso} days={days} away={away} teamName={teamName} />
                  : null
              }
            >
              {cell}
            </Tooltip>
          )
        })}
      </div>
    </Card>
  )
}

function DayLabel({ iso, days, away, teamName }: {
  iso: string
  days: ScheduledDay[]
  away: User[]
  teamName: Map<number, string>
}) {
  const holiday = days.find((d) => d.isHoliday)
  return (
    <div className="flex flex-col gap-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-fg-soft">
        {longDate(iso)}
      </div>
      {holiday && (
        <div className="flex flex-col gap-1">
          <DayLabelHeading>Feriado</DayLabelHeading>
          <span className="text-fg-strong">{holiday.holidayName}</span>
        </div>
      )}
      {/* Named in full here, where there is room for it: the cell only had space
          for the three-letter mark.

          One name per line, each behind the same colour mark the cell uses. Joined
          with commas they wrapped into a paragraph of six names that had to be read
          rather than scanned, and nothing tied a name in the label to the same person
          in the grid underneath. */}
      {days.filter((d) => !d.isHoliday).map((day) => (
        <div key={day.teamId} className="flex flex-col gap-1">
          <DayLabelHeading>{teamName.get(day.teamId) ?? 'Presencial'}</DayLabelHeading>
          {day.assigned.length ? (
            day.assigned.map((user) => <DayLabelName key={user.id} user={user} />)
          ) : (
            <span className="text-fg-muted">Ninguém disponível</span>
          )}
        </div>
      ))}
      {/* Absences sit quieter than assignments here too, and behind a rule: who is
          away is context for reading the plan, not part of it. */}
      {away.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-line pt-1.5">
          <DayLabelHeading>Férias</DayLabelHeading>
          {away.map((user) => (
            <DayLabelName key={user.id} user={user} muted />
          ))}
        </div>
      )}
    </div>
  )
}

function DayLabelHeading({ children }: { children: ReactNode }) {
  return (
    <div className="font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-soft">
      {children}
    </div>
  )
}

function DayLabelName({ user, muted = false }: { user: User; muted?: boolean }) {
  return (
    <span className={cn('flex items-center gap-1.5', muted ? 'text-fg-muted' : 'text-fg-strong')}>
      <Avatar
        user={user}
        className="h-[14px] w-[14px] shrink-0 text-[7px]"
        style={{ opacity: muted ? 0.75 : 1 }}
      />
      {user.displayName}
    </span>
  )
}

function MiniMonth({ year, month, byDate, awayByDate, teamName, today }: {
  year: number
  month: number
  byDate: Map<string, ScheduledDay[]>
  awayByDate: Map<string, User[]>
  teamName: Map<number, string>
  today: string
}) {
  return (
    <Card className="px-3 py-3">
      <h3 className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-fg-strong">
        {monthName(month)}
        {month === 1 && <span className="ml-1.5 font-normal text-fg-soft">{year}</span>}
      </h3>
      <div className="mb-1 grid grid-cols-7 gap-0.5">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="text-center font-mono text-[8.5px] text-fg-faint">
            {d.charAt(0)}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {monthGrid(year, month).map((iso, index) => {
          if (!iso) return <div key={index} className="h-6" />
          const days = byDate.get(iso) ?? []
          const holiday = days.find((d) => d.isHoliday)
          const scheduled = days.filter((d) => !d.isHoliday)
          const away = awayByDate.get(iso) ?? []
          const onDuty = scheduled.reduce((n, day) => n + day.assigned.length, 0)
          const weekday = new Date(iso + 'T00:00:00Z').getUTCDay()
          const isWeekend = weekday === 0 || weekday === 6
          const cell = (
            <div
              className={cn(
                'flex h-[26px] flex-col items-center justify-center gap-[1px]',
                'font-mono text-[10px] text-fg-soft',
                scheduled.length > 0 && 'bg-elev font-semibold text-fg-strong',
                holiday && scheduled.length === 0 && 'hatch text-fg-faint line-through',
                isWeekend && days.length === 0 && 'text-fg-faint'
              )}
            >
              {/* Two edges carry the two facts: who is on site along the top,
                  who is away along the bottom. Both fit without crowding the
                  number, and a day can show both at once. */}
              <span className="flex h-[2px] w-full px-[3px]">
                {onDuty > 0 && (
                  <Bar
                    className="h-[2px] w-full"
                    fraction={1}
                    colour={memberGradient(scheduled.flatMap((day) => day.assigned))}
                  />
                )}
              </span>
              <span className={cn('leading-none', iso === today && 'bg-accent px-1 text-accent-fg')}>
                {dayOf(iso)}
              </span>
              <span className="flex h-[2px] w-full gap-[1px] px-[3px]">
                {away.length > 0 &&
                  (away.length <= AWAY_MARKS ? (
                    away.map((user) => (
                      <i
                        key={user.id}
                        className="h-full flex-1 rounded-full not-italic"
                        style={{ background: memberColour(user.id), opacity: 0.55 }}
                      />
                    ))
                  ) : (
                    <Bar className="h-[2px] w-full" fraction={1} colour={memberGradient(away)} />
                  ))}
              </span>
            </div>
          )
          // Only days that have something to say get a label, so hovering an
          // ordinary Tuesday does not pop an empty box.
          // Always the Tooltip, never a bare wrapper: with no content it renders a
          // fragment, so the cell stays the grid item. Wrapping only the empty days
          // in a div made them size to their contents while their neighbours
          // stretched, and the row came out ragged.
          return (
            <Tooltip
              key={iso}
              content={
                days.length || away.length
                  ? <DayLabel iso={iso} days={days} away={away} teamName={teamName} />
                  : null
              }
            >
              {cell}
            </Tooltip>
          )
        })}
      </div>
    </Card>
  )
}

/** Months ahead of the main one, shown small in the rail. */
const RAIL_MONTHS = 3

const shiftMonth = ({ year, month }: Cursor, by: number): Cursor => {
  const zero = year * 12 + (month - 1) + by
  return { year: Math.floor(zero / 12), month: (zero % 12) + 1 }
}

const monthStart = ({ year, month }: Cursor) => `${year}-${String(month).padStart(2, '0')}-01`
const monthEnd = (cursor: Cursor) => {
  const next = shiftMonth(cursor, 1)
  return new Date(Date.UTC(next.year, next.month - 1, 0)).toISOString().slice(0, 10)
}

interface Cursor {
  year: number
  month: number
}

export function Dashboard() {
  const { user } = useAuth()
  const swaps = useSwaps()
  const today = todayIso()
  const [myDaysOpen, setMyDaysOpen] = useState(false)
  // Null while no request is being made. Mounting the dialog only for the duration of
  // one means every request starts from an empty form.
  const [trading, setTrading] = useState<{ day: ScheduledDay | null } | null>(null)
  const [cursor, setCursor] = useState<Cursor>(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() + 1 }
  })

  // The stepper's keys. Not while a dialog is open: the arrows would be moving a
  // month nobody can see behind it.
  const dialogUp = myDaysOpen || trading !== null
  useHotkey('arrowleft', () => setCursor((c) => shiftMonth(c, -1)), { enabled: !dialogUp })
  useHotkey('arrowright', () => setCursor((c) => shiftMonth(c, 1)), { enabled: !dialogUp })

  const from = monthStart(cursor)
  const to = monthEnd(shiftMonth(cursor, RAIL_MONTHS))

  const { data, loading, error } = useAsync(async () => {
    // Every commitment, not the first one: this is the page that answers "where do I
    // have to be", and that question does not stop at one schedule.
    const teams = await teamsApi.list()
    if (teams.length === 0) return { teams, days: [] as ScheduledDay[], away: [] }

    const [away, summaries] = await Promise.all([
      absencesApi.list({ from, to }),
      Promise.all(teams.map((team) => plansApi.list(team.id))).then((lists) => lists.flat())
    ])
    // Only the plans overlapping what is on screen, and the list endpoint returns
    // summaries without days, so each of those is fetched in full.
    const visible = summaries.filter((plan) => plan.periodStart <= to && plan.periodEnd >= from)
    const full = await Promise.all(visible.map((plan) => plansApi.get(plan.id)))
    return {
      teams,
      // The plan travels with each day: which commitment it belongs to, and whether it
      // is published, which is what decides if it can be traded.
      days: full.flatMap((plan) =>
        plan.days.map((day) => ({
          ...day, teamId: plan.teamId, planId: plan.id, planStatus: plan.status
        }))
      ),
      away
    }
  }, [from, to])

  const byDate = useMemo(() => indexPlanDays(data?.days ?? []), [data])
  const awayByDate = useMemo(() => indexAbsences(data?.away ?? []), [data])
  const peopleAway = useMemo(() => {
    const seen = new Map<number, User>()
    ;(data?.away ?? []).forEach((absence) => seen.set(absence.user.id, absence.user))
    return [...seen.values()].sort((a, b) => a.forename.localeCompare(b.forename))
  }, [data])
  const next = useMemo(() => firstUpcoming(data?.days ?? [], today), [data, today])

  const teamName = useMemo(
    () => new Map((data?.teams ?? []).map((team: Team) => [team.id, team.name])),
    [data]
  )
  // Which weekdays are owed to somebody, so a date with no plan yet can still be
  // marked as one that will want people on it.
  const onSiteWeekdays = useMemo(
    () => new Set((data?.teams ?? []).map((team: Team) => team.onSiteWeekday % 7)),
    [data]
  )

  const onSite = (data?.days ?? []).filter((d) => !d.isHoliday).length
  const mine = (data?.days ?? []).filter((d) => d.assigned.some((a) => a.id === user?.id)).length
  const understaffed = (data?.days ?? []).filter((d) => d.understaffed).length
  const awayToday = awayByDate.get(today) ?? []
  const awayNow = awayToday.length
  const rail = Array.from({ length: RAIL_MONTHS }, (_, i) => shiftMonth(cursor, i + 1))
  const onToday = cursor.year === Number(today.slice(0, 4)) && cursor.month === Number(today.slice(5, 7))

  return (
    <Shell
      title="Dashboard"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={() => setTrading({ day: null })}>
            <ArrowLeftRight size={14} strokeWidth={1.6} />
            PEDIR TROCA
          </Button>
          {!onToday && (
            <button
              onClick={() => {
                const now = new Date()
                setCursor({ year: now.getFullYear(), month: now.getMonth() + 1 })
              }}
              title="Voltar ao mês atual"
              aria-label="Voltar ao mês atual"
              className="flex h-[31px] items-center rounded border border-line px-2.5 text-fg-muted hover:bg-[var(--hover2)] hover:text-fg-strong"
            >
              <CalendarCheck size={15} strokeWidth={1.6} />
            </button>
          )}
          <div className="flex h-[31px] items-center rounded border border-line">
            <button
              onClick={() => setCursor((c) => shiftMonth(c, -1))}
              aria-label="Mês anterior"
              title={`Mês anterior · ${comboText('arrowleft')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronLeft size={15} strokeWidth={1.6} />
            </button>
            <span className="w-[150px] border-x border-line text-center font-mono text-[12.5px] font-semibold uppercase leading-[29px] text-fg-strong">
              {monthShort(cursor.month)} {cursor.year}
            </span>
            <button
              onClick={() => setCursor((c) => shiftMonth(c, 1))}
              aria-label="Mês seguinte"
              title={`Mês seguinte · ${comboText('arrowright')}`}
              className="flex h-full items-center px-2.5 text-fg-muted hover:text-fg-strong"
            >
              <ChevronRight size={15} strokeWidth={1.6} />
            </button>
          </div>
        </div>
      }
    >
      {error && <Badge tone="danger">{error}</Badge>}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <>
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-[70px]" />
            <Skeleton className="h-[70px]" />
          </>
        ) : (
          <>
            <Stat
              label="PRÓXIMA PRESENÇA"
              value={next ? shortDate(next.date).toUpperCase() : '—'}
              tone="accent"
              aside={
                <div className="flex max-w-[150px] flex-col items-end gap-1.5">
                  {/* Which commitment, because "next Wednesday" and "next Monday" are
                      not the same errand and may not be at the same address. */}
                  {next && (
                    <span className="font-mono text-[10px] tracking-[0.08em] text-fg-faint">
                      {(teamName.get(next.teamId) ?? '').toUpperCase()}
                    </span>
                  )}
                  {/* Marks rather than a named list: six people turned a stat tile
                      into a roster. The calendar below names them. */}
                  <div className="flex flex-wrap justify-end gap-1">
                    {next?.assigned.map((u) => (
                      <Avatar key={u.id} user={u} className="h-[18px] w-[18px] text-[8px]" />
                    ))}
                  </div>
                </div>
              }
            />
            <Stat
              label="AS MINHAS PRESENÇAS"
              count={mine}
              index={1}
              onClick={() => setMyDaysOpen(true)}
              aside={
                <div className="w-[86px] text-right">
                  <div className="mb-1.5 font-mono text-[11px] leading-tight text-fg-soft">
                    de {onSite} no ano
                  </div>
                  <Bar
                    fraction={onSite ? mine / onSite : 0}
                    colour={user ? memberColour(user.id) : 'var(--acc)'}
                    delay={280}
                  />
                </div>
              }
            />
            <Stat
              label="EM FÉRIAS"
              count={awayNow}
              index={2}
              aside={
                awayToday.length > 0 ? (
                  /* A few of them, and then the count. The whole list used to stand
                     here: forty two people turned a seventy pixel tile into a nine
                     hundred pixel one, and because the four tiles share a row, the
                     three beside it stretched to match and the calendar was pushed
                     off the bottom of the screen. The number to the left is already
                     the total, so the names are a sample of it, not the record. */
                  <AvatarCircles users={awayToday} limit={TILE_MARKS} size={18} className="justify-end" />
                ) : (
                  <div className="text-right font-mono text-[11px] leading-tight text-fg-soft">
                    hoje
                  </div>
                )
              }
            />
            <Stat
              label="POR RESOLVER"
              count={understaffed}
              index={3}
              tone={understaffed > 0 ? 'warn' : undefined}
              aside={
                <div className="text-right font-mono text-[11px] leading-tight text-fg-soft">
                  dias sem
                  <br />
                  equipa completa
                </div>
              }
            />
          </>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-4 xl:flex-row">
          <Skeleton className="min-h-[420px] flex-1" />
          <Skeleton className="min-h-[120px] xl:w-[266px]" />
        </div>
      ) : data?.days.length ? (
        <div className="flex flex-1 flex-col gap-4 xl:flex-row">
          <BigMonth
            year={cursor.year}
            month={cursor.month}
            byDate={byDate}
            awayByDate={awayByDate}
            members={peopleAway}
            weekdays={onSiteWeekdays}
            teamName={teamName}
            showTags={(data.teams?.length ?? 0) > 1}
            today={today}
            userId={user?.id ?? null}
            onTrade={(day) => setTrading({ day })}
          />
          {/* The rail scrolls on its own rather than stretching the row: the month
              beside it is the thing worth giving the height to. */}
          <div className="flex shrink-0 flex-col gap-3 overflow-auto xl:w-[266px]">
            {rail.map((m) => (
              <MiniMonth
                key={`${m.year}-${m.month}`}
                year={m.year}
                month={m.month}
                byDate={byDate}
                awayByDate={awayByDate}
                teamName={teamName}
                today={today}
              />
            ))}
          </div>
        </div>
      ) : (
        <Card className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <div className="text-[13px] text-fg-muted">
              Sem plano em {monthName(cursor.month)} de {cursor.year}.
            </div>
            {/* Only an administrator can act on this, so only they are told to. */}
            {user?.isAdmin && <div className="mt-1.5 text-xs text-fg-soft">Gere um em Plano.</div>}
          </div>
        </Card>
      )}

      {user && (
        <MyDays
          days={data?.days ?? []}
          teams={data?.teams ?? []}
          userId={user.id}
          today={today}
          open={myDaysOpen}
          onOpenChange={setMyDaysOpen}
          onTrade={(day) => {
            setMyDaysOpen(false)
            setTrading({ day })
          }}
        />
      )}

      {user && trading && (
        <SwapDialog
          days={data?.days ?? []}
          awayByDate={awayByDate}
          userId={user.id}
          today={today}
          preset={trading.day}
          onClose={() => setTrading(null)}
          onRequested={swaps.reload}
        />
      )}
    </Shell>
  )
}
