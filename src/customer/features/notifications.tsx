'use client'

import type { NotificationDto, UnreadCountDto } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { FormError, LoadingNote, PageCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, queryKeys, useNotifications, useUnreadCount } from '@/customer/lib/queries'

export function NotificationsScreen() {
  const { t, text, formatDate } = useLang()
  const router = useRouter()
  const queryClient = useQueryClient()
  const notifications = useNotifications()
  const unread = useUnreadCount()
  const items = notifications.data?.pages.flatMap(page => page.items) ?? []

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
  const markAll = useMutation({ mutationFn: api.notifications.markAllRead, onSuccess: refresh })
  const open = async (notification: NotificationDto) => {
    if (!notification.readAt) {
      queryClient.setQueryData<UnreadCountDto>(queryKeys.unread, current => ({ count: Math.max(0, (current?.count ?? 1) - 1) }))
      await api.notifications.markRead(notification.id).catch(() => undefined)
      void refresh()
    }
    if (notification.data.orderId) router.push(`/orders/${notification.data.orderId}`)
  }

  return (
    <PageCard icon={Bell} title={t('নোটিফিকেশন', 'Notifications')} subtitle={t('অর্ডারের খবর ও ঘোষণা।', 'Order updates and announcements.')}>
      {(unread.data?.count ?? 0) > 0 && (
        <div className="card-actions">
          <button type="button" className="link-button" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck size={15} />
            {t('সব পড়া হয়েছে', 'Mark all as read')}
          </button>
        </div>
      )}
      {notifications.isPending && <LoadingNote />}
      {notifications.isError && <FormError code={errorCode(notifications.error)} />}
      {notifications.isSuccess && !items.length && <p className="empty-note">{t('এখনো কোনো নোটিফিকেশন নেই।', 'No notifications yet.')}</p>}
      <div className="notification-list">
        {items.map(notification => (
          <button type="button" key={notification.id} className={`notification-item ${notification.readAt ? '' : 'unread'}`} onClick={() => void open(notification)}>
            <span className="notification-dot" aria-hidden="true" />
            <span>
              <strong>{text(notification.title)}</strong>
              <p>{text(notification.body)}</p>
              <small>{formatDate(notification.createdAt, true)}</small>
            </span>
          </button>
        ))}
      </div>
      {notifications.hasNextPage && (
        <button type="button" className="secondary-button load-more" onClick={() => notifications.fetchNextPage()} disabled={notifications.isFetchingNextPage}>
          {t('আরো দেখুন', 'Show more')}
        </button>
      )}
    </PageCard>
  )
}
