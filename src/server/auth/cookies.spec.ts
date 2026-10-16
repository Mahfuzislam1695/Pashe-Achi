import type { Request, Response } from 'express'

import { loadEnv } from '../config/env'
import { CUSTOMER_REFRESH_COOKIE_MS, parseCookieHeader, readAccessToken, readRefreshToken, setAuthCookies } from './cookies'

const request = (headers: Record<string, string>, cookies: Record<string, string> = {}) => ({ headers, cookies }) as unknown as Request
const env = loadEnv({ DATABASE_URL: 'postgresql://u:p@localhost:5432/db', JWT_ACCESS_SECRET: 'a'.repeat(40), ADMIN_JWT_ACCESS_SECRET: 'b'.repeat(40) })
const tokens = { accessToken: 'access', refreshToken: 'refresh', accessTokenExpiresAt: new Date().toISOString() }

/** The maxAge of each cookie setAuthCookies sets, by name. */
const cookieMaxAges = (audience: 'customer' | 'admin') => {
  const maxAges: Record<string, number | undefined> = {}
  const response = { cookie: (name: string, _value: string, options: { maxAge?: number }) => (maxAges[name] = options.maxAge) } as unknown as Response
  setAuthCookies(response, env, audience, tokens)
  return maxAges
}

describe('cookies', () => {
  it('parses a raw Cookie header, decoding values', () => {
    expect(parseCookieHeader('pa_at=abc; pa_lang=bn; name=%E0%A6%95')).toEqual({ pa_at: 'abc', pa_lang: 'bn', name: 'ক' })
    expect(parseCookieHeader(undefined)).toEqual({})
  })

  it('prefers the Bearer header (mobile apps) over the cookie', () => {
    expect(readAccessToken(request({ authorization: 'Bearer from-header' }, { pa_at: 'from-cookie' }), 'customer')).toBe('from-header')
    expect(readAccessToken(request({}, { pa_at: 'from-cookie' }), 'customer')).toBe('from-cookie')
  })

  it('keeps customer and admin cookies apart', () => {
    expect(readAccessToken(request({}, { pa_at: 'customer' }), 'admin')).toBeUndefined()
    expect(readAccessToken(request({}, { pa_admin_at: 'admin' }), 'admin')).toBe('admin')
  })

  it('reads the refresh token from the body first, then the cookie', () => {
    expect(readRefreshToken(request({}, { pa_rt: 'cookie' }), 'customer', 'body')).toBe('body')
    expect(readRefreshToken(request({}, { pa_rt: 'cookie' }), 'customer')).toBe('cookie')
  })

  it('keeps customers signed in for the browser maximum, and admins for REFRESH_TOKEN_TTL_DAYS', () => {
    const accessMaxAge = env.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000
    expect(CUSTOMER_REFRESH_COOKIE_MS).toBe(400 * 24 * 60 * 60 * 1000)
    expect(cookieMaxAges('customer')).toEqual({ pa_at: accessMaxAge, pa_rt: CUSTOMER_REFRESH_COOKIE_MS })
    expect(cookieMaxAges('admin')).toEqual({ pa_admin_at: accessMaxAge, pa_admin_rt: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 })
  })
})
