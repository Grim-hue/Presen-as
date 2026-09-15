import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DayPicker, type DayButtonProps } from 'react-day-picker'
import { pt } from 'react-day-picker/locale'
import type { ScheduledDay } from '@/lib/calendar'
import { cn, memberColour, monthName } from '@/lib/utils'

/** Local midnight, so a date never slips a day on the way in or out. */
const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const monthKey = (date: Date) => date.getFullYear() * 12 + date.getMonth()

/**
 * Choosing one day out of a set of allowed ones.
 *
 * A month at a time, because the alternative is a list and a list of dates does not
 * say when. What it costs is real and worth knowing: the days on offer are one
 * weekday of one team, four to seven a month across fifteen months, so most of every
 * grid is dates that cannot be picked.
 *
 * The stepper answers that. It moves between months that **have** a day on offer
 * rather than between calendar months, so a plan running to next November is a few
 * presses end to end and never lands on an empty grid. The count beside the month is
 * there for the same reason.
 *
 * `react-day-picker` does the calendar itself: which dates fall in which week, the
 * keyboard, the roles a grid needs. It was already a dependency here and unused. Its
 * own stylesheet is not imported — it carries its own colours, which would be wrong
 * in one of the two themes — so every class it draws with is named below in tokens.
 */
export function DayCalendar({ days, selected, onSelect }: {
  /** The only days that may be chosen. Everything else is drawn but refused. */
  days: ScheduledDay[]
  selected: ScheduledDay | null
  onSelect: (day: ScheduledDay) => void
}) {
  const byIso = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])

  /** Every month with something in it, in order, and how much. */
  const months = useMemo(() => {
    const counted = new Map<number, { date: Date; count: number }>()
    for (const day of days) {
      const date = toDate(day.date)
      const key = monthKey(date)
      const seen = counted.get(key)
      if (seen) seen.count += 1
      else counted.set(key, { date: new Date(date.getFullYear(), date.getMonth(), 1), count: 1 })
    }
    return [...counted.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [days])

  // Opens where the answer already is, or at the first month that has one.
  const [at, setAt] = useState(() => {
    if (selected) {
      const found = months.findIndex((m) => monthKey(m.date) === monthKey(toDate(selected.date)))
      if (found >= 0) return found
    }
    return 0
  })

  if (months.length === 0) return null

  const here = months[Math.min(at, months.length - 1)]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex h-[28px] items-center rounded border border-line">
          <button
            type="button"
            onClick={() => setAt((i) => Math.max(0, i - 1))}
            disabled={at === 0}
            aria-label="Mês anterior com dias"
            className="flex h-full items-center px-2 text-fg-muted hover:text-fg-strong disabled:opacity-30"
          >
            <ChevronLeft size={14} strokeWidth={1.8} />
          </button>
          <span className="w-[122px] border-x border-line text-center font-mono text-[11.5px] font-semibold uppercase leading-[26px] text-fg-strong">
            {monthName(here.date.getMonth() + 1)} {here.date.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => setAt((i) => Math.min(months.length - 1, i + 1))}
            disabled={at >= months.length - 1}
            aria-label="Mês seguinte com dias"
            className="flex h-full items-center px-2 text-fg-muted hover:text-fg-strong disabled:opacity-30"
          >
            <ChevronRight size={14} strokeWidth={1.8} />
          </button>
        </div>
        <span className="font-mono text-[10px] tracking-[0.08em] text-fg-faint">
          {here.count} {here.count === 1 ? 'DIA' : 'DIAS'}
        </span>
      </div>

      <DayPicker
        mode="single"
        locale={pt}
        weekStartsOn={1}
        month={here.date}
        // The stepper above owns which month is shown, so the built-in one would be a
        // second control saying something different.
        hideNavigation
        showOutsideDays={false}
        selected={selected ? toDate(selected.date) : undefined}
        disabled={(date: Date) => !byIso.has(toIso(date))}
        onSelect={(date) => {
          if (!date) return
          const day = byIso.get(toIso(date))
          if (day) onSelect(day)
        }}
        components={{
          // `option` rather than `day`: DayButton already has a `day`, which is the
          // calendar's own idea of a date, and this is the plan's.
          DayButton: (props: DayButtonProps) => (
            <DayCell {...props} option={byIso.get(toIso(props.day.date))} />
          )
        }}
        classNames={{
          root: 'w-full',
          months: 'flex',
          month: 'w-full',
          month_caption: 'hidden',
          month_grid: 'w-full border-collapse',
          weekdays: '',
          weekday:
            'pb-1 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-faint',
          week: '',
          day: 'p-[1px] text-center align-middle',
          today: '',
          outside: '',
          disabled: ''
        }}
      />
    </div>
  )
}

/**
 * One date in the grid.
 *
 * A day that can be taken shows who is already on it, as marks rather than names:
 * that is the thing the old list carried and the reason a bare calendar would have
 * been a step back. A day that cannot is still drawn, so the shape of the month is
 * intact, but it recedes.
 */
function DayCell({
  day,
  option,
  modifiers,
  className,
  ...props
}: DayButtonProps & { option?: ScheduledDay }) {
  const disabled = modifiers.disabled || !option
  const chosen = modifiers.selected

  return (
    <button
      {...props}
      type="button"
      disabled={disabled}
      className={cn(
        'flex h-[38px] w-full flex-col items-center justify-center gap-[3px] rounded border transition-colors',
        disabled && 'cursor-default border-transparent text-fg-faint',
        !disabled && !chosen && 'border-line-soft text-fg hover:border-line hover:bg-[var(--hover2)]',
        chosen && 'border-accent bg-accent-wash text-fg-strong',
        className
      )}
    >
      <span className={cn('font-mono text-[11.5px] leading-none', chosen && 'font-semibold')}>
        {day.date.getDate()}
      </span>
      {option && (
        <span className="flex h-[3px] items-center gap-[2px]">
          {option.assigned.slice(0, 5).map((user) => (
            <i
              key={user.id}
              className="h-[3px] w-[3px] rounded-full not-italic"
              style={{ background: memberColour(user.id) }}
            />
          ))}
        </span>
      )}
    </button>
  )
}
