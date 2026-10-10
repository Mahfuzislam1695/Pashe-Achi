'use client'

import type { AdminCustomerDto } from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Ban, CheckCircle2, Save } from 'lucide-react'
import Link from 'next/link'
import { use, useState } from 'react'
import { toast } from 'sonner'

import { AuditFeed } from '@/admin/components/audit-feed'
import { OrderTable } from '@/admin/components/order-table'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useAuditList, useCurrentAdmin, useCustomer, useOrderList } from '@/admin/lib/queries'
import { canManage, errorCode } from '@/admin/lib/utils'

export default function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
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
  const orders = useOrderList({ customerId: customer.id })
  const items = orders.data?.pages.flatMap(page => page.items) ?? []
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
            {customer.isBlocked && <Badge tone="danger">{t('বন্ধ', 'Blocked')}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted">
            <a href={`tel:${customer.mobile}`} className="tabular-nums hover:underline">
              {customer.mobile}
            </a>
            {customer.location ? ` · ${customer.location}` : ''} · {t('যোগ দিয়েছেন', 'Joined')} {formatDate(customer.createdAt)}
          </p>
        </div>
        {canManage(admin.role) &&
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_2fr]">
        <Card title={t('পয়েন্ট', 'Reward points')}>
          {canManage(admin.role) ? (
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
        <Card title={t(`অর্ডার (${digits(customer.orderCount)})`, `Orders (${customer.orderCount})`)}>
          {orders.isPending && <Loading />}
          {orders.isSuccess && !items.length && <Empty>{t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</Empty>}
          {items.length > 0 && <OrderTable orders={items} showCustomer={false} />}
          {orders.hasNextPage && (
            <div className="mt-4 flex justify-center">
              <Button variant="secondary" loading={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>
                {t('আরো দেখুন', 'Load more')}
              </Button>
            </div>
          )}
        </Card>
      </div>

      {canManage(admin.role) && <CustomerHistory customerId={customer.id} />}
    </div>
  )
}

/** What the customer did (signed up, ordered, changed their profile) and what staff did to the account. */
function CustomerHistory({ customerId }: { customerId: string }) {
  const { t } = useLang()
  const log = useAuditList({ customerId }, 10)
  const entries = log.data?.pages.flatMap(page => page.items) ?? []
  return (
    <Card
      title={t('ইতিহাস', 'History')}
      actions={
        <Link href={`/admin/history?customerId=${encodeURIComponent(customerId)}`} className="text-sm font-semibold text-brand-700 hover:underline">
          {t('পুরো ইতিহাস', 'Full history')}
        </Link>
      }
    >
      {log.isPending && <Loading />}
      <ErrorNote code={log.isError ? errorCode(log.error) : null} />
      {log.isSuccess && !entries.length && <Empty>{t('এখনো কিছু নেই।', 'Nothing yet.')}</Empty>}
      {entries.length > 0 && <AuditFeed entries={entries} />}
      {log.hasNextPage && (
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" loading={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
            {t('আরো দেখুন', 'Load more')}
          </Button>
        </div>
      )}
    </Card>
  )
}
