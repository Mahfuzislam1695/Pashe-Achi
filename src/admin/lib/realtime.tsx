'use client'

import { connectRealtime } from '@/api-client'
import { type NotificationDto, type OrderSummary, SERVICE_LABELS, SOCKET_EVENTS, type UnreadCountDto } from '@/shared'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { api } from './api'
import { useLang } from './i18n'
import { queryKeys } from './queries'

const SOUND_KEY = 'pa_admin_sound'

const SoundContext = createContext<{ enabled: boolean; toggle: () => void }>({ enabled: true, toggle: () => {} })
export const useOrderSound = () => useContext(SoundContext)

/** A short two-tone chime made with WebAudio, so no audio file is needed. */
function chime() {
  try {
    const context = new AudioContext()
    const now = context.currentTime
    for (const [index, frequency] of [880, 1320].entries()) {
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.frequency.value = frequency
      gain.gain.setValueAtTime(0.0001, now + index * 0.14)
      gain.gain.exponentialRampToValueAtTime(0.2, now + index * 0.14 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + index * 0.14 + 0.25)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start(now + index * 0.14)
      oscillator.stop(now + index * 0.14 + 0.3)
    }
    setTimeout(() => void context.close(), 1000)
  } catch {
    // Audio not available (or blocked until the first click): the toast is enough.
  }
}

/**
 * Keeps the panel live: a new order pops a toast (and an optional chime) and refreshes the order
 * list and dashboard; status and bill changes refresh them too; the bell count stays current.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const { t, text, taka } = useLang()
  const [soundEnabled, setSoundEnabled] = useState(true)
  // Handlers are registered once; refs give them the current language and sound setting.
  const latest = useRef({ t, text, taka, soundEnabled, router })
  latest.current = { t, text, taka, soundEnabled, router }

  useEffect(() => {
    try {
      setSoundEnabled(localStorage.getItem(SOUND_KEY) !== 'off')
    } catch {
      // storage unavailable: keep the default
    }
  }, [])

  useEffect(() => {
    const socket = connectRealtime(api.http)
    const refreshOrders = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders })
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    }

    socket.on('connect', () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }))
    socket.on(SOCKET_EVENTS.orderNew, (order: OrderSummary) => {
      refreshOrders()
      const { t, text, taka, soundEnabled, router } = latest.current
      if (soundEnabled) chime()
      toast.success(t(`নতুন অর্ডার ${order.code}`, `New order ${order.code}`), {
        description: `${text(SERVICE_LABELS[order.service])} · ${order.customer?.name ?? ''} · ${taka(order.total)}`,
        action: { label: t('দেখুন', 'Open'), onClick: () => router.push(`/admin/orders/${order.id}`) },
        duration: 10_000,
      })
    })
    socket.on(SOCKET_EVENTS.orderUpdated, refreshOrders)
    socket.on(SOCKET_EVENTS.notificationNew, (notification: NotificationDto) => {
      queryClient.setQueryData<UnreadCountDto>(queryKeys.unread, current => ({ count: (current?.count ?? 0) + 1 }))
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationList })
      // New orders already got their own toast above.
      if (notification.type !== 'ORDER_CREATED') toast(latest.current.text(notification.title), { description: latest.current.text(notification.body) })
    })
    return () => {
      socket.close()
    }
  }, [queryClient])

  const toggle = () =>
    setSoundEnabled(current => {
      try {
        localStorage.setItem(SOUND_KEY, current ? 'off' : 'on')
      } catch {
        // ignore
      }
      return !current
    })

  return <SoundContext.Provider value={{ enabled: soundEnabled, toggle }}>{children}</SoundContext.Provider>
}
