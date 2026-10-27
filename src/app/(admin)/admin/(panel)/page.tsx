'use client'

import { can, type DashboardDto, isoDateInBd, type OrderStatus, type ServiceId } from '@/shared'
import { Ban, ClipboardList, Clock, Hourglass, Receipt, Truck, UserPlus, Wallet } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Suspense, useEffect } from 'react'

import { AuditFeed } from '@/admin/components/audit-feed'
import { RevenueByServiceChart, StatGrid, StatTile, StatusBreakdownChart, TrendChart } from '@/admin/components/charts'
import { DateRangeFilter, presetRange, type RangePreset } from '@/admin/components/filters'
import { OrderTable } from '@/admin/components/order-table'
import { Card, Empty, ErrorNote, Loading, PageHeader, Table, Td, Th } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useAuditList, useCurrentAdmin, useDashboard, useStaffActivity } from '@/admin/lib/queries'
import { pickDay, useUrlFilters } from '@/admin/lib/url-state'
import { errorCode, homePath } from '@/admin/lib/utils'

const PRESETS: RangePreset[] = ['today', 'yesterday', '7', '30', '90', 'month', 'last_month', 'year']

/** The panel's home. A role without the dashboard goes on to the first page it can open. */
export default function DashboardPage() {
  const admin = useCurrentAdmin()
  const router = useRouter()
  const allowed = can(admin, 'dashboard.view')
  useEffect(() => {
    if (!allowed) router.replace(homePath(admin))
  }, [allowed, admin, router])
  if (!allowed) return <Loading />
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  )
}

/** The period lives in the URL (?from&to), so a view can be bookmarked or shared; the default is the last 7 days. */
function Dashboard() {
  const { t } = useLang()
  const admin = useCurrentAdmin()
  const url = useUrlFilters()
  const fallback = presetRange('7')
  const range = { from: pickDay(url.get('from')) ?? fallback.from, to: pickDay(url.get('to')) ?? fallback.to }
  const dashboard = useDashboard(range)
  const data = dashboard.data

  return (
    <>
      <PageHeader
        title={t('ড্যাশবোর্ড', 'Dashboard')}
        subtitle={t('আয় মানে গ্রাহকের কনফার্ম করা বিল: বুক করা, চলমান ও সম্পন্ন অর্ডার।', 'Revenue means bills customers have confirmed: booked, in progress and completed orders.')}
        actions={
          <DateRangeFilter
            from={range.from}
            to={range.to}
            presets={PRESETS}
            max={isoDateInBd()}
            className="w-full sm:w-auto"
            onChange={next => url.set({ from: next.from ?? fallback.from, to: next.to ?? fallback.to })}
          />
        }
      />
      {dashboard.isPending && <Loading />}
      <ErrorNote code={dashboard.isError ? errorCode(dashboard.error) : null} />
      {data && (
        <div className="grid grid-cols-1 gap-5">
          <LiveTiles data={data} />
          <PeriodTiles data={data} />
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[3fr_2fr]">
            <Card>
              <TrendChart series={data.series} bucket={data.bucket} title={t('অর্ডার ও আয়', 'Orders and revenue')} />
            </Card>
            <Card>
              <StatusBreakdownChart
                byStatus={data.byStatus}
                title={t('অবস্থা অনুযায়ী অর্ডার', 'Orders by status')}
                hrefFor={status => ordersHref({ status, from: data.from, to: data.to })}
              />
            </Card>
          </div>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <Card>
              <RevenueByServiceChart rows={data.byService} title={t('সেবা অনুযায়ী আয়', 'Revenue by service')} hrefFor={service => ordersHref({ service, from: data.from, to: data.to })} />
            </Card>
            <TopCustomers rows={data.topCustomers} />
          </div>
          {can(admin, 'dashboard.staff_activity') && <StaffActivity from={data.from} to={data.to} />}
          <Card
            title={t('সাম্প্রতিক অর্ডার', 'Recent orders')}
            actions={
              <Link href="/admin/orders" className="text-sm font-semibold text-brand-700 hover:underline">
                {t('সব অর্ডার', 'All orders')}
              </Link>
            }
          >
            {data.recent.length ? <OrderTable orders={data.recent} /> : <Empty>{t('এখনো কোনো অর্ডার নেই।', 'No orders yet.')}</Empty>}
          </Card>
          {can(admin, 'history.view') && <RecentActivity />}
        </div>
      )}
    </>
  )
}

const ordersHref = (filters: { status?: OrderStatus; service?: ServiceId; from?: string; to?: string }) => {
  const query = new URLSearchParams(Object.entries(filters).filter((entry): entry is [string, string] => !!entry[1]))
  return `/admin/orders${query.size ? `?${query}` : ''}`
}

function SectionTitle({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="-mb-2 flex flex-wrap items-baseline gap-x-2">
      <h2 className="text-sm font-semibold text-navy">{children}</h2>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  )
}

/** Right now, whatever the period: the queue staff work through. */
function LiveTiles({ data }: { data: DashboardDto }) {
  const { t, digits, taka } = useLang()
  const today = isoDateInBd()
  return (
    <div className="grid gap-3">
      <SectionTitle>{t('এই মুহূর্তে', 'Right now')}</SectionTitle>
      <StatGrid columns={5}>
        <StatTile
          icon={Clock}
          tone="warning"
          label={t('কাজ বাকি', 'Needs action')}
          value={digits(data.live.needsAction)}
          hint={t('নতুন অর্ডার: বুক করা বা দাম দেওয়া বাকি', 'New orders to book or price')}
          href={ordersHref({ status: 'PENDING' })}
        />
        <StatTile
          icon={Hourglass}
          tone="warning"
          label={t('গ্রাহকের অপেক্ষায়', 'Awaiting customer')}
          value={digits(data.live.awaitingCustomer)}
          hint={t('দাম পাঠানো, কনফার্ম বাকি', 'Price sent, not confirmed yet')}
          href={ordersHref({ status: 'QUOTED' })}
        />
        <StatTile icon={Truck} tone="violet" label={t('চলমান', 'Active')} value={digits(data.live.active)} hint={t('বুক করা ও চলমান', 'Booked or in progress')} />
        <StatTile icon={ClipboardList} label={t('আজকের অর্ডার', "Today's orders")} value={digits(data.live.todayOrders)} href={ordersHref({ from: today, to: today })} />
        <StatTile icon={Wallet} tone="success" label={t('আজকের আয়', "Today's revenue")} value={taka(data.live.todayRevenue)} hint={t('কনফার্ম করা বিল', 'Confirmed bills')} />
      </StatGrid>
    </div>
  )
}

/** The period's totals, each beside the period of the same length before it. */
function PeriodTiles({ data }: { data: DashboardDto }) {
  const { t, digits, taka, formatDate } = useLang()
  const span = (range: { from: string; to: string }) => (range.from === range.to ? formatDate(range.from) : `${formatDate(range.from)} – ${formatDate(range.to)}`)
  const percent = (rate: number) => `${digits(Math.round(rate * 1000) / 10)}%`
  const { current, before } = data
  return (
    <div className="grid gap-3">
      <SectionTitle note={t(`${span(data)}, তুলনা ${span(data.previous)}`, `${span(data)}, compared with ${span(data.previous)}`)}>{t('এই সময়কালে', 'In this period')}</SectionTitle>
      <StatGrid columns={6}>
        <StatTile
          icon={ClipboardList}
          label={t('অর্ডার', 'Orders')}
          value={digits(current.orders)}
          delta={{ current: current.orders, previous: before.orders, previousText: digits(before.orders) }}
          href={ordersHref({ from: data.from, to: data.to })}
        />
        <StatTile
          icon={Wallet}
          tone="success"
          label={t('আয়', 'Revenue')}
          value={taka(current.revenue)}
          delta={{ current: current.revenue, previous: before.revenue, previousText: taka(before.revenue) }}
        />
        <StatTile
          icon={Receipt}
          tone="success"
          label={t('সম্পন্ন অর্ডারের আয়', 'Completed revenue')}
          value={taka(current.completedRevenue)}
          delta={{ current: current.completedRevenue, previous: before.completedRevenue, previousText: taka(before.completedRevenue) }}
          href={ordersHref({ status: 'COMPLETED', from: data.from, to: data.to })}
        />
        <StatTile
          icon={Receipt}
          label={t('গড় বিল', 'Average bill')}
          value={taka(current.averageBill)}
          delta={{ current: current.averageBill, previous: before.averageBill, previousText: taka(before.averageBill) }}
        />
        <StatTile
          icon={Ban}
          tone="danger"
          label={t('বাতিলের হার', 'Cancellation rate')}
          value={percent(current.cancelledRate)}
          delta={{ current: current.cancelledRate, previous: before.cancelledRate, betterWhen: 'down', kind: 'points', previousText: percent(before.cancelledRate) }}
          href={ordersHref({ status: 'CANCELLED', from: data.from, to: data.to })}
        />
        <StatTile
          icon={UserPlus}
          tone="violet"
          label={t('নতুন গ্রাহক', 'New customers')}
          value={digits(current.newCustomers)}
          delta={{ current: current.newCustomers, previous: before.newCustomers, previousText: digits(before.newCustomers) }}
          href={`/admin/customers?from=${data.from}&to=${data.to}`}
        />
      </StatGrid>
    </div>
  )
}

/** The period's biggest spenders (confirmed bills). */
function TopCustomers({ rows }: { rows: DashboardDto['topCustomers'] }) {
  const { t, digits, taka } = useLang()
  return (
    <Card title={t('সেরা গ্রাহক', 'Top customers')}>
      {!rows.length && <Empty>{t('এই সময়কালে কোনো কনফার্ম করা বিল নেই।', 'No confirmed bills in this period.')}</Empty>}
      {rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>{t('গ্রাহক', 'Customer')}</Th>
              <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
              <Th className="text-right">{t('খরচ', 'Spent')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <Td>
                  <Link href={`/admin/customers/${row.id}`} className="font-semibold text-brand-700 hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted tabular-nums">{row.mobile}</div>
                </Td>
                <Td className="text-right tabular-nums">{digits(row.orders)}</Td>
                <Td className="text-right font-semibold tabular-nums">{taka(row.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

/** What each staff member did to orders in the period (managers and up). */
function StaffActivity({ from, to }: { from: string; to: string }) {
  const { t, text, digits } = useLang()
  const activity = useStaffActivity({ from, to })
  const rows = activity.data?.rows ?? []
  return (
    <Card title={t('স্টাফের কাজ', 'Staff activity')}>
      {activity.isPending && <Loading />}
      <ErrorNote code={activity.isError ? errorCode(activity.error) : null} />
      {activity.isSuccess && !rows.length && <Empty>{t('এই সময়কালে স্টাফ কোনো অর্ডারে কাজ করেননি।', 'No staff worked on orders in this period.')}</Empty>}
      {rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>{t('স্টাফ', 'Staff')}</Th>
              <Th className="text-right">{t('অবস্থা বদল', 'Status changes')}</Th>
              <Th className="text-right">{t('দাম পাঠানো', 'Prices sent')}</Th>
              <Th className="text-right">{t('সম্পন্ন', 'Completed')}</Th>
              <Th className="text-right">{t('মোট কাজ', 'Total actions')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <Td>
                  <Link href={`/admin/history?adminId=${encodeURIComponent(row.id)}&entityType=ORDER&from=${from}&to=${to}`} className="font-semibold text-brand-700 hover:underline">
                    {row.name}
                  </Link>
                  <div className="text-xs text-muted">{text(row.role)}</div>
                </Td>
                <Td className="text-right tabular-nums">{digits(row.statusChanges)}</Td>
                <Td className="text-right tabular-nums">{digits(row.quotes)}</Td>
                <Td className="text-right tabular-nums">{digits(row.completed)}</Td>
                <Td className="text-right font-semibold tabular-nums">{digits(row.total)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  )
}

/** The latest history entries, for managers and super admins. */
function RecentActivity() {
  const { t } = useLang()
  const log = useAuditList({ limit: 6 })
  const entries = log.data?.items ?? []
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
