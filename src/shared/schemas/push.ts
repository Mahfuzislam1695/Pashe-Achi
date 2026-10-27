import { z } from 'zod'

import { DEVICE_PLATFORMS, LANGS } from '../enums'

/**
 * The browsers' push services (Chrome and other Chromium browsers, Firefox, Safari, Edge). The API
 * POSTs to a subscription's endpoint, so only these hosts are accepted: an endpoint anywhere else
 * could make the server call an internal address.
 */
const PUSH_SERVICE_HOSTS = ['googleapis.com', 'push.services.mozilla.com', 'push.apple.com', 'notify.windows.com']

export function isPushEndpoint(value: string): boolean {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.port !== '' || url.username || url.password) return false
  const host = url.hostname.toLowerCase()
  return PUSH_SERVICE_HOSTS.some(service => host === service || host.endsWith(`.${service}`))
}

const pushEndpoint = z.string({ error: 'push.endpoint' }).max(1000, { error: 'push.endpoint' }).refine(isPushEndpoint, { error: 'push.endpoint' })
const pushKey = (max: number) => z.string({ error: 'push.endpoint' }).regex(/^[A-Za-z0-9_-]+={0,2}$/, { error: 'push.endpoint' }).max(max, { error: 'push.endpoint' })

/**
 * This browser's push subscription (PUT /notifications/push, PUT /admin/notifications/push), as
 * PushSubscription.toJSON() gives it, plus the language to write in.
 */
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: pushKey(200), auth: pushKey(100) }),
  lang: z.enum(LANGS).default('bn'),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

/** Stop pushing to this browser (DELETE …/push). */
export const pushRemoveSchema = z.object({ endpoint: z.string().min(1).max(1000) })
export type PushRemoveInput = z.infer<typeof pushRemoveSchema>

/** A Firebase Cloud Messaging registration token (about 160 characters today; the limit leaves room). */
const deviceToken = z.string().trim().min(1).max(4096)

/**
 * This phone's push token from the Kingfisher app (PUT /notifications/device), the language its
 * notifications are written in, and the app version (for support). The server sends to the token
 * once FCM is set up in .env; until then it is kept for when it is.
 */
export const deviceTokenSchema = z.object({
  token: deviceToken,
  platform: z.enum(DEVICE_PLATFORMS),
  lang: z.enum(LANGS).default('bn'),
  appVersion: z.string().trim().max(40).optional(),
})
export type DeviceTokenInput = z.infer<typeof deviceTokenSchema>

/** Stop pushing to this phone (DELETE /notifications/device, also sent before logging out). */
export const deviceRemoveSchema = z.object({ token: deviceToken })
export type DeviceRemoveInput = z.infer<typeof deviceRemoveSchema>
