import type { AuthTokens } from '@/shared'
import type { CookieOptions, Request, Response } from 'express'

import type { Env } from '../config/env'
import type { Audience } from './auth.types'

/**
 * Cookie names. src/proxy.ts checks the refresh cookie to decide whether to show the login page,
 * so both cookies use path "/". Keep these in sync with src/customer/lib/constants.ts and
 * src/admin/lib/constants.ts.
 */
export const COOKIE_NAMES: Record<Audience, { access: string; refresh: string }> = {
  customer: { access: 'pa_at', refresh: 'pa_rt' },
  admin: { access: 'pa_admin_at', refresh: 'pa_admin_rt' },
}

const baseOptions = (env: Env): CookieOptions => ({
  httpOnly: true,
  sameSite: 'lax',
  secure: env.NODE_ENV === 'production',
  path: '/',
})

export function setAuthCookies(response: Response, env: Env, audience: Audience, tokens: AuthTokens) {
  const names = COOKIE_NAMES[audience]
  response.cookie(names.access, tokens.accessToken, { ...baseOptions(env), maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000 })
  response.cookie(names.refresh, tokens.refreshToken, { ...baseOptions(env), maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 })
}

export function clearAuthCookies(response: Response, env: Env, audience: Audience) {
  const names = COOKIE_NAMES[audience]
  response.clearCookie(names.access, baseOptions(env))
  response.clearCookie(names.refresh, baseOptions(env))
}

/** Parses a raw Cookie header (Socket.IO handshakes don't go through cookie-parser). */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {}
  for (const part of header?.split(';') ?? []) {
    const index = part.indexOf('=')
    if (index < 0) continue
    const name = part.slice(0, index).trim()
    const value = part.slice(index + 1).trim()
    try {
      cookies[name] = decodeURIComponent(value)
    } catch {
      cookies[name] = value
    }
  }
  return cookies
}

/** The access token from `Authorization: Bearer` (mobile apps) or the audience's cookie (browsers). */
export function readAccessToken(request: Request, audience: Audience): string | undefined {
  const header = request.headers.authorization
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || undefined
  return (request.cookies as Record<string, string> | undefined)?.[COOKIE_NAMES[audience].access]
}

/** The refresh token from the request body (mobile apps) or the audience's cookie (browsers). */
export function readRefreshToken(request: Request, audience: Audience, bodyToken?: string): string | undefined {
  return bodyToken || (request.cookies as Record<string, string> | undefined)?.[COOKIE_NAMES[audience].refresh]
}
