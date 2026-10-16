'use client'

import { disablePush, enablePush, forgetPush, type PushOptions, type PushStatus, pushStatus, syncPush } from '@/api-client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { api } from './api'
import { useLang } from './i18n'

const CHOICE_KEY = 'pa_admin_push'

interface PushState {
  /** null while it is being worked out. */
  status: PushStatus | null
  busy: boolean
  failed: boolean
  enable: () => void
  disable: () => void
}

const PushContext = createContext<PushState>({ status: null, busy: false, failed: false, enable: () => {}, disable: () => {} })

/** Desktop and phone notifications for this browser (new orders, confirms, cancels): the state and the switch. */
export const usePush = () => useContext(PushContext)

/** Before signing out: this browser stops getting the staff member's notifications. */
export const forgetAdminPush = () => forgetPush(api.notifications.push).catch(() => undefined)

/** Inside the signed-in panel: keeps this browser's subscription current (language, the signed-in admin). */
export function PushProvider({ children }: { children: React.ReactNode }) {
  const { lang } = useLang()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const options = useMemo<PushOptions>(() => ({ endpoints: api.notifications.push, choiceKey: CHOICE_KEY, lang }), [lang])

  useEffect(() => {
    let live = true
    void syncPush(options)
      .catch(() => undefined)
      .then(() => pushStatus(options))
      .then(next => live && setStatus(next))
      .catch(() => live && setStatus('unavailable'))
    return () => {
      live = false
    }
  }, [options])

  const run = (action: (options: PushOptions) => Promise<PushStatus>) => {
    setBusy(true)
    setFailed(false)
    // Called straight from the click: Safari asks for permission only inside it.
    action(options)
      .then(setStatus)
      .catch(() => {
        setFailed(true)
        return pushStatus(options).then(setStatus, () => undefined)
      })
      .finally(() => setBusy(false))
  }

  const value = useMemo<PushState>(() => ({ status, busy, failed, enable: () => run(enablePush), disable: () => run(disablePush) }), [status, busy, failed, options])
  return <PushContext.Provider value={value}>{children}</PushContext.Provider>
}
