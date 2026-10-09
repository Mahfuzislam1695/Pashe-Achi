import { type NextRequest, NextResponse } from 'next/server'

import { SESSION_COOKIE as ADMIN_SESSION_COOKIE } from '@/admin/lib/constants'
import { HOME_PATH, SESSION_COOKIE as CUSTOMER_SESSION_COOKIE } from '@/customer/lib/constants'

const CUSTOMER_PUBLIC_PATHS = new Set(['/', '/login', '/signup'])
const ADMIN_HOME = '/admin'
const ADMIN_LOGIN = '/admin/login'

/**
 * Optimistic routing only (Next.js 16 renamed middleware to proxy). It only looks at whether a
 * session cookie exists; the API checks the session on every request, clears a stale cookie, and
 * the page then falls back to its login screen.
 * - /admin/*: the admin cookie. Without it every page goes to /admin/login; with it /admin/login goes to the dashboard.
 * - everything else: the customer cookie. Without it the signed-in screens go to /login; with it the
 *   welcome and login pages go to the app.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const redirect = (path: string, next?: string) => {
    const url = new URL(path, request.url)
    if (next) url.searchParams.set('next', next)
    return NextResponse.redirect(url)
  }

  if (pathname === ADMIN_HOME || pathname.startsWith(`${ADMIN_HOME}/`)) {
    const hasSession = request.cookies.has(ADMIN_SESSION_COOKIE)
    const isLogin = pathname === ADMIN_LOGIN
    if (!hasSession && !isLogin) return redirect(ADMIN_LOGIN, pathname === ADMIN_HOME ? undefined : pathname + search)
    if (hasSession && isLogin) return redirect(ADMIN_HOME)
    return NextResponse.next()
  }

  const hasSession = request.cookies.has(CUSTOMER_SESSION_COOKIE)
  const isPublic = CUSTOMER_PUBLIC_PATHS.has(pathname)
  if (!hasSession && !isPublic) return redirect('/login', pathname + search)
  if (hasSession && isPublic) return redirect(HOME_PATH)
  return NextResponse.next()
}

export const config = {
  // Pages only. Not the API, not Socket.IO (its WebSocket upgrades also pass through Next's routing),
  // not Next internals, and not static files (anything with a dot, like the icons).
  matcher: ['/((?!api/|socket\\.io/|_next/|.*\\..*).*)'],
}
