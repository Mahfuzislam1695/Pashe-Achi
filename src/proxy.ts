import { type NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE as ADMIN_SESSION_COOKIE } from '@/admin/lib/constants'
import { ACCOUNT_DELETION_PATH, DOWNLOAD_PATH, HOME_PATH, PRIVACY_PATH, SESSION_COOKIE as CUSTOMER_SESSION_COOKIE } from '@/customer/lib/constants'

/** Open to everyone, signed in or not: the landing page, the app download page, the privacy policy and the account-deletion page. */
const PUBLIC_PATHS = new Set(['/', DOWNLOAD_PATH, PRIVACY_PATH, ACCOUNT_DELETION_PATH])
/** The signed-out screens. */
const AUTH_PATHS = new Set(['/login', '/signup'])
const ADMIN_HOME = '/admin'
const ADMIN_LOGIN = '/admin/login'

/**
 * Optimistic routing only (Next.js 16 renamed middleware to proxy). It only looks at whether a
 * session cookie exists; the API checks the session on every request, clears a stale cookie, and
 * the page then falls back to its login screen.
 * - /admin/*: the admin cookie. Without it every page goes to /admin/login; with it /admin/login goes to the dashboard.
 * - /, /app-download, /privacy and /account-deletion: open to everyone (the landing page shows
 *   "Open app" to a signed-in customer).
 * - Everything else is the customer site: a signed-in customer on /login or /signup goes to `next`
 *   or /bazar; a signed-out customer on any other screen goes to /login with ?next=….
 * The old /app/… links never get here: next.config.mjs redirects them first.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const redirect = (path: string, next?: string, status?: number) => {
    const url = new URL(path, request.url)
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url, status)
  }

  if (pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`)) {
    const hasSession = request.cookies.has(ADMIN_SESSION_COOKIE)
    const isLogin = pathname === ADMIN_LOGIN
    if (!hasSession && !isLogin) return redirect(ADMIN_LOGIN, pathname === ADMIN_HOME ? undefined : pathname + search)
    if (hasSession && isLogin) return redirect(ADMIN_HOME)
    return NextResponse.next()
  }

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next()

  const hasSession = request.cookies.has(CUSTOMER_SESSION_COOKIE)
  if (AUTH_PATHS.has(pathname)) {
    if (!hasSession) return NextResponse.next()
    // Only same-site paths are followed, so ?next= can't send anyone to another site.
    const next = request.nextUrl.searchParams.get('next')
    return redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : HOME_PATH)
  }
  if (!hasSession) return redirect('/login', pathname + search)
  return NextResponse.next()
}

export const config = {
  // Pages only. Not the API, not Socket.IO (its WebSocket upgrades also pass through Next's routing),
  // not Next internals, and not static files (anything with a dot, like the icons).
  matcher: ['/((?!api/|socket\\.io/|_next/|.*\\..*).*)'],
}
