import type { Absence, Plan, PlanDay, User } from '@/services/types'

/** A month grid, Monday first, padded to whole weeks. */
export function monthGrid(year: number, month: number): (string | null)[] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const lead = (first.getUTCDay() + 6) % 7
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = Array(lead).fill(null)
  for (let day = 1; day <= length; day++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`)
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export const dayOf = (iso: string) => Number(iso.slice(8, 10))

/**
 * A plan day and the commitment it belongs to.
 *
 * The dashboard is the one place both schedules are shown together, so a day there
 * has to carry which one it came from: the same person can owe a Monday at the office
 * and a Wednesday at the client, and the two are not interchangeable.
 *
 * [planStatus] travels with it because drafts are shown on the calendar alongside
 * published days, and only a published day is settled enough to be traded.
 */
export type ScheduledDay = PlanDay & {
  teamId: number
  planId: number
  planStatus: Plan['status']
}

/**
 * Indexes every day of every plan by date, so a calendar cell is one lookup.
 *
 * A list per date rather than a single day: two commitments can land on the same
 * date, and dropping one of them would silently hide somebody's obligation.
 */
export function indexPlanDays(days: ScheduledDay[]): Map<string, ScheduledDay[]> {
  const byDate = new Map<string, ScheduledDay[]>()
  for (const day of days) {
    const already = byDate.get(day.date)
    if (already) already.push(day)
    else byDate.set(day.date, [day])
  }
  return byDate
}

export function firstUpcoming(days: ScheduledDay[], today: string): ScheduledDay | undefined {
  return days
    .filter((day) => !day.isHoliday && day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))[0]
}

/**
 * Who is away on each date, expanded from periods.
 *
 * Expanded once into a map rather than scanned per cell: a year of cells against a
 * list of absences is a lot of repeated range comparisons for something that only
 * changes when the data does.
 */
export function indexAbsences(absences: Absence[]): Map<string, User[]> {
  const byDate = new Map<string, User[]>()
  for (const absence of absences) {
    const end = new Date(absence.endDate + 'T00:00:00Z')
    for (
      let day = new Date(absence.startDate + 'T00:00:00Z');
      day <= end;
      day.setUTCDate(day.getUTCDate() + 1)
    ) {
      const iso = day.toISOString().slice(0, 10)
      const already = byDate.get(iso)
      if (already) {
        if (!already.some((u) => u.id === absence.user.id)) already.push(absence.user)
      } else {
        byDate.set(iso, [absence.user])
      }
    }
  }
  return byDate
}
