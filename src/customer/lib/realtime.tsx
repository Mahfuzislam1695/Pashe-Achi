'use client'

import { connectRealtime } from '@/api-client'
import { type NotificationDto, SOCKET_EVENTS, type UnreadCountDto } from '@/shared'
import { useQueryClient } from '@tanstack/react-query'
import { Bell, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { api } from './api'
import { useLang } from './i18n'
import { usePaths } from './paths'
import { queryKeys } from './queries'

/**
 * Live updates while signed in: new notifications bump the bell and show a toast, and order
 * changes refresh the order screens without a reload.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<NotificationDto | null>(null)

  useEffect(() => {
    const socket = connectRealtime(api.http)
    // After a reconnect, catch up on anything missed while offline.
    socket.on('connect', () => void queryClient.invalidateQueries({ queryKey: queryKeys.notifications }))
    socket.on(SOCKET_EVENTS.notificationNew, (notification: NotificationDto) => {
      queryClient.setQueryData<UnreadCountDto>(queryKeys.unread, current => ({ count: (current?.count ?? 0) + 1 }))
      void queryClient.invalidateQueries({ queryKey: queryKeys.notificationList })
      setToast(notification)
    })
    socket.on(SOCKET_EVENTS.orderUpdated, () => void queryClient.invalidateQueries({ queryKey: queryKeys.orders }))
    return () => {
      socket.close()
    }
  }, [queryClient])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 6000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <>
      {children}
      {toast && <NotificationToast notification={toast} onClose={() => setToast(null)} />}
    </>
  )
}

function NotificationToast({ notification, onClose }: { notification: NotificationDto; onClose: () => void }) {
  const { text, t } = useLang()
  const router = useRouter()
  const paths = usePaths()
  const open = () => {
    onClose()
    void api.notifications.markRead(notification.id).catch(() => undefined)
    router.push(notification.data.orderId ? paths.order(notification.data.orderId) : paths.notifications)
  }
  return (
    <div className="toast" role="status" aria-live="polite">
      <button type="button" className="toast-body" onClick={open}>
        <Bell size={17} />
        <span>
          <strong>{text(notification.title)}</strong>
          <span>{text(notification.body)}</span>
        </span>
      </button>
      <button type="button" className="icon-button" aria-label={t('বন্ধ করুন', 'Close')} onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  )
}
