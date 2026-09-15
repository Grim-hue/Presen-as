import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { DayPicker, type DateRange } from 'react-day-picker'
import { pt } from 'react-day-picker/locale'
import { monthName, WEEKDAYS_LONG } from '@/lib/utils'

const toDate = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const toIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

const addMonths = (from: Date, n: number) => {
  const d = new Date(from)
  d.setMonth(d.getMonth() + n)
  return d
}

/** ISO weekday of a Date, 1 = Monday, matching the team's own numbering. */
const isoDay = (d: Date) => ((d.getDay() + 6) % 7) + 1

/**
 * Choosing the period a plan covers.
 *
 * Two date fields asked for the period one end at a time and showed neither: a plan
 * runs over months, and typing 07/09 and 01/11 says nothing about how many days that
 * comes to or where they fall. This shows the run itself, and marks the weekday the
 * team is actually on site, so the thing being chosen is visible while it is chosen.
 *
 * The presets are the answer most of the time — a plan is usually a quarter — and the
 * calendar is there for when it is not.
 */
export function DateRangePicker({ from, to, onSiteWeekday, onChange }: {
  from: string
  to: string
  /** The team's on-site weekday, marked so the period reads as days rather than dates. */
  onSiteWeekday: number
  onChange: (from: string, to: string) => void
}) {
  const [month, setMonth] = useState(() => toDate(from))

  const range: DateRange = { from: toDate(from), to: toDate(to) }
  const days = countOnSite(from, to, onSiteWeekday)

  const preset = (months: number) => {
    const start = new Date()
    onChange(toIso(start), toIso(addMonths(start, months)))
    setMonth(start)
  }

  const toYearEnd = () => {
    const start = new Date()
    onChange(toIso(start), `${start.getFullYear()}-12-31`)
    setMonth(start)
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: '1 MÊS', run: () => preset(1) },
          { label: '3 MESES', run: () => preset(3) },
          { label: '6 MESES', run: () => preset(6) },
          { label: 'ATÉ AO FIM DO ANO', run: toYearEnd }
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={p.run}
            className="rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] tracking-[0.08em] text-fg-muted transition-colors hover:bg-[var(--hover2)] hover:text-fg-strong"
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex h-[28px] items-center rounded border border-line">
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, -1))}
          aria-label="Mês anterior"
          className="flex h-full items-center px-2 text-fg-muted hover:text-fg-strong"
        >
          <ChevronLeft size={14} strokeWidth={1.8} />
        </button>
        <span className="flex-1 border-x border-line text-center font-mono text-[11.5px] font-semibold uppercase leading-[26px] text-fg-strong">
          {monthName(month.getMonth() + 1)} {month.getFullYear()}
        </span>
        <button
          type="button"
          onClick={() => setMonth((m) => addMonths(m, 1))}
          aria-label="Mês seguinte"
          className="flex h-full items-center px-2 text-fg-muted hover:text-fg-strong"
        >
          <ChevronRight size={14} strokeWidth={1.8} />
        </button>
      </div>

      <DayPicker
        mode="range"
        locale={pt}
        weekStartsOn={1}
        month={month}
        onMonthChange={setMonth}
        hideNavigation
        showOutsideDays={false}
        selected={range}
        onSelect={(next) => {
          if (!next?.from) return
          // Mid-drag there is only a start. Holding the end at the start keeps the
          // period valid at every point rather than briefly inverted.
          onChange(toIso(next.from), toIso(next.to ?? next.from))
        }}
        // The day the team is on site, so the run reads as the days it will schedule
        // and not just as a span of dates.
        modifiers={{ onSite: (d: Date) => isoDay(d) === onSiteWeekday }}
        modifiersClassNames={{ onSite: 'font-semibold underline decoration-dotted underline-offset-[3px]' }}
        classNames={{
          root: 'w-full',
          months: 'flex',
          month: 'w-full',
          month_caption: 'hidden',
          month_grid: 'w-full border-collapse',
          weekday:
            'pb-1 text-center font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-faint',
          day: 'p-0 text-center align-middle',
          day_button:
            'h-[28px] w-full rounded font-mono text-[11px] text-fg transition-colors hover:bg-[var(--hover2)]',
          selected: 'bg-accent-wash text-fg-strong',
          range_start: 'rounded-l bg-accent text-accent-fg',
          range_end: 'rounded-r bg-accent text-accent-fg',
          range_middle: 'bg-accent-wash text-fg-strong',
          today: 'text-accent',
          outside: 'opacity-0',
          disabled: 'text-fg-faint'
        }}
      />

      {/* What the two ends come to, which is the thing actually being decided. */}
      <p className="font-mono text-[11px] text-fg-soft">
        {days} {WEEKDAYS_LONG[onSiteWeekday - 1].toLowerCase()}
        {days === 1 ? '' : 's'}
        <span className="text-fg-faint"> · feriados à parte</span>
      </p>
    </div>
  )
}

/** How many of [weekday] fall between the two ends, both included. */
function countOnSite(from: string, to: string, weekday: number) {
  if (to < from) return 0
  let count = 0
  const end = toDate(to)
  for (const d = toDate(from); d <= end; d.setDate(d.getDate() + 1)) {
    if (isoDay(d) === weekday) count++
  }
  return count
}
