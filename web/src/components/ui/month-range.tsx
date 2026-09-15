import { useState } from 'react'
import { cn, monthShort, todayIso } from '@/lib/utils'

/** The first and last of a run, or nulls when nothing is chosen. */
type Ends = { from: string | null; to: string | null }

const yearOf = (month: string) => month.slice(0, 4)

/**
 * Choosing how much of a plan a message carries.
 *
 * A run, not a set of switches: what goes out is always a continuous stretch of the
 * plan, so the question is where it starts and where it ends. It was sixteen toggles
 * in a bar for a sixteen month plan — twelve of them for a year nobody was sending —
 * and a wall of buttons is not a smaller version of four buttons, it is a different
 * and worse control.
 *
 * Deliberately the twin of `date-range.tsx`, which is how Gerar asks for the period a
 * plan covers: presets on top because they are the answer most of the time, the grid
 * underneath for when they are not, and the same two ends filled and the middle
 * washed. The same gesture should not look like two different gestures a page apart.
 *
 * Months the plan does not cover are drawn and dead, as the day picker draws the days
 * either side of a month: a year with a hole in it reads as a year, and a year with
 * six cells reads as a mistake.
 */
export function MonthRangePicker({ all, from, to, onChange }: {
  /** Every month the plan covers, ascending, as `2026-09`. */
  all: string[]
  from: string | null
  to: string | null
  onChange: (from: string, to: string) => void
}) {
  /*
   * The end chosen first, while the other is still being pointed at. Null except
   * between the two clicks, which is the only time the grid shows a run that has not
   * been decided yet.
   */
  const [anchor, setAnchor] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)

  const years = [...new Set(all.map(yearOf))]
  const usable = new Set(all)
  const now = todayIso().slice(0, 7)

  // Mid-choice the run follows the pointer; otherwise it is what has been chosen.
  const ends: Ends = anchor
    ? { from: min(anchor, over ?? anchor), to: max(anchor, over ?? anchor) }
    : { from, to }

  function pick(month: string) {
    if (!anchor) {
      // Both ends on the same month, so the choice is never briefly inverted — the
      // trick the day picker uses mid-drag, for the same reason.
      setAnchor(month)
      onChange(month, month)
      return
    }
    onChange(min(anchor, month), max(anchor, month))
    setAnchor(null)
    setOver(null)
  }

  function preset(months: string[]) {
    if (months.length === 0) return
    setAnchor(null)
    onChange(months[0], months[months.length - 1])
  }

  const thisYear = all.filter((month) => yearOf(month) === now.slice(0, 4))
  const ahead = all.filter((month) => month >= now)

  return (
    <div className="flex w-[292px] flex-col gap-2.5">
      <div className="flex flex-wrap gap-1.5">
        {[
          { label: 'ESTE ANO', months: thisYear },
          { label: 'DAQUI EM DIANTE', months: ahead },
          { label: 'TUDO', months: all }
        ].map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={p.months.length === 0}
            onClick={() => preset(p.months)}
            className={cn(
              'rounded-full border border-line px-2.5 py-1 font-mono text-[9.5px] tracking-[0.08em]',
              'text-fg-muted transition-colors hover:bg-[var(--hover2)] hover:text-fg-strong',
              'disabled:pointer-events-none disabled:opacity-40'
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      {years.map((year) => (
        <div key={year}>
          <div className="mb-1 font-mono text-[9px] font-semibold tracking-[0.13em] text-fg-faint">
            {year}
          </div>
          <div className="grid grid-cols-6" onMouseLeave={() => setOver(null)}>
            {Array.from({ length: 12 }, (_, i) => {
              const month = `${year}-${String(i + 1).padStart(2, '0')}`
              const live = usable.has(month)
              const inRun = ends.from !== null && ends.to !== null &&
                month >= ends.from && month <= ends.to
              return (
                <button
                  key={month}
                  type="button"
                  disabled={!live}
                  aria-pressed={inRun}
                  onClick={() => pick(month)}
                  onMouseEnter={() => live && anchor && setOver(month)}
                  className={cn(
                    'h-[26px] font-mono text-[10.5px] uppercase transition-colors',
                    !live && 'cursor-default text-fg-faint opacity-55',
                    live && !inRun && 'rounded text-fg hover:bg-[var(--hover2)]',
                    inRun && 'bg-accent-wash text-fg-strong',
                    // The ends carry the fill and the rounding, so a run of one month
                    // is a single filled cell rather than half of something.
                    inRun && month === ends.from && 'rounded-l bg-accent text-accent-fg',
                    inRun && month === ends.to && 'rounded-r bg-accent text-accent-fg'
                  )}
                >
                  {monthShort(i + 1)}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <p className="font-mono text-[10.5px] text-fg-soft">
        {anchor ? 'Escolha o último mês.' : 'Carregue no primeiro e no último mês.'}
      </p>
    </div>
  )
}

const min = (a: string, b: string) => (a < b ? a : b)
const max = (a: string, b: string) => (a > b ? a : b)
