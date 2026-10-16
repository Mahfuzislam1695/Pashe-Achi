'use client'

import { disablePush, enablePush, forgetPush, type PushOptions, type PushStatus, pushStatus, syncPush } from '@/api-client'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { api } from './api'
import { useLang } from './i18n'
import type { Mode } from './paths'

const CHOICE_KEY = 'pa_push'

interface PushState {
  /** null while it is being worked out. */
  status: PushStatus | null
  busy: boolean
  /** The last turn-on failed (no connection, the push service refused): offer to try again. */
  failed: boolean
  enable: () => void
  disable: () => void
}

const PushContext = createContext<PushState>({ status: null, busy: false, failed: false, enable: () => {}, disable: () => {} })

/** Phone notifications for this browser (Web Push): the on/off state and the switch. */
export const usePush = () => useContext(PushContext)

/** Before logging out: this browser stops getting the customer's notifications. */
export const forgetCustomerPush = () => forgetPush(api.notifications.push).catch(() => undefined)

/**
 * Inside the signed-in shell. On load and whenever the language changes it brings the server's copy
 * of this browser's subscription up to date (if the customer turned notifications on here), so a
 * tap opens this version (web or app) and the text comes in the chosen language.
 */
export function PushProvider({ mode, children }: { mode: Mode; children: React.ReactNode }) {
  const { lang } = useLang()
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const options = useMemo<PushOptions>(() => ({ endpoints: api.notifications.push, choiceKey: CHOICE_KEY, lang, mode }), [lang, mode])

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
    // Called straight from the tap: Safari asks for permission only inside it.
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
