'use client'

import { broadcastSchema, type MessageCode, type NotificationDto, NOTIFICATION_TYPE_LABELS, type UnreadCountDto, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCheck, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Textarea } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useNotifications, useUnreadCount } from '@/admin/lib/queries'
import { canManage, cn, errorCode } from '@/admin/lib/utils'

export default function NotificationsPage() {
  const { t } = useLang()
  const admin = useCurrentAdmin()
  return (
    <>
      <PageHeader title={t('নোটিফিকেশন', 'Notifications')} subtitle={t('নতুন অর্ডার ও বাতিলের খবর, আর গ্রাহকদের কাছে ঘোষণা।', 'New orders and cancellations, and announcements to customers.')} />
      <div className={cn('grid grid-cols-1 gap-5', canManage(admin.role) && 'lg:grid-cols-[3fr_2fr]')}>
        <Inbox />
        {canManage(admin.role) && <Broadcast />}
      </div>
    </>
  )
}

function Inbox() {
  const { t, text, formatDate } = useLang()
  const router = useRouter()
  const queryClient = useQueryClient()
  const notifications = useNotifications()
  const unread = useUnreadCount().data?.count ?? 0
  const items = notifications.data?.pages.flatMap(page => page.items) ?? []
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications })
  const markAll = useMutation({ mutationFn: api.notifications.markAllRead, onSuccess: refresh })

  const open = async (notification: NotificationDto) => {
    if (!notification.readAt) {
      queryClient.setQueryData<UnreadCountDto>(queryKeys.unread, current => ({ count: Math.max(0, (current?.count ?? 1) - 1) }))
      await api.notifications.markRead(notification.id).catch(() => undefined)
      void refresh()
    }
    if (notification.data.orderId) router.push(`/admin/orders/${notification.data.orderId}`)
  }

  return (
    <Card
      title={t('ইনবক্স', 'Inbox')}
      actions={
        unread > 0 ? (
          <Button size="sm" variant="ghost" loading={markAll.isPending} onClick={() => markAll.mutate()}>
            <CheckCheck className="size-4" />
            {t('সব পড়া হয়েছে', 'Mark all as read')}
          </Button>
        ) : null
      }
    >
      {notifications.isPending && <Loading />}
      <ErrorNote code={notifications.isError ? errorCode(notifications.error) : null} />
      {notifications.isSuccess && !items.length && <Empty>{t('এখনো কোনো নোটিফিকেশন নেই।', 'No notifications yet.')}</Empty>}
      <ul className="grid gap-2">
        {items.map(notification => (
          <li key={notification.id}>
            <button
              type="button"
              onClick={() => void open(notification)}
              className={cn(
                'grid w-full grid-cols-[8px_1fr] gap-3 rounded-lg border p-3 text-left hover:bg-canvas',
                notification.readAt ? 'border-line' : 'border-brand-200 bg-brand-50/60',
              )}
            >
              <span className={cn('mt-1.5 size-2 rounded-full', !notification.readAt && 'bg-brand-600')} aria-hidden="true" />
              <span className="grid gap-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <strong className="text-sm">{text(notification.title)}</strong>
                  <Badge>{text(NOTIFICATION_TYPE_LABELS[notification.type])}</Badge>
                </span>
                <span className="text-sm text-muted">{text(notification.body)}</span>
                <span className="text-xs text-muted">{formatDate(notification.createdAt, true)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {notifications.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" loading={notifications.isFetchingNextPage} onClick={() => void notifications.fetchNextPage()}>
            {t('আরো দেখুন', 'Load more')}
          </Button>
        </div>
      )}
    </Card>
  )
}

const EMPTY = { titleBn: '', titleEn: '', bodyBn: '', bodyEn: '' }

/** A bilingual announcement to every active customer; each sees it in their own language. */
function Broadcast() {
  const { t, digits } = useLang()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState<MessageCode | null>(null)
  const send = useMutation({
    mutationFn: api.notifications.broadcast,
    onSuccess: result => {
      setForm(EMPTY)
      toast.success(t(`${digits(result.sent)} জন গ্রাহককে পাঠানো হয়েছে`, `Sent to ${result.sent} customers`))
    },
    onError: failure => setError(errorCode(failure)),
  })
  const bind = (key: keyof typeof EMPTY) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: e.target.value })
      setError(null)
    },
  })

  return (
    <Card title={t('ঘোষণা পাঠান', 'Send an announcement')}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          const check = validateForm(broadcastSchema, form, [])
          if (!check.success) return setError(check.code)
          if (!window.confirm(t('সব গ্রাহককে পাঠাবেন?', 'Send to all customers?'))) return
          send.mutate(check.data)
        }}
      >
        <Field label={t('শিরোনাম (বাংলা)', 'Title (Bangla)')}>
          <Input maxLength={120} lang="bn" {...bind('titleBn')} />
        </Field>
        <Field label={t('বার্তা (বাংলা)', 'Message (Bangla)')}>
          <Textarea rows={3} maxLength={1000} lang="bn" {...bind('bodyBn')} />
        </Field>
        <Field label={t('শিরোনাম (ইংরেজি)', 'Title (English)')}>
          <Input maxLength={120} lang="en" {...bind('titleEn')} />
        </Field>
        <Field label={t('বার্তা (ইংরেজি)', 'Message (English)')}>
          <Textarea rows={3} maxLength={1000} lang="en" {...bind('bodyEn')} />
        </Field>
        <ErrorNote code={error} />
        <div>
          <Button type="submit" loading={send.isPending}>
            <Send className="size-4" />
            {t('সব গ্রাহককে পাঠান', 'Send to all customers')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
