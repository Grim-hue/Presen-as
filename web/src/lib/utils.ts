import type { CSSProperties } from 'react'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merges class names, letting a caller override a component's defaults. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The identity colour of each member, stable across both themes.
 *
 * Generated rather than chosen from a list. Six colours picked by `userId % 6` were
 * enough while a roster was six people and became a lie at forty: seven people wore
 * every colour, and a page showing forty two of them carried seven distinct
 * backgrounds in the whole document. Every surface that spends colour on identity —
 * the marks, the bands, the meters — was saying nothing.
 *
 * The hue turns by the golden angle each time, which is the arrangement that keeps
 * any number of them as far apart as they can get, and the next person added never
 * lands on the last one. Saturation and lightness are fixed, so white text holds its
 * contrast on every one of them and no colour is brighter in one theme than the
 * other. It is still one CSS colour string, so every call site is unchanged.
 */
export function memberColour(userId: number) {
  return `hsl(${((userId * 137.508) % 360).toFixed(1)} 62% 58%)`
}

export function initials(forename: string, surname: string) {
  return `${forename.charAt(0)}${surname.charAt(0)}`.toUpperCase()
}

const MONTHS = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
]
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

export const monthName = (month: number) => MONTHS[month - 1]
export const monthShort = (month: number) => MONTHS_SHORT[month - 1]

/** ISO date string to "7 set", without pulling in a locale bundle for two formats. */
export function shortDate(iso: string) {
  const [, m, d] = iso.split('-').map(Number)
  return `${d} ${MONTHS_SHORT[m - 1]}`
}

export function longDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${MONTHS[m - 1]} de ${y}`
}

export function ptDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * How each commitment's mark is painted.
 *
 * Kept here rather than in the component for the same reason as [memberColour]: it is
 * identity, applied per element, not a theme colour. A commitment with no entry falls
 * back to the muted token, so adding a third schedule is legible before anyone picks
 * a colour for it.
 */
const TEAM_MARKS: Record<string, CSSProperties> = {
  AT: { color: 'var(--mark-at)' },
  DEV: {
    backgroundImage: 'linear-gradient(90deg, var(--mark-dev-from), var(--mark-dev-to))',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent'
  }
}

export const teamMark = (name: string): CSSProperties => TEAM_MARKS[teamTag(name)] ?? {}

/**
 * A short mark for a commitment, for the calendar cells where the full name cannot
 * fit: "Development Team" reads as DEV, "AT — SPS" as AT.
 */
export function teamTag(name: string) {
  return name.trim().split(/[\s\u2014-]+/)[0].slice(0, 3).toUpperCase()
}

export const WEEKDAYS_LONG = [
  'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado', 'Domingo'
]
export const WEEKDAYS_SHORT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

/** ISO weekday of a date string, 1 = Monday, without constructing a Date in local time. */
export function isoWeekday(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return ((new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7) + 1
}

/**
 * Text as it is typed rather than as it is spelled.
 *
 * Nobody reaches for the acute to find André, and a search that insists on it is a
 * search that fails on half this roster: Gonçalves, João, Sória. Decomposing and
 * dropping the combining marks makes "goncalves" and "Gonçalves" the same string,
 * which is the only sense in which they differ to somebody in a hurry.
 */
export const fold = (text: string) =>
  text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/**
 * Whether every word typed appears somewhere in [fields], in any order.
 *
 * Word by word rather than as one string: "vieira joao" is the same person as "joao
 * vieira", and a plain `includes` of the whole query says otherwise. It is not fuzzy
 * matching — a typo still misses — but it covers the way people actually type a name
 * they already know, which is surname first as often as not.
 */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]) {
  const hay = fold(fields.filter(Boolean).join(' '))
  return fold(query).split(/\s+/).filter(Boolean).every((word) => hay.includes(word))
}

export const todayIso = () => new Date().toISOString().slice(0, 10)

/**
 * The first [limit] of [all], and how many were left over.
 *
 * Every list of people in this application is bounded now. A box laid out for six
 * of them does not become a box for forty by growing: a stat tile sized at seventy
 * pixels reached nine hundred and took the three tiles beside it with it, and a
 * calendar cell with a floor of sixty six pixels reached eight hundred. What the
 * box cannot show, it counts.
 */
export function capped<T>(all: T[], limit: number): [T[], number] {
  return [all.slice(0, limit), Math.max(0, all.length - limit)]
}

/**
 * What a box of people should draw, given how many there are.
 *
 * A box does not scale by truncation. Naming three of forty and counting the rest is
 * not a smaller version of naming three of three: it is a list that has stopped being
 * a list. So the box changes what it draws instead — names while they fit, then the
 * marks alone, then the number by itself — and each of the three is a whole answer at
 * the size it is used.
 */
export type Density = 'names' | 'marks' | 'count'

/*
 * Six, because six is a full day rather than a crowd. The AT roster asks for six
 * people and the development one for two, so naming up to six names every day either
 * of them has ever had — the ladder only starts climbing past what the schedules
 * actually ask for. Four cut the AT days in half and made the common case look like
 * the exception.
 */
export const density = (n: number): Density => (n <= 6 ? 'names' : n <= 16 ? 'marks' : 'count')

/**
 * One ribbon for a bar too thin to divide into marks.
 *
 * A three pixel strip cannot hold forty separate marks: split evenly, the gaps came
 * to more than the strip was wide and every mark solved to zero, so a day with the
 * whole team away drew nothing at all. A gradient has no minimum width and cannot
 * collapse.
 *
 * A blend, from a sample rather than from everybody. One stop per person turned forty
 * of them into a smear, and hard edges between forty bands were no better: at that
 * width neither is something anyone reads, and both fight a strip whose whole job is
 * to sit under the day and be glanced at.
 *
 * So the sample grows on the square root of the count: one colour up to two people,
 * two up to six, three up to twelve, four up to twenty, five beyond. A quiet day
 * stays flat or nearly so, a busy one is visibly richer, and nothing past five ever
 * crowds in. The colours are taken evenly across the list, so they are a fair reading
 * of who is away rather than whoever happened to be first.
 */
const GRADIENT_STOPS = 5

export function memberGradient(users: { id: number }[]) {
  if (users.length === 0) return 'transparent'

  const wanted = Math.min(GRADIENT_STOPS, Math.max(1, Math.round(Math.sqrt(users.length))))
  if (wanted === 1) return memberColour(users[0].id)

  // Evenly across the list, ends included, so the sample spans everyone rather than
  // clustering at the front.
  const picked = Array.from({ length: wanted }, (_, i) =>
    memberColour(users[Math.round((i * (users.length - 1)) / (wanted - 1))].id)
  )
  return `linear-gradient(90deg, ${picked.join(', ')})`
}
