import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

/**
 * Whether the people search is open, held above the views.
 *
 * Above them for the same reason the bell's requests are: every view renders its
 * own Shell, and the search has to be reachable from the key and from the header
 * alike, whichever page is showing. The state is all it holds — the directory the
 * dialog reads belongs to the dialog, because nobody else asks for it.
 */
const Context = createContext<{
  isOpen: boolean
  open: () => void
  close: () => void
} | null>(null)

export function SearchProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false)
  const value = useMemo(
    () => ({ isOpen, open: () => setOpen(true), close: () => setOpen(false) }),
    [isOpen]
  )
  return <Context.Provider value={value}>{children}</Context.Provider>
}

export function useSearch() {
  const value = useContext(Context)
  if (!value) throw new Error('useSearch used outside SearchProvider')
  return value
}
