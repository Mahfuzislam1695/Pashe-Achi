'use client'

import { type AdminCustomerDto, can, type CustomerLocationDto, joinAddress, mapLink, ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CalendarClock, CheckCircle2, ClipboardList, MapPin, Receipt, Save, Wallet } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'
import { toast } from 'sonner'

import { AuditFeed } from '@/admin/components/audit-feed'
import { StatGrid, StatTile } from '@/admin/components/charts'
import { FilterTabs } from '@/admin/components/filters'
import { OrderTable } from '@/admin/components/order-table'
import { Pagination } from '@/admin/components/pagination'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useAuditList, useCurrentAdmin, useCustomer, useOrderList, useOrderStats } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useLang()
  return (
    <PermissionGate permission="customers.view" title={t('গ্রাহক', 'Customer')}>
      <Customer params={params} />
    </PermissionGate>
  )
}

function Customer({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const { t } = useLang()
  const customer = useCustomer(id)
  return (
    <>
      <Link href="/admin/customers" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" />
        {t('সব গ্রাহক', 'All customers')}
      </Link>
      {customer.isPending && <Loading />}
      <ErrorNote code={customer.isError ? errorCode(customer.error) : null} />
      {customer.data && <CustomerView customer={customer.data} />}
    </>
  )
}

function CustomerView({ customer }: { customer: AdminCustomerDto }) {
  const { t, digits, formatDate } = useLang()
  const admin = useCurrentAdmin()
  const queryClient = useQueryClient()
  const [points, setPoints] = useState(String(customer.points))

  const update = useMutation({
    mutationFn: (body: { isBlocked?: boolean; points?: number }) => api.customers.update(customer.id, body),
    onSuccess: (updated, body) => {
      queryClient.setQueryData(queryKeys.customer(customer.id), updated)
      void queryClient.invalidateQueries({ queryKey: queryKeys.customers })
      void queryClient.invalidateQueries({ queryKey: queryKeys.audit })
      if (body.isBlocked !== undefined) {
        toast.success(
          body.isBlocked ? t('গ্রাহককে বন্ধ করা হয়েছে', 'Customer blocked') : t('গ্রাহককে চালু করা হয়েছে', 'Customer unblocked'),
          body.isBlocked ? { description: t('সব ডিভাইস থেকে লগআউট করা হয়েছে।', 'They were signed out on every device.') } : undefined,
        )
      } else toast.success(t('পয়েন্ট সেভ হয়েছে', 'Points saved'))
    },
  })

  return (
    <div className="grid grid-cols-1 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            {customer.deleted ? (
              <Badge tone="danger">{t('অ্যাকাউন্ট মুছে ফেলা হয়েছে', 'Account deleted')}</Badge>
            ) : (
              customer.isBlocked && <Badge tone="danger">{t('বন্ধ', 'Blocked')}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            <a href={`tel:${customer.mobile}`} className="tabular-nums hover:underline">
              {customer.mobile}
            </a>
            {customer.location ? ` · ${joinAddress(customer.location)}` : ''} · {t('যোগ দিয়েছেন', 'Joined')} {formatDate(customer.createdAt)}
          </p>
        </div>
        {can(admin, 'customers.block') &&
          !customer.deleted &&
          (customer.isBlocked ? (
            <Button variant="secondary" loading={update.isPending} onClick={() => update.mutate({ isBlocked: false })}>
              <CheckCircle2 className="size-4" />
              {t('চালু করুন', 'Unblock')}
            </Button>
          ) : (
            <Button
              variant="danger"
              loading={update.isPending}
              onClick={() => {
                if (window.confirm(t('এই গ্রাহককে বন্ধ করবেন? তিনি আর লগইন বা অর্ডার করতে পারবেন না।', 'Block this customer? They will not be able to log in or order.')))
                  update.mutate({ isBlocked: true })
              }}
            >
              <Ban className="size-4" />
              {t('বন্ধ করুন', 'Block')}
            </Button>
          ))}
      </div>
      <ErrorNote code={update.isError ? errorCode(update.error) : null} />
      <CustomerStats customer={customer} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <div className="grid min-w-0 content-start gap-5">
          <Card title={t('পয়েন্ট', 'Reward points')}>
            {can(admin, 'customers.edit_points') && !customer.deleted ? (
              <form
                className="flex items-end gap-2"
                onSubmit={event => {
                  event.preventDefault()
                  update.mutate({ points: Math.max(0, Math.round(Number(points) || 0)) })
                }}
              >
                <Field label={t('মোট পয়েন্ট', 'Total points')} className="flex-1">
                  <Input type="number" min={0} step={1} inputMode="numeric" value={points} onChange={e => setPoints(e.target.value)} />
                </Field>
                <Button type="submit" variant="secondary" disabled={points === String(customer.points)}>
                  <Save className="size-4" />
                  {t('সেভ', 'Save')}
                </Button>
              </form>
            ) : (
              <p className="text-2xl font-semibold tabular-nums">{digits(customer.points)}</p>
            )}
          </Card>
          <CustomerLocation location={customer.location} />
        </div>
        <CustomerOrders customerId={customer.id} />
      </div>

      {can(admin, 'history.view') && <CustomerHistory customerId={customer.id} />}
    </div>
  )
}

/** What the customer has ordered and spent (confirmed bills), from the same numbers as the Orders page. */
function CustomerStats({ customer }: { customer: AdminCustomerDto }) {
  const { t, digits, taka, formatDate } = useLang()
  const stats = useOrderStats({ customerId: customer.id })
  if (!stats.data) return null
  return (
    <StatGrid>
      <StatTile
        icon={ClipboardList}
        label={t('মোট অর্ডার', 'Orders')}
        value={digits(stats.data.orders)}
        hint={t(`বাতিল: ${digits(stats.data.byStatus.CANCELLED)}`, `Cancelled: ${digits(stats.data.byStatus.CANCELLED)}`)}
      />
      <StatTile icon={Wallet} tone="success" label={t('মোট খরচ', 'Total spent')} value={taka(stats.data.revenue)} hint={t('কনফার্ম করা বিল', 'Confirmed bills')} />
      <StatTile icon={Receipt} label={t('গড় বিল', 'Average bill')} value={taka(stats.data.averageBill)} />
      <StatTile icon={CalendarClock} tone="violet" label={t('শেষ অর্ডার', 'Last order')} value={customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'} />
    </StatGrid>
  )
}

/** The customer's orders by status, ten to a page. */
function CustomerOrders({ customerId }: { customerId: string }) {
  const { t, text, digits } = useLang()
  const [status, setStatus] = useState<OrderStatus | undefined>()
  const [page, setPage] = useState(1)
  const orders = useOrderList({ customerId, status, page, limit: 10 })
  const stats = useOrderStats({ customerId })
  const items = orders.data?.items ?? []
  const total = stats.data?.orders ?? 0
  return (
    <Card title={t(`অর্ডার (${digits(total)})`, `Orders (${digits(total)})`)}>
      {total > 0 && (
        <FilterTabs
          label={t('অবস্থা', 'Status')}
          value={status}
          onChange={value => {
            setStatus(value)
            setPage(1)
          }}
          items={[
            { value: undefined, label: t('সব', 'All'), count: total },
            // Only the statuses this customer has orders in.
            ...ORDER_STATUSES.filter(value => stats.data?.byStatus[value] || value === status).map(value => ({
              value,
              label: text(ORDER_STATUS_LABELS[value]),
              count: stats.data?.byStatus[value],
            })),
          ]}
        />
      )}
      {orders.isPending && <Loading />}
      <ErrorNote code={orders.isError ? errorCode(orders.error) : null} />
      {orders.isSuccess && !items.length && <Empty>{t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</Empty>}
      {items.length > 0 && <OrderTable orders={items} showCustomer={false} />}
      {orders.data && (
        <Pagination page={orders.data.page} pageCount={orders.data.pageCount} total={orders.data.total} limit={orders.data.limit} fetching={orders.isPlaceholderData} onPage={setPage} />
      )}
    </Card>
  )
}

/** The customer's one location (আমার লোকেশন), picked on the map, with a link to open it. */
function CustomerLocation({ location }: { location: CustomerLocationDto | null }) {
  const { t } = useLang()
  return (
    <Card title={t('লোকেশন', 'Location')}>
      {!location && <Empty>{t('ম্যাপে লোকেশন দেওয়া হয়নি।', 'No location on the map yet.')}</Empty>}
      {location && (
        <div className="grid gap-1 text-sm">
          {location.details && <p className="font-semibold">{location.details}</p>}
          <p className="text-muted">{location.address}</p>
          <a href={mapLink(location)} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
            <MapPin className="size-3.5" />
            {t('ম্যাপে দেখুন', 'Open in map')}
          </a>
        </div>
      )}
    </Card>
  )
}

/** What the customer did (signed up, ordered, changed their profile) and what staff did to the account: the latest ten. */
function CustomerHistory({ customerId }: { customerId: string }) {
  const { t, digits } = useLang()
  const log = useAuditList({ customerId, limit: 10 })
  const entries = log.data?.items ?? []
  const fullHistory = `/admin/history?customerId=${encodeURIComponent(customerId)}`
  return (
    <Card
      title={t('ইতিহাস', 'History')}
      actions={
        <Link href={fullHistory} className="text-sm font-semibold text-brand-700 hover:underline">
          {t('পুরো ইতিহাস', 'Full history')}
        </Link>
      }
    >
      {log.isPending && <Loading />}
      <ErrorNote code={log.isError ? errorCode(log.error) : null} />
      {log.isSuccess && !entries.length && <Empty>{t('এখনো কিছু নেই।', 'Nothing yet.')}</Empty>}
      {entries.length > 0 && <AuditFeed entries={entries} />}
      {log.data && log.data.total > entries.length && (
        <p className="mt-3 text-center text-xs text-muted">
          {t(`মোট ${digits(log.data.total)}টির শেষ ${digits(entries.length)}টি।`, `The latest ${digits(entries.length)} of ${digits(log.data.total)}.`)}{' '}
          <Link href={fullHistory} className="font-semibold text-brand-700 hover:underline">
            {t('সব দেখুন', 'See all')}
          </Link>
        </p>
      )}
    </Card>
  )
}
