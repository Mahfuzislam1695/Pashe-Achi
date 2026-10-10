'use client'

import { useState } from 'react'
import Link from 'next/link'

import { AuditFeed } from '@/admin/components/audit-feed'
import { DailyOrdersChart, RevenueByServiceChart, StatTile } from '@/admin/components/charts'
import { OrderTable } from '@/admin/components/order-table'
import { Card, Empty, ErrorNote, Loading, PageHeader, Select } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useAuditList, useCurrentAdmin, useDashboard } from '@/admin/lib/queries'
import { canManage, errorCode } from '@/admin/lib/utils'

const RANGES = [7, 30, 90] as const

export default function DashboardPage() {
  const { t, digits, taka } = useLang()
  const admin = useCurrentAdmin()
  const [days, setDays] = useState<number>(7)
  const dashboard = useDashboard(days)
  const data = dashboard.data

  return (
    <>
      <PageHeader
        title={t('ড্যাশবোর্ড', 'Dashboard')}
        subtitle={t('আজকের অবস্থা ও সাম্প্রতিক অর্ডার।', "Today's numbers and recent orders.")}
        actions={
          <Select aria-label={t('সময়কাল', 'Period')} value={days} onChange={e => setDays(Number(e.target.value))} className="w-auto">
            {RANGES.map(range => (
              <option key={range} value={range}>
                {t(`শেষ ${digits(range)} দিন`, `Last ${range} days`)}
              </option>
            ))}
          </Select>
        }
      />
      {dashboard.isPending && <Loading />}
      <ErrorNote code={dashboard.isError ? errorCode(dashboard.error) : null} />
      {data && (
        <div className="grid grid-cols-1 gap-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatTile label={t('আজকের অর্ডার', "Today's orders")} value={digits(data.today.orders)} />
            <StatTile label={t('আজকের আয়', "Today's revenue")} value={taka(data.today.revenue)} hint={t('বাতিল ছাড়া', 'Excluding cancelled')} />
            <StatTile label={t('অপেক্ষমাণ', 'Pending')} value={digits(data.pending)} hint={t('বুক করা বাকি', 'Waiting to be booked')} />
            <StatTile label={t('চলমান', 'Active')} value={digits(data.active)} hint={t('বুক করা ও চলমান', 'Booked or in progress')} />
            <StatTile label={t('মোট গ্রাহক', 'Customers')} value={digits(data.customers)} />
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
            <Card>
              <DailyOrdersChart daily={data.daily} title={t('দৈনিক অর্ডার', 'Orders per day')} />
            </Card>
            <Card>
              <RevenueByServiceChart rows={data.byService} title={t('সেবা অনুযায়ী আয়', 'Revenue by service')} />
            </Card>
          </div>
          <Card
            title={t('সাম্প্রতিক অর্ডার', 'Recent orders')}
            actions={
              <Link href="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('সব অর্ডার', 'All orders')}
              </Link>
            }
          >
            <OrderTable orders={data.recent} />
          </Card>
          {canManage(admin.role) && <RecentActivity />}
        </div>
      )}
    </>
  )
}

/** The latest history entries, for managers and super admins. */
function RecentActivity() {
  const { t } = useLang()
  const log = useAuditList({}, 6)
  const entries = log.data?.pages[0]?.items ?? []
  return (
    <Card
      title={t('সাম্প্রতিক কাজ', 'Recent activity')}
      actions={
        <Link href="/admin/history" className="text-sm font-semibold text-brand-700 hover:underline">
          {t('পুরো ইতিহাস', 'Full history')}
        </Link>
      }
    >
      {log.isPending && <Loading />}
      <ErrorNote code={log.isError ? errorCode(log.error) : null} />
      {log.isSuccess && !entries.length && <Empty>{t('এখনো কোনো ইতিহাস নেই।', 'No history yet.')}</Empty>}
      {entries.length > 0 && <AuditFeed entries={entries} />}
    </Card>
  )
}
