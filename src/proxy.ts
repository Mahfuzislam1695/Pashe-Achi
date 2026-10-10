import { type NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE as ADMIN_SESSION_COOKIE } from '@/admin/lib/constants'
import { APP_BASE, APP_HOME_PATH, HOME_PATH, SESSION_COOKIE as CUSTOMER_SESSION_COOKIE } from '@/customer/lib/constants'

const LANDING = '/'
/** Signed-out screens of the web version (/login) and the app version (/app, /app/login). */
const WEB_AUTH_PATHS = new Set(['/login', '/signup'])
const APP_AUTH_PATHS = new Set([APP_BASE, `${APP_BASE}/login`, `${APP_BASE}/signup`])
const ADMIN_HOME = '/admin'
const ADMIN_LOGIN = '/admin/login'

/**
 * Optimistic routing only (Next.js 16 renamed middleware to proxy). It only looks at whether a
 * session cookie exists; the API checks the session on every request, clears a stale cookie, and
 * the page then falls back to its login screen.
 * - /admin/*: the admin cookie. Without it every page goes to /admin/login; with it /admin/login goes to the dashboard.
 * - /: the web landing page, open to everyone (it shows "Open app" to a signed-in customer).
 * - The customer site has two versions with the same screens: web (/login, /bazar, /orders/…) and
 *   app (/app, /app/login, /app/bazar, /app/orders/…). Each stays inside its own version:
 *   - a signed-in customer on a login, signup or welcome screen goes to `next` or that version's home;
 *   - a signed-out customer on any other screen goes to that version's login with ?next=….
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

  if (pathname === LANDING) return NextResponse.next()

  const hasSession = request.cookies.has(CUSTOMER_SESSION_COOKIE)
  const isApp = pathname === APP_BASE || pathname.startsWith(`${APP_BASE}/`)
  if (WEB_AUTH_PATHS.has(pathname) || APP_AUTH_PATHS.has(pathname)) {
    if (!hasSession) return NextResponse.next()
    // Only same-site paths are followed, so ?next= can't send anyone to another site.
    const next = request.nextUrl.searchParams.get('next')
    return redirect(next && next.startsWith('/') && !next.startsWith('//') ? next : isApp ? APP_HOME_PATH : HOME_PATH)
  }
  if (!hasSession) return redirect(isApp ? `${APP_BASE}/login` : '/login', pathname + search)
  return NextResponse.next()
}

export const config = {
  // Pages only. Not the API, not Socket.IO (its WebSocket upgrades also pass through Next's routing),
  // not Next internals, and not static files (anything with a dot, like the icons).
  matcher: ['/((?!api/|socket\\.io/|_next/|.*\\..*).*)'],
}
