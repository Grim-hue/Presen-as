import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/context/AuthContext'
import { shortDate } from '@/lib/utils'
import { errorText } from '@/lib/useAsync'
import { swaps as swapsApi } from '@/services'
import type { SwapRequest } from '@/services/types'

const SEEN_KEY = 'presencas.trocas.vistas'

/**
 * The swap requests this person is part of, held above the views.
 *
 * Above them rather than inside the Shell because every view renders its own Shell:
 * a fetch in there would run again on every navigation. The count also has to survive
 * the move from the dashboard, where a request is raised, to wherever the answer is
 * read.
 */
const Context = createContext<{
  /** Addressed to me. */
  incoming: SwapRequest[]
  /** Raised by me. */
  outgoing: SwapRequest[]
  /** What the bell counts: incoming and still waiting for an answer. */
  pending: number
  reload: () => void
  loading: boolean
  error: string | null
} | null>(null)

/**
 * Which requests this browser has already announced, per person.
 *
 * Per person because two people share a machine more often than not, and one of them
 * dismissing the news is no reason for the other never to hear it. Read from storage
 * at the moment of announcing rather than held in state: two loads can overlap, and
 * the second one has to see what the first one already said.
 */
function announced(userId: number): Set<number> {
  try {
    const raw = localStorage.getItem(`${SEEN_KEY}.${userId}`)
    const ids: unknown = raw ? JSON.parse(raw) : null
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === 'number') : [])
  } catch {
    // Private browsing can throw on access, and so can a hand-edited entry. Saying it
    // twice is a smaller failure than not rendering.
    return new Set()
  }
}

function remember(userId: number, ids: number[]) {
  try {
    localStorage.setItem(`${SEEN_KEY}.${userId}`, JSON.stringify(ids))
  } catch {
    // Remembering is a convenience, not a requirement.
  }
}

/**
 * Says out loud what turned up since this browser last looked.
 *
 * The bell carries the count from then on, but a count that was already there when
 * the page opened is not news: somebody who never looks at the corner of the header
 * would never learn that a colleague is waiting on them. This fires once per request,
 * on the load that first sees it, which is a load or a return to the tab — nothing
 * polls.
 *
 * Only what is still waiting is remembered, so the list cannot grow without end. An
 * id is never reissued and an answered request never goes back to pending, so
 * forgetting the resolved ones cannot bring an announcement back.
 */
function announce(userId: number, requests: SwapRequest[]) {
  const waiting = requests.filter((r) => r.status === 'PENDING' && r.target.user.id === userId)
  const already = announced(userId)
  const fresh = waiting.filter((r) => !already.has(r.id))
  remember(userId, waiting.map((r) => r.id))

  if (fresh.length === 1) {
    const [only] = fresh
    toast(`${only.requester.user.displayName} pediu uma troca`, {
      // The day being handed to me first, the same order the bell reads them in.
      description: `${shortDate(only.target.date)} ⇄ ${shortDate(only.requester.date)}`
    })
  } else if (fresh.length > 1) {
    toast(`${fresh.length} pedidos de troca à sua espera`)
  }
}

export function SwapProvider({ children }: { children: ReactNode }) {
  // The id rather than the user, which is a fresh reference on every render above.
  const userId = useAuth().user?.id ?? null
  const [requests, setRequests] = useState<SwapRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    // Nothing to ask for without a session, and asking anyway would put a 401 in the
    // console of the login screen.
    if (userId === null) {
      setRequests([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    swapsApi
      .list()
      .then((list) => {
        if (cancelled) return
        setRequests(list)
        announce(userId, list)
      })
      .catch((e) => {
        if (!cancelled) setError(errorText(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reloads, userId])

  // Coming back to the tab is the moment somebody would expect to see an answer that
  // arrived while they were elsewhere. Nothing polls: the application has no loops.
  useEffect(() => {
    if (userId === null) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reload, userId])

  const value = useMemo(() => {
    const incoming = requests.filter((r) => r.target.user.id === userId)
    return {
      incoming,
      outgoing: requests.filter((r) => r.requester.user.id === userId),
      pending: incoming.filter((r) => r.status === 'PENDING').length,
      reload,
      loading,
      error
    }
  }, [error, loading, reload, requests, userId])

  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useSwaps() {
  const value = useContext(Context)
  if (!value) throw new Error('useSwaps used outside SwapProvider')
  return value
}
