import type { Request } from 'express'

import { parseCookieHeader, readAccessToken, readRefreshToken } from './cookies'

const request = (headers: Record<string, string>, cookies: Record<string, string> = {}) => ({ headers, cookies }) as unknown as Request

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
})
