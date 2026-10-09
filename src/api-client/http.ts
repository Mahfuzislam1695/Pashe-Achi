import { type ApiErrorBody, isMessageCode, type MessageCode, MESSAGES, type Text } from '@/shared'

export type Audience = 'customer' | 'admin'

/** Every failed call rejects with this. `text` is ready to show in Bangla or English. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: MessageCode,
    readonly issues: ApiErrorBody['issues'] = [],
  ) {
    super(MESSAGES[code].en)
    this.name = 'ApiError'
  }

  get text(): Text {
    return MESSAGES[this.code]
  }

  /** The issue codes, for picking a form-specific message with pickIssueCode(). */
  get issueCodes(): string[] {
    return this.issues?.map(issue => issue.code) ?? []
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError

type Query = Record<string, string | number | boolean | undefined | null>

export interface RequestOptions {
  query?: Query
  body?: unknown
  signal?: AbortSignal
}

export interface HttpClientOptions {
  /** The API root, e.g. /api/v1 on the pages' own origin. */
  baseUrl: string
  audience: Audience
  /** Called once a request is still unauthorized after a refresh attempt (send the user to login). */
  onUnauthorized?: () => void
}

export interface HttpClient {
  readonly baseUrl: string
  readonly audience: Audience
  request<T>(method: string, path: string, options?: RequestOptions): Promise<T>
  get<T>(path: string, query?: Query, signal?: AbortSignal): Promise<T>
  post<T>(path: string, body?: unknown): Promise<T>
  put<T>(path: string, body?: unknown): Promise<T>
  patch<T>(path: string, body?: unknown): Promise<T>
  /** Refreshes the session cookies. Concurrent calls share one request. */
  refresh(): Promise<boolean>
  url(path: string, query?: Query): string
}

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>
    return new ApiError(response.status, isMessageCode(body.code) ? body.code : 'server', body.issues)
  } catch {
    return new ApiError(response.status, response.status === 401 ? 'auth.required' : 'server')
  }
}

/**
 * Fetch wrapper for the browser: sends the httpOnly session cookies, parses the API's error
 * shape into ApiError, and on a 401 refreshes the session once and retries the request.
 */
export function createHttpClient({ baseUrl, audience, onUnauthorized }: HttpClientOptions): HttpClient {
  const root = baseUrl.replace(/\/$/, '')
  const authPrefix = audience === 'admin' ? '/admin/auth' : '/auth'
  let refreshing: Promise<boolean> | null = null

  const url = (path: string, query?: Query) => {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(query ?? {})) if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
    const search = params.toString()
    return `${root}${path}${search ? `?${search}` : ''}`
  }

  const refresh = () => {
    refreshing ??= fetch(url(`${authPrefix}/refresh`), { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then(response => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
    return refreshing
  }

  const send = async (method: string, path: string, { query, body, signal }: RequestOptions) => {
    const isForm = typeof FormData !== 'undefined' && body instanceof FormData
    try {
      return await fetch(url(path, query), {
        method,
        credentials: 'include',
        signal,
        headers: body === undefined || isForm ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      })
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') throw error
      throw new ApiError(0, 'network')
    }
  }

  async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    let response = await send(method, path, options)
    const isAuthCall = path.startsWith(`${authPrefix}/`) && !path.endsWith('/me')
    if (response.status === 401 && !isAuthCall) {
      if (await refresh()) response = await send(method, path, options)
      if (response.status === 401) onUnauthorized?.()
    }
    if (!response.ok) throw await toApiError(response)
    if (response.status === 204) return undefined as T
    const text = await response.text()
    return (text ? JSON.parse(text) : undefined) as T
  }

  return {
    baseUrl: root,
    audience,
    request,
    get: (path, query, signal) => request('GET', path, { query, signal }),
    post: (path, body) => request('POST', path, { body }),
    put: (path, body) => request('PUT', path, { body }),
    patch: (path, body) => request('PATCH', path, { body }),
    refresh,
    url,
  }
}
