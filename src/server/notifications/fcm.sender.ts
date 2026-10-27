import { createSign } from 'node:crypto'

import { type Env, parseServiceAccount, type ServiceAccount } from '../config/env'

/** One message for one phone, in FCM's HTTP v1 shape (projects.messages.send). */
export interface FcmMessage {
  token: string
  notification: { title: string; body: string }
  /** Values must be strings. The app reads them when a notification is tapped. */
  data: Record<string, string>
  android: {
    priority: 'HIGH' | 'NORMAL'
    ttl: string
    notification: { channel_id: string; tag: string; icon: string; color: string; sound: string; default_vibrate_timings: boolean }
  }
  apns: { headers: Record<string, string>; payload: { aps: { sound: string; 'thread-id': string } } }
}

/** Sends one message; rejects with an FcmError when Firebase refuses it. */
export type FcmSender = (message: FcmMessage) => Promise<unknown>

/** The sender, or null when FCM is not set up (no FCM_SERVICE_ACCOUNT in .env). The e2e tests swap in a recorder. */
export const FCM_SENDER = Symbol('FCM_SENDER')

/** `errorCode` is FCM's reason, e.g. UNREGISTERED when the app was uninstalled or its token replaced. */
export class FcmError extends Error {
  constructor(
    readonly statusCode: number,
    readonly errorCode: string | undefined,
    message: string,
  ) {
    super(message)
  }
}

const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const TIMEOUT_MS = 10_000
/** Access tokens last an hour; a new one is fetched this long before the old one runs out. */
const RENEW_EARLY_MS = 5 * 60 * 1000

/** The signed JWT a service account trades for an access token (OAuth 2.0 JWT bearer grant). */
export function serviceAccountAssertion(account: ServiceAccount, now = Math.floor(Date.now() / 1000)) {
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT' })}.${part({ iss: account.clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 })}`
  return `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(account.privateKey, 'base64url')}`
}

type FcmErrorBody = { error?: { status?: string; message?: string; details?: { errorCode?: string }[] } }

export function createFcmSender(env: Env, fetchImpl: typeof fetch = fetch): FcmSender | null {
  const account = env.FCM_SERVICE_ACCOUNT ? parseServiceAccount(env.FCM_SERVICE_ACCOUNT) : null
  if (!account) return null

  let cached: { token: string; renewAt: number } | null = null
  let fetching: Promise<string> | null = null
  const accessToken = async () => {
    if (cached && cached.renewAt > Date.now()) return cached.token
    fetching ??= (async () => {
      const response = await fetchImpl(TOKEN_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: serviceAccountAssertion(account) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      const body = (await response.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string }
      if (!response.ok || !body.access_token) throw new FcmError(response.status, body.error, `Firebase sign-in failed (${response.status} ${body.error ?? ''})`.trim())
      cached = { token: body.access_token, renewAt: Date.now() + (body.expires_in ?? 3600) * 1000 - RENEW_EARLY_MS }
      return cached.token
    })().finally(() => {
      fetching = null
    })
    return fetching
  }

  const url = `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.projectId)}/messages:send`
  return async message => {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { authorization: `Bearer ${await accessToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ message }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (response.ok) return
    const body = (await response.json().catch(() => ({}))) as FcmErrorBody
    // A token Google stopped accepting early is fetched again on the next send.
    if (response.status === 401) cached = null
    const errorCode = body.error?.details?.find(detail => detail.errorCode)?.errorCode ?? body.error?.status
    throw new FcmError(response.status, errorCode, body.error?.message ?? `HTTP ${response.status}`)
  }
}
