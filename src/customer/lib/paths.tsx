'use client'

import type { ServiceId } from '@/shared'
import { createContext, useContext } from 'react'

import { APP_BASE } from './constants'

/**
 * The customer site has two versions with the same screens:
 * - web: /, /login, /bazar, /orders/… (wide layout on a desktop, phone layout below 1024px)
 * - app: /app, /app/login, /app/bazar, /app/orders/… (the phone design at every width)
 * Screens build links with usePaths(), so a link never leaves the version it was clicked in.
 */
export type Mode = 'web' | 'app'

const makePaths = (base: string) => ({
  /** The version's front door: the landing page (web) or the welcome screen (app). */
  entry: base || '/',
  login: `${base}/login`,
  signup: `${base}/signup`,
  home: `${base}/bazar`,
  service: (id: ServiceId) => `${base}/${id}`,
  orders: `${base}/orders`,
  order: (id: string) => `${base}/orders/${encodeURIComponent(id)}`,
  notifications: `${base}/notifications`,
  profile: `${base}/profile`,
})

export type Paths = ReturnType<typeof makePaths>

export const webPaths = makePaths('')
export const appPaths = makePaths(APP_BASE)
export const pathsFor = (mode: Mode): Paths => (mode === 'app' ? appPaths : webPaths)

const ModeContext = createContext<Mode>('web')

export function ModeProvider({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  return <ModeContext.Provider value={mode}>{children}</ModeContext.Provider>
}

export const useMode = () => useContext(ModeContext)
export const usePaths = () => pathsFor(useMode())
