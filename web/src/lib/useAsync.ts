import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '@/services/api'

/**
 * Runs a request and tracks its three states.
 *
 * Deliberately small: this application has a handful of screens and no shared
 * server cache to invalidate, so a query library would be more machinery than the
 * problem needs.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const run = useCallback(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    load()
      .then((value) => {
        if (!cancelled) setData(value)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof ApiError ? e.problem.detail : 'Ocorreu um erro inesperado.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(run, [run])

  return { data, error, loading, reload: run, setData }
}

export function errorText(e: unknown) {
  return e instanceof ApiError ? e.problem.detail : 'Ocorreu um erro inesperado.'
}
