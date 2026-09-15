import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { auth } from '@/services'
import { whenSessionLost } from '@/services/api'
import type { User } from '@/services/types'

interface AuthState {
  user: User | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // The session lives in an HttpOnly cookie, which script cannot read, so the only
    // way to know whether one exists is to ask.
    auth.me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  /*
   * A session that ran out while the tab was open.
   *
   * Dropping the user is the whole of it: the application renders the sign in screen
   * whenever there is nobody signed in, and it does so without touching the address,
   * so whatever page was open is still the page that comes back after signing in.
   *
   * The line explains the jump. Being returned to a sign in screen with no reason
   * given reads as the application having lost its place.
   */
  useEffect(() => {
    whenSessionLost(() => {
      setUser((previous) => {
        if (previous) toast('A sessão expirou. Inicie sessão novamente.')
        return null
      })
    })
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    setUser(await auth.login(username, password))
  }, [])

  const signOut = useCallback(async () => {
    await auth.logout().catch(() => undefined)
    setUser(null)
  }, [])

  return <Context.Provider value={{ user, loading, signIn, signOut }}>{children}</Context.Provider>
}

export function useAuth() {
  const value = useContext(Context)
  if (!value) throw new Error('useAuth used outside AuthProvider')
  return value
}
