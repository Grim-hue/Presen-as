import { useMemo } from 'react'
import { Empty } from '@/components/layout/Feedback'
import { Shell } from '@/components/layout/Shell'
import { SwapRow, SwapSection } from '@/components/swaps/SwapRow'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { SkeletonRows } from '@/components/ui/skeleton'
import { useAuth } from '@/context/AuthContext'
import { useSwaps } from '@/context/SwapContext'
import type { SwapRequest } from '@/services/types'

/**
 * Every trade this person has been part of, in one place.
 *
 * It used to live behind the bell in the header, under the two lists that are still
 * waiting for an answer. A bell is for what needs you and then goes away; this only
 * ever grows, and a record nobody can find is not a record. The bell keeps the inbox
 * and sends anyone looking for the history here.
 *
 * Nothing on this page acts on a request. Answering one is what the bell is for, and
 * a request that is over cannot be answered anyway.
 */
export function Trocas() {
  const { user } = useAuth()
  const { incoming, outgoing, loading } = useSwaps()

  /*
   * A request is read from the side of whoever is looking at it: the other person is
   * the one who is not you, and the day you give is the one that was yours to begin
   * with. Sent and received turn both of those over, so the two lists are tagged
   * before they are put together rather than being worked out again per row.
   */
  const all = useMemo(() => {
    const mine = outgoing.map((request) => ({ request, sent: true }))
    const theirs = incoming.map((request) => ({ request, sent: false }))
    return [...mine, ...theirs].sort((a, b) =>
      b.request.requester.date.localeCompare(a.request.requester.date)
    )
  }, [incoming, outgoing])

  const waiting = all.filter(({ request }) => request.status === 'PENDING')
  const over = all.filter(({ request }) => request.status !== 'PENDING')

  const row = ({ request, sent }: { request: SwapRequest; sent: boolean }) => (
    <SwapRow
      key={request.id}
      request={request}
      other={sent ? request.target : request.requester}
      give={sent ? request.requester : request.target}
      take={sent ? request.target : request.requester}
    />
  )

  const accepted = over.filter(({ request }) => request.status === 'APPROVED').length

  return (
    <Shell
      title={
        <>
          Trocas
          {accepted > 0 && (
            <Badge tone="ok">
              {accepted} {accepted === 1 ? 'ACEITE' : 'ACEITES'}
            </Badge>
          )}
        </>
      }
    >
      <Card className="p-4">
        {loading && all.length === 0 ? (
          <SkeletonRows rows={5} cols={3} />
        ) : all.length === 0 ? (
          <Empty
            title="Sem trocas."
            hint={`Peça uma troca a partir do Dashboard, num dia em que ${
              user ? 'esteja' : 'esteja'
            } marcado.`}
          />
        ) : (
          <div className="flex flex-col gap-4">
            {/* The two that are still open are named here too, so the record is the
                whole story and not only its ending. Answering them is still the
                bell's job, so they arrive without buttons. */}
            {waiting.length > 0 && (
              <SwapSection title="POR RESPONDER">{waiting.map(row)}</SwapSection>
            )}
            {over.length > 0 && <SwapSection title="RESOLVIDOS">{over.map(row)}</SwapSection>}
          </div>
        )}
      </Card>
    </Shell>
  )
}
