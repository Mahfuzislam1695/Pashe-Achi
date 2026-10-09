'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { Badge, Button, Card, Empty, ErrorNote, Input, Loading, PageHeader, Select, Table, Td, Th } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useCustomerList } from '@/admin/lib/queries'
import { errorCode } from '@/admin/lib/utils'

export default function CustomersPage() {
  const { t, digits, formatDate } = useLang()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [blocked, setBlocked] = useState<'' | 'true' | 'false'>('')
  const customers = useCustomerList({ q: q || undefined, blocked: blocked || undefined })
  const items = customers.data?.pages.flatMap(page => page.items) ?? []

  useEffect(() => {
    const timer = setTimeout(() => setQ(search.trim()), 350)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <>
      <PageHeader title={t('গ্রাহক', 'Customers')} subtitle={t('নাম, মোবাইল বা লোকেশন দিয়ে খুঁজুন।', 'Search by name, mobile or location.')} />
      <Card>
        <div className="mb-4 grid gap-2 sm:grid-cols-[2fr_1fr]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input className="pl-9" aria-label={t('খুঁজুন', 'Search')} placeholder={t('নাম, মোবাইল বা লোকেশন', 'Name, mobile or location')} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select aria-label={t('অবস্থা', 'Status')} value={blocked} onChange={e => setBlocked(e.target.value as typeof blocked)}>
            <option value="">{t('সব গ্রাহক', 'All customers')}</option>
            <option value="false">{t('সক্রিয়', 'Active')}</option>
            <option value="true">{t('বন্ধ করা', 'Blocked')}</option>
          </Select>
        </div>
        {customers.isPending && <Loading />}
        <ErrorNote code={customers.isError ? errorCode(customers.error) : null} />
        {customers.isSuccess && !items.length && <Empty>{t('কোনো গ্রাহক পাওয়া যায়নি।', 'No customers found.')}</Empty>}
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
                  <Td className="text-muted">{customer.location || '—'}</Td>
                  <Td className="text-right tabular-nums">{digits(customer.orderCount)}</Td>
                  <Td className="text-muted">{customer.lastOrderAt ? formatDate(customer.lastOrderAt) : '—'}</Td>
                  <Td className="text-right tabular-nums">{digits(customer.points)}</Td>
                  <Td className="text-muted">{formatDate(customer.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {customers.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" loading={customers.isFetchingNextPage} onClick={() => void customers.fetchNextPage()}>
              {t('আরো দেখুন', 'Load more')}
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}
