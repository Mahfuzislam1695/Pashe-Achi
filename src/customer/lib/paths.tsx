import type { ServiceId } from '@/shared'

import { ACCOUNT_DELETION_PATH, DOWNLOAD_PATH, PRIVACY_PATH } from './constants'

/**
 * Every customer URL: /, /login, /bazar, /orders/… (the wide layout on a desktop, the phone layout
 * below 1024px). The phone version that lived under /app is now the Kingfisher app (mobile/); its
 * old links redirect here (next.config.mjs). Build links from these, never from string literals.
 */
export const webPaths = {
  /** The landing page. */
  entry: '/',
  login: '/login',
  signup: '/signup',
  home: '/bazar',
  service: (id: ServiceId) => `/${id}`,
  orders: '/orders',
  order: (id: string) => `/orders/${encodeURIComponent(id)}`,
  notifications: '/notifications',
  /** আজকের অফার */
  offers: '/offers',
  profile: '/profile',
  /** The app download page (public). */
  download: DOWNLOAD_PATH,
  /** The privacy policy and the account-deletion page (both public). */
  privacy: PRIVACY_PATH,
  accountDeletion: ACCOUNT_DELETION_PATH,
}

export type Paths = typeof webPaths

/** The customer paths, for screens (kept as a hook so the screens read the same as before). */
export const usePaths = (): Paths => webPaths
