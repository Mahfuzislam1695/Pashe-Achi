'use client'

import { CUSTOMER_SORTS, type CustomerSort, joinAddress, type ListCustomersQuery } from '@/shared'
import { Ban, Coins, ShoppingBag, UserCheck, UserPlus, Users } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { StatGrid, StatTile } from '@/admin/components/charts'
import { ClearFilters, DateRangeFilter, SearchBox } from '@/admin/components/filters'
import { Pagination } from '@/admin/components/pagination'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Card, Empty, ErrorNote, Loading, PageHeader, Select, Table, Td, Th } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useCustomerList, useCustomerStats } from '@/admin/lib/queries'
import { pick, pickDay, useUrlFilters } from '@/admin/lib/url-state'
import { errorCode } from '@/admin/lib/utils'

const YES_NO = ['true', 'false'] as const

export default function CustomersPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="customers.view" title={t('গ্রাহক', 'Customers')}>
      <Suspense fallback={<Loading />}>
        <Customers />
      </Suspense>
    </PermissionGate>
  )
}

/** Filters, sort and page live in the URL, as on the Orders page. */
function Customers() {
  const { t, digits, formatDate } = useLang()
  const url = useUrlFilters()
  const filters = {
    q: url.get('q'),
    blocked: pick(url.get('blocked'), YES_NO),
    ordered: pick(url.get('ordered'), YES_NO),
    from: pickDay(url.get('from')),
    to: pickDay(url.get('to')),
  }
  const sort = pick(url.get('sort'), CUSTOMER_SORTS)
  const query: Partial<ListCustomersQuery> = { ...filters, sort, page: url.page, limit: url.limit }
  const customers = useCustomerList(query)
  const stats = useCustomerStats({ q: filters.q, from: filters.from, to: filters.to })
  const items = customers.data?.items ?? []
  const hasFilters = Object.values(filters).some(Boolean)
  const toggle = (key: 'blocked' | 'ordered', value: 'true' | 'false') => url.set({ [key]: filters[key] === value ? undefined : value })
  const sortLabels: Record<CustomerSort, string> = {
    newest: t('নতুন আগে', 'Newest first'),
    oldest: t('পুরোনো আগে', 'Oldest first'),
    name: t('নাম অনুযায়ী', 'By name'),
    orders_desc: t('বেশি অর্ডার আগে', 'Most orders'),
    points_desc: t('বেশি পয়েন্ট আগে', 'Most points'),
  }

  return (
    <>
      <PageHeader title={t('গ্রাহক', 'Customers')} subtitle={t('নাম, মোবাইল বা লোকেশন দিয়ে খুঁজুন।', 'Search by name, mobile or location.')} />
      {stats.data && (
        <StatGrid columns={6} className="mb-5">
          <StatTile icon={Users} label={t('মোট গ্রাহক', 'Customers')} value={digits(stats.data.total)} hint={filters.q ? t('এই খোঁজে', 'Matching the search') : undefined} />
          <StatTile icon={UserCheck} tone="success" label={t('সক্রিয়', 'Active')} value={digits(stats.data.active)} active={filters.blocked === 'false'} onClick={() => toggle('blocked', 'false')} />
          <StatTile icon={Ban} tone="danger" label={t('বন্ধ করা', 'Blocked')} value={digits(stats.data.blocked)} active={filters.blocked === 'true'} onClick={() => toggle('blocked', 'true')} />
          <StatTile icon={ShoppingBag} tone="warning" label={t('কখনো অর্ডার করেননি', 'Never ordered')} value={digits(stats.data.neverOrdered)} active={filters.ordered === 'false'} onClick={() => toggle('ordered', 'false')} />
          <StatTile
            icon={UserPlus}
            tone="violet"
            label={t('নতুন যোগ দিয়েছেন', 'New sign-ups')}
            value={digits(stats.data.newInRange)}
            hint={filters.from || filters.to ? t('বাছাই করা সময়ে', 'In the chosen period') : t(`শেষ ${digits(30)} দিনে`, 'In the last 30 days')}
          />
          <StatTile icon={Coins} label={t('মোট পয়েন্ট', 'Points held')} value={digits(stats.data.points)} />
        </StatGrid>
      )}
      <Card>
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
          <SearchBox className="sm:col-span-2 lg:col-span-1" value={filters.q} onSearch={q => url.set({ q })} placeholder={t('নাম, মোবাইল বা লোকেশন', 'Name, mobile or location')} />
          <Select aria-label={t('অবস্থা', 'Status')} value={filters.blocked ?? ''} onChange={e => url.set({ blocked: e.target.value || undefined })}>
            <option value="">{t('সব গ্রাহক', 'All customers')}</option>
            <option value="false">{t('সক্রিয়', 'Active')}</option>
            <option value="true">{t('বন্ধ করা', 'Blocked')}</option>
          </Select>
          <Select aria-label={t('অর্ডার', 'Orders')} value={filters.ordered ?? ''} onChange={e => url.set({ ordered: e.target.value || undefined })}>
            <option value="">{t('অর্ডার থাকুক বা না থাকুক', 'With or without orders')}</option>
            <option value="true">{t('অর্ডার করেছেন', 'Have ordered')}</option>
            <option value="false">{t('কখনো অর্ডার করেননি', 'Never ordered')}</option>
          </Select>
          <Select aria-label={t('সাজানো', 'Sort')} value={sort ?? 'newest'} onChange={e => url.set({ sort: e.target.value === 'newest' ? undefined : e.target.value })}>
            {CUSTOMER_SORTS.map(option => (
              <option key={option} value={option}>
                {sortLabels[option]}
              </option>
            ))}
          </Select>
          <ClearFilters disabled={!hasFilters && !sort} onClear={() => url.clear()} />
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
            <span className="text-xs font-semibold text-muted">{t('যোগ দিয়েছেন', 'Joined')}</span>
            <DateRangeFilter className="flex-1" from={filters.from} to={filters.to} onChange={range => url.set({ from: range.from, to: range.to })} />
          </div>
        </div>
        {customers.isPending && <Loading />}
        <ErrorNote code={customers.isError ? errorCode(customers.error) : null} />
        {customers.isSuccess && !items.length && <Empty>{hasFilters ? t('এই ফিল্টারে কোনো গ্রাহক নেই।', 'No customers match these filters.') : t('কোনো গ্রাহক পাওয়া যায়নি।', 'No customers found.')}</Empty>}
        {items.length > 0 && (
          <Table>
            <thead>
              <tr>
                <Th>{t('নাম', 'Name')}</Th>
                <Th>{t('মোবাইল', 'Mobile')}</Th>
                <Th>{t('লোকেশন', 'Location')}</Th>
                <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
                <Th>{t('শেষ অর্ডার', 'Last order')}</Th>
                <Th className="text-right">{t('পয়েন্ট', 'Points')}</Th>
                <Th>{t('যোগ দিয়েছেন', 'Joined')}</Th>
              </tr>
            </thead>
            <tbody>
              {items.map(customer => (
                <tr key={customer.id} className="hover:bg-canvas">
                  <Td>
                    <Link href={`/admin/customers/${customer.id}`} className="font-semibold text-brand-700 hover:underline">
                      {customer.name}
                    </Link>
                    {customer.isBlocked && (
                      <span className="ml-2">
                        <Badge tone="danger">{t('বন্ধ', 'Blocked')}</Badge>
                      </span>
                    )}
                  </Td>
                  <Td className="tabular-nums">{customer.mobile}</Td>
                  <Td className="max-w-64 text-muted">
                    <span className="line-clamp-2">{customer.location ? joinAddress(customer.location) : '—'}</span>
                  </Td>
                  <Td className="text-right tabular-nums">{digits(customer.orderCount)}</Td>
                  <Td className="text-muted">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}</Td>
                  <Td className="text-right tabular-nums">{digits(customer.points)}</Td>
                  <Td className="text-muted">{formatDate(customer.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {customers.data && (
          <Pagination
            page={customers.data.page}
            pageCount={customers.data.pageCount}
            total={customers.data.total}
            limit={customers.data.limit}
            fetching={customers.isPlaceholderData}
            onPage={page => url.set({ page })}
            onLimit={limit => url.set({ limit })}
          />
        )}
      </Card>
    </>
  )
}
