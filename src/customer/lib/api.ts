import { createCustomerApi } from '@/api-client'
import { API_PREFIX } from '@/shared'

import { APP_BASE } from './constants'
import { appPaths, webPaths } from './paths'

/** The API is served by the same server, on the same port, as these pages. */
const API_URL = `/${API_PREFIX}`

let redirecting = false

/**
 * The one API client for the customer app. Session cookies are httpOnly and set by the API; when
 * a request is still unauthorized after a refresh, the cookies are cleared and the user goes to login.
 */
export const api = createCustomerApi({
  baseUrl: API_URL,
  onUnauthorized: () => {
    if (typeof window === 'undefined' || redirecting) return
    redirecting = true
    const { pathname } = window.location
    // Stay in the version the customer was using: /app/… goes to /app/login, the rest to /login.
    const login = pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`) ? appPaths.login : webPaths.login
    void fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
      .catch(() => undefined)
      .finally(() => window.location.assign(`${login}?next=${encodeURIComponent(pathname)}`))
  },
})
