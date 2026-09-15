import { ArrowLeftRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { useTeam } from '@/context/TeamContext'
import { initials, memberColour, shortDate, teamMark, teamTag } from '@/lib/utils'
import type { SwapRequest, SwapSide, SwapStatus } from '@/services/types'

/**
 * How a request that is over is labelled. A pending one carries no badge: it is
 * already the thing under the heading it sits below, and the buttons beside it say
 * what it is waiting for.
 */
const RESOLVED: Record<SwapStatus, { label: string; tone: 'ok' | 'muted' } | null> = {
  PENDING: null,
  APPROVED: { label: 'ACEITE', tone: 'ok' },
  REJECTED: { label: 'RECUSADA', tone: 'muted' },
  CANCELLED: { label: 'CANCELADA', tone: 'muted' }
}

/** The two dates, in the order they read: what is given, then what is taken. */
export function Trade({ give, take }: { give: SwapSide; take: SwapSide }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[11.5px] text-fg-muted">
      {shortDate(give.date)}
      <ArrowLeftRight size={13} strokeWidth={1.6} className="text-fg-faint" />
      {shortDate(take.date)}
    </span>
  )
}

export function SwapSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="pb-1 font-mono text-[9.5px] tracking-[0.14em] text-fg-faint">{title}</div>
      {children}
    </div>
  )
}

/**
 * One request, as it reads from the side of whoever is looking at it.
 *
 * The caller decides which of the two people is the other one and which way the days
 * move, because that turns over depending on whether the request was sent or
 * received. It is written once and read in two places: the bell, where a request is
 * still waiting for an answer and arrives with buttons, and the record, where it is
 * over and arrives with none.
 */
export function SwapRow({ request, other, give, take, actions }: {
  request: SwapRequest
  other: SwapSide
  give: SwapSide
  take: SwapSide
  actions?: ReactNode
}) {
  const { teams } = useTeam()
  const team = teams.find((t) => t.id === other.teamId)
  const resolved = RESOLVED[request.status]

  return (
    <div className="flex items-start gap-2.5 border-b border-line-soft py-2.5 last:border-b-0">
      <span
        className="sq mt-0.5 h-6 w-6 shrink-0 text-[9px]"
        style={{ background: memberColour(other.user.id) }}
      >
        {initials(other.user.forename, other.user.surname)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="truncate text-[12.5px] text-fg-strong">{other.user.displayName}</span>
          {/* Which commitment, but only when there is more than one to confuse. */}
          {teams.length > 1 && team && (
            <span
              className="rounded px-1 font-mono text-[9.5px] tracking-[0.06em]"
              style={teamMark(team.name)}
            >
              {teamTag(team.name)}
            </span>
          )}
          {resolved && <Badge tone={resolved.tone}>{resolved.label}</Badge>}
        </div>
        <Trade give={give} take={take} />
        {request.note && (
          <div className="mt-1 text-[11.5px] leading-snug text-fg-soft">{request.note}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}
