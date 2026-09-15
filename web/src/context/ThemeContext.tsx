import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'dark' | 'light'
const STORAGE_KEY = 'presencas.theme'

const Context = createContext<{ theme: Theme; toggle: () => void } | null>(null)

function initial(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Private browsing can throw on access. Not a reason to fail to render.
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Remembering the choice is a convenience, not a requirement.
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])

  return <Context.Provider value={{ theme, toggle }}>{children}</Context.Provider>
}

export function useTheme() {
  const value = useContext(Context)
  if (!value) throw new Error('useTheme used outside ThemeProvider')
  return value
}
