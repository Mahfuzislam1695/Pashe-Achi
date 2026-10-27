import type { Lang, PushKeyDto, PushSubscriptionInput } from '@/shared'

// Phone and desktop notifications (Web Push) for this browser, shared by the customer site and the
// admin panel. One service worker (public/sw.js, scope /) shows them; each side subscribes on its
// own and remembers its own on/off choice. Browser-only: call these from effects and click handlers.

/** The `notifications.push` part of the customer or admin API client. */
export interface PushEndpoints {
  key(): Promise<PushKeyDto>
  subscribe(body: PushSubscriptionInput): Promise<void>
  remove(endpoint: string): Promise<void>
}

/**
 * - on: this browser gets notifications for the signed-in account
 * - off: it could, after a tap on "turn on"
 * - blocked: the user refused notifications for this site in the browser
 * - ios-install: an iPhone or iPad gets them only after Add to Home Screen
 * - unsupported: this browser can't do push
 * - unavailable: push is not set up on the server (no VAPID keys)
 */
export type PushStatus = 'on' | 'off' | 'blocked' | 'ios-install' | 'unsupported' | 'unavailable'

export interface PushOptions {
  endpoints: PushEndpoints
  /** localStorage key that remembers this side's choice ("on" / "off"). */
  choiceKey: string
  lang: Lang
}

const WORKER = '/sw.js'

function readChoice(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeChoice(key: string, value: 'on' | 'off') {
  try {
    localStorage.setItem(key, value)
  } catch {
    // storage unavailable: the choice lasts until the page closes
  }
}

/** What this browser can do, before asking the server or the user anything. */
export function pushSupport(): 'supported' | 'ios-install' | 'unsupported' {
  if (typeof window === 'undefined') return 'unsupported'
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const installed = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
  if (ios && !installed) return 'ios-install'
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window ? 'supported' : 'unsupported'
}

// The server's key rarely changes: ask once per page load (a failed request is asked again).
const keys = new WeakMap<PushEndpoints, Promise<PushKeyDto>>()
function publicKey(endpoints: PushEndpoints) {
  let pending = keys.get(endpoints)
  if (!pending) {
    pending = endpoints.key()
    pending.catch(() => keys.delete(endpoints))
    keys.set(endpoints, pending)
  }
  return pending.then(dto => dto.publicKey)
}

function decodeKey(base64url: string) {
  const base64 = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64), char => char.charCodeAt(0))
}

const sameKey = (a: ArrayBuffer | null, b: Uint8Array) => !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((byte, index) => byte === b[index])

async function currentSubscription() {
  const registration = await navigator.serviceWorker.getRegistration('/')
  return (await registration?.pushManager.getSubscription()) ?? null
}

/** Registers the worker and returns this browser's subscription for `key`, making one if needed. */
async function subscribeBrowser(key: string) {
  await navigator.serviceWorker.register(WORKER, { scope: '/', updateViaCache: 'none' })
  const registration = await navigator.serviceWorker.ready
  const applicationServerKey = decodeKey(key)
  const existing = await registration.pushManager.getSubscription()
  if (existing) {
    if (sameKey(existing.options.applicationServerKey, applicationServerKey)) return existing
    // The server has a new key pair: the old subscription can't receive anything any more.
    await existing.unsubscribe().catch(() => false)
  }
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })
}

function toInput(subscription: PushSubscription, options: PushOptions): PushSubscriptionInput {
  const json = subscription.toJSON()
  return {
    endpoint: subscription.endpoint,
    keys: { p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' },
    lang: options.lang,
  }
}

export async function pushStatus(options: PushOptions): Promise<PushStatus> {
  const support = pushSupport()
  if (support !== 'supported') return support
  if (!(await publicKey(options.endpoints))) return 'unavailable'
  if (Notification.permission === 'denied') return 'blocked'
  if (Notification.permission !== 'granted' || readChoice(options.choiceKey) !== 'on') return 'off'
  return (await currentSubscription()) ? 'on' : 'off'
}

/**
 * Turns notifications on (call it straight from the click: Safari only asks for permission inside
 * the user's tap). Returns the new status.
 */
export async function enablePush(options: PushOptions): Promise<PushStatus> {
  const support = pushSupport()
  if (support !== 'supported') return support
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off'
  const key = await publicKey(options.endpoints)
  if (!key) return 'unavailable'
  await options.endpoints.subscribe(toInput(await subscribeBrowser(key), options))
  writeChoice(options.choiceKey, 'on')
  return 'on'
}

/**
 * Keeps the server's copy current on every page load and language change: a renewed subscription,
 * the language to write in, and the account now signed in. Does nothing unless this side turned
 * notifications on in this browser.
 */
export async function syncPush(options: PushOptions) {
  if (pushSupport() !== 'supported' || Notification.permission !== 'granted' || readChoice(options.choiceKey) !== 'on') return
  const key = await publicKey(options.endpoints)
  if (!key) return
  await options.endpoints.subscribe(toInput(await subscribeBrowser(key), options))
}

/** Turns notifications off for this side. The browser keeps its subscription: the other side may use it. */
export async function disablePush(options: PushOptions): Promise<PushStatus> {
  writeChoice(options.choiceKey, 'off')
  await forgetPush(options.endpoints)
  return pushStatus(options)
}

/** Before logging out: stop sending this account's notifications to this browser (the choice stays for the next sign-in). */
export async function forgetPush(endpoints: PushEndpoints) {
  if (pushSupport() !== 'supported') return
  const subscription = await currentSubscription()
  if (subscription) await endpoints.remove(subscription.endpoint)
}
