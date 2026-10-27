'use client'

import { broadcastSchema, can, type MessageCode, type NotificationDto, NOTIFICATION_TYPE_LABELS, NOTIFICATION_TYPES, type UnreadCountDto, validateForm } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell, BellDot, CalendarDays, CheckCheck, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'

import { StatGrid, StatTile } from '@/admin/components/charts'
import { ClearFilters, DateRangeFilter, FilterTabs } from '@/admin/components/filters'
import { Pagination } from '@/admin/components/pagination'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Textarea } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useNotifications, useNotificationStats } from '@/admin/lib/queries'
import { pick, pickDay, useUrlFilters } from '@/admin/lib/url-state'
import { cn, errorCode } from '@/admin/lib/utils'

export default function NotificationsPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="notifications.view" title={t('নোটিফিকেশন', 'Notifications')}>
      <Notifications />
    </PermissionGate>
  )
}

function Notifications() {
  const { t } = useLang()
  const admin = useCurrentAdmin()
  return (
    <>
      <PageHeader title={t('নোটিফিকেশন', 'Notifications')} subtitle={t('নতুন অর্ডার ও বাতিলের খবর, আর গ্রাহকদের কাছে ঘোষণা।', 'New orders and cancellations, and announcements to customers.')} />
      <div className={cn('grid grid-cols-1 items-start gap-5', can(admin, 'notifications.broadcast') && 'lg:grid-cols-[3fr_2fr]')}>
        <Suspense fallback={<Loading />}>
          <Inbox />
        </Suspense>
        {can(admin, 'notifications.broadcast') && <Broadcast />}
      </div>
    </>
  )
}

/** The inbox: filters and page live in the URL; the counts follow the same filters. */
function Inbox() {
  const { t, text, digits, formatDate } = useLang()
  const router = useRouter()
  const queryClient = useQueryClient()
  const url = useUrlFilters()
  const filters = { type: pick(url.get('type'), NOTIFICATION_TYPES), from: pickDay(url.get('from')), to: pickDay(url.get('to')) }
  const unreadOnly = url.get('unread') === 'true'
  const notifications = useNotifications({ ...filters, unread: unreadOnly ? 'true' : undefined, page: url.page, limit: url.limit })
  const stats = useNotificationStats(filters)
  const items = notifications.data?.items ?? []
  const unread = stats.data?.unread ?? 0
  const filtered = Object.values(filters).some(Boolean)
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
    <div className="grid min-w-0 gap-5">
      {stats.data && (
        <StatGrid columns={3}>
          <StatTile icon={Bell} label={t('মোট', 'Total')} value={digits(stats.data.total)} hint={filtered ? t('এই ফিল্টারে', 'Matching the filters') : undefined} />
          <StatTile icon={BellDot} tone="warning" label={t('পড়া হয়নি', 'Unread')} value={digits(stats.data.unread)} active={unreadOnly} onClick={() => url.set({ unread: unreadOnly ? undefined : 'true' })} />
          <StatTile icon={CalendarDays} tone="violet" label={t('আজ', 'Today')} value={digits(stats.data.today)} />
        </StatGrid>
      )}
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
        <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
          <Select aria-label={t('ধরন', 'Type')} value={filters.type ?? ''} onChange={e => url.set({ type: e.target.value || undefined })}>
            <option value="">{t('সব ধরন', 'All types')}</option>
            {NOTIFICATION_TYPES.map(type => (
              <option key={type} value={type}>
                {text(NOTIFICATION_TYPE_LABELS[type])}
              </option>
            ))}
          </Select>
          <DateRangeFilter from={filters.from} to={filters.to} onChange={range => url.set({ from: range.from, to: range.to })} />
          <ClearFilters disabled={!filtered && !unreadOnly} onClear={() => url.clear()} />
        </div>
        <FilterTabs
          label={t('দেখান', 'Show')}
          value={unreadOnly ? 'true' : undefined}
          onChange={value => url.set({ unread: value })}
          items={[
            { value: undefined, label: t('সব', 'All'), count: stats.data?.total },
            { value: 'true', label: t('পড়া হয়নি', 'Unread'), count: stats.data?.unread },
          ]}
        />
        {notifications.isPending && <Loading />}
        <ErrorNote code={notifications.isError ? errorCode(notifications.error) : null} />
        {notifications.isSuccess && !items.length && (
          <Empty>
            {filtered || unreadOnly ? t('এই ফিল্টারে কোনো নোটিফিকেশন নেই।', 'No notifications match these filters.') : t('এখনো কোনো নোটিফিকেশন নেই।', 'No notifications yet.')}
          </Empty>
        )}
        <ul className="grid gap-2">
          {items.map(notification => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => void open(notification)}
                className={cn(
                  'grid w-full grid-cols-[8px_1fr] gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-canvas',
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
        {notifications.data && (
          <Pagination
            page={notifications.data.page}
            pageCount={notifications.data.pageCount}
            total={notifications.data.total}
            limit={notifications.data.limit}
            fetching={notifications.isPlaceholderData}
            onPage={page => url.set({ page })}
            onLimit={limit => url.set({ limit })}
          />
        )}
      </Card>
    </div>
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
