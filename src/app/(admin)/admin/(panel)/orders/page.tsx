'use client'

import { type ListOrdersQuery, ORDER_STATUS_LABELS, ORDER_STATUSES, type OrderStatus, SERVICE_IDS, SERVICE_LABELS, type ServiceId } from '@/shared'
import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { OrderTable } from '@/admin/components/order-table'
import { Button, Card, Empty, ErrorNote, Input, Loading, PageHeader, Select } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useOrderList } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function OrdersPage() {
  return (
    <Suspense fallback={<Loading />}>
      <Orders />
    </Suspense>
  )
}

/** Filters live in the URL, so a filtered list can be bookmarked or shared with a colleague. */
function Orders() {
  const { t, text } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const filters: Partial<ListOrdersQuery> = {
    status: (params.get('status') as OrderStatus) || undefined,
    service: (params.get('service') as ServiceId) || undefined,
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    q: params.get('q') || undefined,
    customerId: params.get('customerId') || undefined,
  }
  const [search, setSearch] = useState(filters.q ?? '')
  const orders = useOrderList(filters)
  const items = orders.data?.pages.flatMap(page => page.items) ?? []

  const setFilter = (key: string, value: string | undefined) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((search.trim() || undefined) !== filters.q) setFilter('q', search.trim() || undefined)
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <>
      <PageHeader title={t('অর্ডার', 'Orders')} subtitle={t('নতুন অর্ডার এখানে সাথে সাথে চলে আসে।', 'New orders appear here instantly.')} />
      <Card>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_1fr_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder={t('কোড, নাম বা মোবাইল', 'Code, name or mobile')}
              aria-label={t('খুঁজুন', 'Search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select aria-label={t('অবস্থা', 'Status')} value={filters.status ?? ''} onChange={e => setFilter('status', e.target.value || undefined)}>
            <option value="">{t('সব অবস্থা', 'All statuses')}</option>
            {ORDER_STATUSES.map(status => (
              <option key={status} value={status}>
                {text(ORDER_STATUS_LABELS[status])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('সেবা', 'Service')} value={filters.service ?? ''} onChange={e => setFilter('service', e.target.value || undefined)}>
            <option value="">{t('সব সেবা', 'All services')}</option>
            {SERVICE_IDS.map(service => (
              <option key={service} value={service}>
                {text(SERVICE_LABELS[service])}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label={t('শুরুর তারিখ', 'From date')} value={filters.from ?? ''} onChange={e => setFilter('from', e.target.value || undefined)} />
          <Input type="date" aria-label={t('শেষ তারিখ', 'To date')} value={filters.to ?? ''} onChange={e => setFilter('to', e.target.value || undefined)} />
          <Button
            variant="ghost"
            disabled={!hasFilters}
            onClick={() => {
              setSearch('')
              router.replace(pathname, { scroll: false })
            }}
          >
            <X className="size-4" />
            {t('মুছুন', 'Clear')}
          </Button>
        </div>

        {orders.isPending && <Loading />}
        <ErrorNote code={orders.isError ? errorCode(orders.error) : null} />
        {orders.isSuccess && !items.length && <Empty>{hasFilters ? t('এই ফিল্টারে কোনো অর্ডার নেই।', 'No orders match these filters.') : t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</Empty>}
        {items.length > 0 && <OrderTable orders={items} />}
        {orders.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" loading={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>
              {t('আরো দেখুন', 'Load more')}
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}
