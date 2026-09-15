import axios, { AxiosError } from 'axios'

/**
 * One axios instance for the whole application.
 *
 * withCredentials so the session cookie travels; the dev server proxies /api to the
 * API, keeping the browser on a single origin so SameSite=Strict does not drop it.
 */
export const http = axios.create({ baseURL: '/api/v1', withCredentials: true })

/**
 * What to do when the API says the session is no longer good.
 *
 * The token lives in an HttpOnly cookie, so a tab that has been open a while has no
 * way of knowing whether it still holds a session: the first request to come back
 * refused is the news. Left to itself the page stayed exactly where it was with a
 * sentence in the corner, still showing a plan nobody could act on any more and
 * offering buttons that would each fail the same way.
 *
 * Only a lost session counts. A wrong password on the sign in form is a 401 as well,
 * and reading that as an expiry would tear down state that is already gone.
 */
let onSessionLost: (() => void) | null = null

export function whenSessionLost(handler: () => void) {
  onSessionLost = handler
}

http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<Problem>) => {
    if (error.response?.status === 401 && error.response.data?.type?.endsWith('/sessao-invalida')) {
      onSessionLost?.()
    }
    return Promise.reject(error)
  }
)

/** The envelope every successful response carries. */
interface ApiResponse<T> {
  data: T[]
  date: string
}

/** RFC 7807, as the API returns on every failure. */
export interface Problem {
  type: string
  title: string
  status: number
  detail: string
}

export class ApiError extends Error {
  // Declared rather than a constructor parameter property: the build runs with
  // erasableSyntaxOnly, which forbids syntax that emits code rather than just
  // stripping types.
  readonly problem: Problem

  constructor(problem: Problem) {
    super(problem.detail)
    this.problem = problem
  }
}

function toApiError(error: unknown): never {
  const axiosError = error as AxiosError<Problem>
  const problem = axiosError.response?.data
  if (problem?.detail) throw new ApiError(problem)
  // A request that never reached the API has no problem document to show, so it
  // gets a sentence of its own rather than an axios message the user cannot act on.
  throw new ApiError({
    type: 'sem-ligacao',
    title: 'Sem ligação',
    status: 0,
    detail: 'Não foi possível contactar o servidor.'
  })
}

/** Unwraps a single-value response. */
export async function one<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T> {
  try {
    return (await promise).data.data[0]
  } catch (error) {
    toApiError(error)
  }
}

/** Unwraps a list response. */
export async function many<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<T[]> {
  try {
    return (await promise).data.data
  } catch (error) {
    toApiError(error)
  }
}

export async function nothing(promise: Promise<unknown>): Promise<void> {
  try {
    await promise
  } catch (error) {
    toApiError(error)
  }
}
