import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '@/context/AuthContext'
import { teams as teamsApi } from '@/services'
import type { Team } from '@/services/types'
import { errorText } from '@/lib/useAsync'

const STORAGE_KEY = 'presencas.team'

/**
 * Which commitment the application is currently about.
 *
 * A team here is a commitment and its rule rather than a department: the development
 * team owes Mondays at the PSE office, the SPS roster owes Wednesdays at the AT
 * premises, and the same person can be on both. Everything except the dashboard is
 * about one of them at a time, so the choice lives above the views instead of being
 * repeated in each of them.
 */
const Context = createContext<{
  teams: Team[]
  team: Team | null
  setTeam: (teamId: number) => void
  /** Re-reads the list, for when a commitment has just been created. */
  reload: () => void
  loading: boolean
  error: string | null
} | null>(null)

function stored(): number | null {
  try {
    const value = Number(localStorage.getItem(STORAGE_KEY))
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    // Private browsing can throw on access. Not a reason to fail to render.
    return null
  }
}

export function TeamProvider({ children }: { children: ReactNode }) {
  // The id rather than the user: the object is a fresh reference on every render of
  // the provider above, and this only has to run again when the person changes.
  const userId = useAuth().user?.id ?? null
  const [teams, setTeams] = useState<Team[]>([])
  const [teamId, setTeamId] = useState<number | null>(stored)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [reloads, setReloads] = useState(0)
  const reload = useCallback(() => setReloads((n) => n + 1), [])

  useEffect(() => {
    // Nothing to list without a session, and asking anyway would put a 401 in the
    // console of the login screen.
    if (userId === null) {
      setTeams([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    teamsApi
      .list()
      .then((list) => {
        if (cancelled) return
        setTeams(list)
        // A remembered team that no longer exists is not an error to show anybody;
        // fall back to the first one rather than leaving every view without a team.
        setTeamId((current) => (list.some((t) => t.id === current) ? current : (list[0]?.id ?? null)))
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

  const setTeam = useCallback((next: number) => {
    setTeamId(next)
    try {
      localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  }, [])

  const team = teams.find((t) => t.id === teamId) ?? null

  return (
    <Context.Provider value={{ teams, team, setTeam, reload, loading, error }}>
      {children}
    </Context.Provider>
  )
}

export function useTeam() {
  const value = useContext(Context)
  if (!value) throw new Error('useTeam used outside TeamProvider')
  return value
}
