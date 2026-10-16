import { z } from 'zod'

import { LANGS } from '../enums'

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
 * PushSubscription.toJSON() gives it, plus the language to write in and, for customers, the site
 * version a tap should open (web or app).
 */
export const pushSubscriptionSchema = z.object({
  endpoint: pushEndpoint,
  keys: z.object({ p256dh: pushKey(200), auth: pushKey(100) }),
  lang: z.enum(LANGS).default('bn'),
  mode: z.enum(['web', 'app']).optional(),
})
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>

/** Stop pushing to this browser (DELETE …/push). */
export const pushRemoveSchema = z.object({ endpoint: z.string().min(1).max(1000) })
export type PushRemoveInput = z.infer<typeof pushRemoveSchema>
