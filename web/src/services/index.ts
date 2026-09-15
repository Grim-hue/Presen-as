import { http, many, nothing, one } from './api'
import type {
  Absence, AbsenceImport, AbsenceKind, AbsenceSource, CommitReport, EmailOptions, Holiday,
  ImportPreview, MemberBalance, Plan, PlanPreview, RenderedEmail, SwapRequest, Team, TeamMember, User
} from './types'

export const auth = {
  login: (username: string, password: string) =>
    one<User>(http.post('/auth/login', { username, password })),
  me: () => one<User>(http.get('/auth/me')),
  logout: () => nothing(http.post('/auth/logout'))
}

export const users = {
  /**
   * Everyone who can be scheduled or be absent. Absences belong to a person rather
   * than to a commitment, so the views about people need the whole list.
   */
  list: () => many<User>(http.get('/users')),

  /**
   * Sets somebody's picture. Multipart, because the thing being sent is a file the
   * person chose rather than a field they typed.
   *
   * Returns when the picture changed, which is what the address it is served at
   * carries: the caller reloads whatever it drew from, and the new address is fetched
   * instead of the old one being served from the cache.
   */
  setAvatar: (userId: number, file: File) => {
    const body = new FormData()
    body.append('file', file)
    return one<{ avatarVersion: number }>(http.post(`/users/${userId}/avatar`, body))
  },

  removeAvatar: (userId: number) =>
    one<{ removed: boolean }>(http.delete(`/users/${userId}/avatar`)),

  /**
   * Name, address and whether they administer the application. Administrators only,
   * and the API refuses an administrator taking their own flag off.
   */
  update: (
    userId: number,
    body: { forename: string; surname: string; email: string; isAdmin: boolean }
  ) => one<User>(http.patch(`/users/${userId}`, body))
}

export const teams = {
  list: () => many<Team>(http.get('/teams')),
  get: (teamId: number) => one<Team>(http.get(`/teams/${teamId}`)),
  members: (teamId: number) => many<TeamMember>(http.get(`/teams/${teamId}/members`)),
  balance: (teamId: number) => many<MemberBalance>(http.get(`/teams/${teamId}/balance`)),
  updateRule: (
    teamId: number,
    rule: { name?: string; onSiteWeekday: number; requiredOnSite: number; fairnessSince: string }
  ) => one<Team>(http.patch(`/teams/${teamId}`, rule)),
  /** The subject and opening paragraph every message for this team starts from. */
  updateEmail: (teamId: number, body: { emailSubject: string; emailIntro: string }) =>
    one<Team>(http.patch(`/teams/${teamId}/email`, body)),
  /** Active users not already on the team, for the add-member picker. */
  candidates: (teamId: number) => many<User>(http.get(`/teams/${teamId}/candidates`)),
  create: (body: {
    name: string
    onSiteWeekday: number
    requiredOnSite: number
    fairnessSince: string
    emailSubject: string
    emailIntro: string
  }) => one<Team>(http.post('/teams', body)),
  /** Adds somebody, or puts a returning member back on the team. */
  addMember: (teamId: number, body: { userId: number; joinedAt: string }) =>
    many<TeamMember>(http.post(`/teams/${teamId}/members`, body)),
  /** A correction to when a membership started. Somebody who left stays left. */
  updateMembership: (teamId: number, userId: number, joinedAt: string) =>
    many<TeamMember>(http.patch(`/teams/${teamId}/members/${userId}`, { joinedAt })),
  removeMember: (teamId: number, userId: number, leftAt?: string) =>
    many<TeamMember>(http.delete(`/teams/${teamId}/members/${userId}`, { params: { leftAt } }))
}

export const holidays = {
  byYear: (year: number) => many<Holiday>(http.get('/holidays', { params: { year } })),
  generate: (year: number) =>
    one<{ year: number; added: number; holidays: Holiday[] }>(
      http.post('/holidays/generate', null, { params: { year } })
    ),
  remove: (holidayId: number) => nothing(http.delete(`/holidays/${holidayId}`))
}

export const absences = {
  list: (params: { userId?: number; from?: string; to?: string; source?: AbsenceSource } = {}) =>
    many<Absence>(http.get('/absences', { params })),
  create: (body: { userId: number; startDate: string; endDate: string; kind?: AbsenceKind; note?: string }) =>
    one<Absence>(http.post('/absences', body)),
  update: (id: number, body: { startDate: string; endDate: string; kind?: AbsenceKind; note?: string }) =>
    one<Absence>(http.patch(`/absences/${id}`, body)),
  remove: (id: number) => nothing(http.delete(`/absences/${id}`))
}

export const imports = {
  history: () => many<AbsenceImport>(http.get('/absences/imports')),
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return one<ImportPreview>(http.post('/absences/imports', form))
  },
  commit: (
    importId: number,
    rows: { line: number; name: string; startDate: string; endDate: string; userId: number | null; apply: boolean }[]
  ) =>
    one<CommitReport>(http.post(`/absences/imports/${importId}/commit`, { rows })),
  discard: (importId: number) => one<{ removed: number }>(http.delete(`/absences/imports/${importId}`))
}

export const plans = {
  list: (teamId: number, year?: number) => many<Plan>(http.get('/plans', { params: { teamId, year } })),
  get: (planId: number) => one<Plan>(http.get(`/plans/${planId}`)),
  /**
   * [pinned] take a slot on every day; [excluded] are not scheduled at all. Both are
   * choices about this one plan and are not stored: regenerating without them gives
   * the plan the fairness rule would have produced on its own.
   */
  generate: (
    teamId: number,
    from: string,
    to: string,
    pinnedUserIds: number[] = [],
    excludedUserIds: number[] = []
  ) => one<Plan>(http.post('/plans/generate', { teamId, from, to, pinnedUserIds, excludedUserIds })),
  /** The same generation, answered rather than stored. Writes nothing. */
  preview: (
    teamId: number,
    from: string,
    to: string,
    pinnedUserIds: number[] = [],
    excludedUserIds: number[] = []
  ) =>
    one<PlanPreview>(
      http.post('/plans/preview', { teamId, from, to, pinnedUserIds, excludedUserIds })
    ),
  publish: (planId: number) => one<Plan>(http.post(`/plans/${planId}/publish`)),
  setDay: (planId: number, date: string, userIds: number[]) =>
    one<Plan>(http.patch(`/plans/${planId}/days/${date}`, { userIds })),
  remove: (planId: number) => nothing(http.delete(`/plans/${planId}`)),
  updateNotes: (planId: number, notes: string | null) =>
    one<Plan>(http.patch(`/plans/${planId}`, { notes })),
  email: (planId: number) => one<RenderedEmail>(http.get(`/plans/${planId}/email`)),
  /** The same message in the sender's words, and only the part of the plan they send. */
  renderEmail: (planId: number, options: EmailOptions) =>
    one<RenderedEmail>(http.post(`/plans/${planId}/email`, options))
}

export const swaps = {
  /** Received and sent together: the bell asks one question, not two. */
  list: () => many<SwapRequest>(http.get('/swaps')),
  create: (body: {
    myPlanDayId: number
    targetPlanDayId: number
    targetUserId: number
    note?: string
  }) => one<SwapRequest>(http.post('/swaps', body)),
  approve: (id: number) => one<SwapRequest>(http.post(`/swaps/${id}/approve`)),
  reject: (id: number) => one<SwapRequest>(http.post(`/swaps/${id}/reject`)),
  cancel: (id: number) => nothing(http.delete(`/swaps/${id}`))
}
