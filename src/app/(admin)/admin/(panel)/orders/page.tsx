'use client'

import { type ListOrdersQuery, ORDER_SORTS, ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderSort, SERVICE_IDS, SERVICE_LABELS } from '@/shared'
import { Ban, ClipboardList, Receipt, Wallet } from 'lucide-react'
import { Suspense } from 'react'

import { StatGrid, StatTile } from '@/admin/components/charts'
import { ClearFilters, DateRangeFilter, FilterChips, FilterTabs, SearchBox } from '@/admin/components/filters'
import { OrderTable } from '@/admin/components/order-table'
import { Pagination } from '@/admin/components/pagination'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Card, Empty, ErrorNote, Loading, PageHeader, Select } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useOrderList, useOrderStats } from '@/admin/lib/queries'
import { pick, pickDay, useUrlFilters } from '@/admin/lib/url-state'
import { errorCode } from '@/admin/lib/utils'

export default function OrdersPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="orders.view" title={t('অর্ডার', 'Orders')}>
      <Suspense fallback={<Loading />}>
        <Orders />
      </Suspense>
    </PermissionGate>
  )
}

/** Filters, sort and page live in the URL, so a filtered list can be bookmarked or shared with a colleague. */
function Orders() {
  const { t, text, digits, taka } = useLang()
  const url = useUrlFilters()
  const filters = {
    service: pick(url.get('service'), SERVICE_IDS),
    dateBy: pick(url.get('dateBy'), ['created', 'scheduled'] as const),
    from: pickDay(url.get('from')),
    to: pickDay(url.get('to')),
    q: url.get('q'),
    customerId: url.get('customerId'),
  }
  const status = pick(url.get('status'), ORDER_STATUSES)
  const sort = pick(url.get('sort'), ORDER_SORTS)
  const query: Partial<ListOrdersQuery> = { ...filters, status, sort, page: url.page, limit: url.limit }
  const orders = useOrderList(query)
  const stats = useOrderStats(filters)
  const items = orders.data?.items ?? []
  const hasFilters = Object.values({ ...filters, status }).some(Boolean)
  const sortLabels: Record<OrderSort, string> = {
    newest: t('নতুন আগে', 'Newest first'),
    oldest: t('পুরোনো আগে', 'Oldest first'),
    total_desc: t('বেশি বিল আগে', 'Highest bill'),
    total_asc: t('কম বিল আগে', 'Lowest bill'),
    scheduled_asc: t('ডেলিভারির দিন অনুযায়ী', 'By delivery day'),
  }

  return (
    <>
      <PageHeader title={t('অর্ডার', 'Orders')} subtitle={t('নতুন অর্ডার এখানে সাথে সাথে চলে আসে।', 'New orders appear here instantly.')} />
      {stats.data && (
        <StatGrid className="mb-5">
          <StatTile icon={ClipboardList} label={t('অর্ডার', 'Orders')} value={digits(stats.data.orders)} hint={t('এই ফিল্টারে, সব অবস্থা', 'Matching, all statuses')} />
          <StatTile icon={Wallet} tone="success" label={t('আয়', 'Revenue')} value={taka(stats.data.revenue)} hint={t(`সম্পন্ন: ${taka(stats.data.completedRevenue)}`, `Completed: ${taka(stats.data.completedRevenue)}`)} />
          <StatTile icon={Receipt} label={t('গড় বিল', 'Average bill')} value={taka(stats.data.averageBill)} hint={t('কনফার্ম করা বিল', 'Confirmed bills')} />
          <StatTile
            icon={Ban}
            tone="danger"
            label={t('বাতিল', 'Cancelled')}
            value={`${digits(Math.round(stats.data.cancelledRate * 1000) / 10)}%`}
            hint={t(`${digits(stats.data.byStatus.CANCELLED)}টি অর্ডার`, `${digits(stats.data.byStatus.CANCELLED)} orders`)}
            active={status === 'CANCELLED'}
            onClick={() => url.set({ status: status === 'CANCELLED' ? undefined : 'CANCELLED' })}
          />
        </StatGrid>
      )}
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_auto]">
          <SearchBox className="sm:col-span-2 lg:col-span-1" value={filters.q} onSearch={q => url.set({ q })} placeholder={t('কোড, নাম বা মোবাইল', 'Code, name or mobile')} />
          <Select aria-label={t('সেবা', 'Service')} value={filters.service ?? ''} onChange={e => url.set({ service: e.target.value || undefined })}>
            <option value="">{t('সব সেবা', 'All services')}</option>
            {SERVICE_IDS.map(service => (
              <option key={service} value={service}>
                {text(SERVICE_LABELS[service])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('সাজানো', 'Sort')} value={sort ?? 'newest'} onChange={e => url.set({ sort: e.target.value === 'newest' ? undefined : e.target.value })}>
            {ORDER_SORTS.map(option => (
              <option key={option} value={option}>
                {sortLabels[option]}
              </option>
            ))}
          </Select>
          <ClearFilters disabled={!hasFilters && !sort} onClear={() => url.clear()} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <Select
              aria-label={t('কোন তারিখ', 'Which date')}
              className="w-auto"
              value={filters.dateBy ?? 'created'}
              onChange={e => url.set({ dateBy: e.target.value === 'created' ? undefined : e.target.value })}
            >
              <option value="created">{t('অর্ডারের তারিখ', 'Order date')}</option>
              <option value="scheduled">{t('ডেলিভারির তারিখ', 'Delivery date')}</option>
            </Select>
            <DateRangeFilter className="flex-1" from={filters.from} to={filters.to} onChange={range => url.set({ from: range.from, to: range.to })} />
          </div>
        </div>

        <FilterTabs
          label={t('অবস্থা', 'Status')}
          value={status}
          onChange={value => url.set({ status: value })}
          items={[
            { value: undefined, label: t('সব', 'All'), count: stats.data?.orders },
            ...ORDER_STATUSES.map(value => ({ value, label: text(ORDER_STATUS_LABELS[value]), count: stats.data?.byStatus[value] })),
          ]}
        />
        <FilterChips chips={filters.customerId ? [{ key: 'customerId', label: t('একজন গ্রাহকের অর্ডার', "One customer's orders") }] : []} onRemove={key => url.set({ [key]: undefined })} />

        {orders.isPending && <Loading />}
        <ErrorNote code={orders.isError ? errorCode(orders.error) : stats.isError ? errorCode(stats.error) : null} />
        {orders.isSuccess && !items.length && <Empty>{hasFilters ? t('এই ফিল্টারে কোনো অর্ডার নেই।', 'No orders match these filters.') : t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</Empty>}
        {items.length > 0 && <OrderTable orders={items} />}
        {orders.data && (
          <Pagination
            page={orders.data.page}
            pageCount={orders.data.pageCount}
            total={orders.data.total}
            limit={orders.data.limit}
            fetching={orders.isPlaceholderData}
            onPage={page => url.set({ page })}
            onLimit={limit => url.set({ limit })}
          />
        )}
      </Card>
    </>
  )
}
