export interface User {
  id: number
  forename: string
  surname: string
  displayName: string
  email: string
  username: string
  isAdmin: boolean
  /** Where their picture is served from, or null when they have none. */
  avatarUrl: string | null
}

export interface Team {
  id: number
  name: string
  /** ISO weekday, 1 = Monday. */
  onSiteWeekday: number
  requiredOnSite: number
  fairnessSince: string
  /** Subject and opening paragraph of the generated email, over {meses} and {meses_ano}. */
  emailSubject: string
  emailIntro: string
  active: boolean
}

export interface TeamMember {
  user: User
  joinedAt: string
  leftAt: string | null
}

export interface Holiday {
  id: number
  date: string
  name: string
  national: boolean
  weekday: number
}

export type AbsenceKind = 'VACATION' | 'OTHER'
export type AbsenceSource = 'IMPORT' | 'MANUAL'

export interface Absence {
  id: number
  user: User
  startDate: string
  endDate: string
  days: number
  kind: AbsenceKind
  source: AbsenceSource
  importId: number | null
  note: string | null
  manuallyEdited: boolean
}

export interface AbsenceImport {
  id: number
  filename: string
  uploadedBy: User
  uploadedAt: string
  rowCount: number
  status: 'PENDING' | 'COMMITTED' | 'DISCARDED'
}

export type RowOutcome = 'NEW' | 'UNCHANGED' | 'UPDATE' | 'CONFLICT' | 'UNMATCHED'

export interface PreviewRow {
  line: number
  name: string
  startDate: string
  endDate: string
  outcome: RowOutcome
  userId: number | null
  existingAbsenceId: number | null
  existingStartDate: string | null
  existingEndDate: string | null
}

export interface ImportPreview {
  importId: number
  filename: string
  rows: PreviewRow[]
  rejected: { line: number; reason: string }[]
  missing: Absence[]
  summary: Record<string, number>
}

/** A published day putting somebody on a date their férias now cover. */
export interface PlanConflict {
  planId: number
  teamId: number
  date: string
  userId: number
}

/** What applying an import did, including the published days it now contradicts. */
export interface CommitReport {
  importId: number
  inserted: number
  updated: number
  unchanged: number
  skipped: number
  conflicts: PlanConflict[]
}

export interface PlanDay {
  /** Addresses the day itself, which is what a swap request is raised against. */
  id: number
  date: string
  weekday: number
  isHoliday: boolean
  holidayName: string | null
  requiredCount: number
  understaffed: boolean
  assigned: User[]
}

export interface Plan {
  id: number
  teamId: number
  periodStart: string
  periodEnd: string
  status: 'DRAFT' | 'PUBLISHED'
  generatedAt: string
  generatedBy: User
  publishedAt: string | null
  /** Free text carried into the email, one paragraph per line. */
  notes: string | null
  understaffedDays: number
  days: PlanDay[]
}

export interface MemberBalance {
  user: User
  joinedAt: string
  assigned: number
  expected: number
  debt: number
}

export type SwapStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

/** One half of a proposed exchange: a member and the day they hold. */
export interface SwapSide {
  user: User
  planDayId: number
  planId: number
  teamId: number
  date: string
  assigned: User[]
}

export interface SwapRequest {
  id: number
  requester: SwapSide
  target: SwapSide
  status: SwapStatus
  note: string | null
  createdAt: string
  /** Null exactly while the request is pending. */
  resolvedAt: string | null
}

export interface RenderedEmail {
  subject: string
  html: string
  text: string
}

/**
 * One send's departures from the team's template, and how much of the plan goes with
 * it. Everything is optional, and the API stores none of it: the next message starts
 * from the team's wording again.
 */
export interface EmailOptions {
  greeting?: string
  subject?: string
  intro?: string
  notes?: string
  /** `2026-09` each. Absent or empty is the whole plan. */
  months?: string[]
  nameMembers?: boolean
  weekends?: boolean
  holidays?: boolean
}

/** A plan worked out but not written down, from `POST /plans/preview`. */
export interface PlanPreview {
  days: PreviewDay[]
  balances: PreviewBalance[]
}

export interface PreviewDay {
  date: string
  weekday: number
  isHoliday: boolean
  holidayName: string | null
  requiredCount: number
  understaffed: boolean
  assigned: User[]
}

export interface PreviewBalance {
  user: User
  expected: number
  assigned: number
  debt: number
}
