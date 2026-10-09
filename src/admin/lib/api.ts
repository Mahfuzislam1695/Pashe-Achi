import { createAdminApi } from '@/api-client'
import { API_PREFIX } from '@/shared'

/** The API is served by the same server, on the same port, as these pages. */
const API_URL = `/${API_PREFIX}`

let redirecting = false

/** The one API client for the admin panel (admin cookies are separate from customer cookies). */
export const api = createAdminApi({
  baseUrl: API_URL,
  onUnauthorized: () => {
    if (typeof window === 'undefined' || redirecting) return
    redirecting = true
    const next = encodeURIComponent(window.location.pathname + window.location.search)
    void fetch(`${API_URL}/admin/auth/logout`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })
      .catch(() => undefined)
      .finally(() => window.location.assign(`/admin/login?next=${next}`))
  },
})
