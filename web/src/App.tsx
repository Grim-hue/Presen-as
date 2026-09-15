import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Toaster } from 'sonner'
import { PeopleSearch } from '@/components/layout/PeopleSearch'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SearchProvider } from '@/context/SearchContext'
import { SwapProvider } from '@/context/SwapContext'
import { TeamProvider } from '@/context/TeamContext'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import { Balanco } from '@/views/Balanco'
import { Dashboard } from '@/views/Dashboard'
import { EmailPlano } from '@/views/EmailPlano'
import { Equipa } from '@/views/Equipa'
import { Feriados } from '@/views/Feriados'
import { Ferias } from '@/views/Ferias'
import { Login } from '@/views/Login'
import { GerarPlano } from '@/views/GerarPlano'
import { Plano } from '@/views/Plano'
import { Trocas } from '@/views/Trocas'

function Routed() {
  const { user, loading } = useAuth()
  const { theme } = useTheme()

  // Nothing renders until the session is known, so an authenticated reload never
  // flashes the login screen on the way to the page the user asked for.
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-bg">
        <div className="skl h-2 w-40" />
      </div>
    )
  }

  if (!user) return <Login />

  return (
    // A short delay, so moving across a calendar does not fire a label per cell.
    <TooltipProvider delayDuration={250} skipDelayDuration={400}>
      {/* Above the views, because the Shell is per-view: a search that lived in it
          would lose its box on every navigation. Inside the session gate above,
          because the login screen has nobody to find. */}
      <SearchProvider>
        <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ferias" element={<Ferias />} />
        <Route path="/trocas" element={<Trocas />} />
        <Route path="/feriados" element={<Feriados />} />
        {/* Planning is the administrator's job. The catch-all below is what turns a
            typed /plano into a redirect, so there is no guard component to keep in
            sync with this list. The fragment is deliberate: createRoutesFromChildren
            recurses into one, where a false child is only incidentally skipped. */}
        {user.isAdmin && (
          <>
            <Route path="/plano" element={<Plano />} />
            <Route path="/plano/gerar" element={<GerarPlano />} />
            <Route path="/plano/email" element={<EmailPlano />} />
            <Route path="/balanco" element={<Balanco />} />
            <Route path="/equipa" element={<Equipa />} />
          </>
        )}
        <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <PeopleSearch />
      </SearchProvider>
      <Toaster theme={theme} position="bottom-right" richColors closeButton />
    </TooltipProvider>
  )
}

export function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        {/* Inside AuthProvider: listing the commitments needs a session. */}
        <TeamProvider>
          {/* Above the views, because every view renders its own Shell and the bell
              in it must not refetch on each navigation. */}
          <SwapProvider>
            <BrowserRouter>
              <Routed />
            </BrowserRouter>
          </SwapProvider>
        </TeamProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
