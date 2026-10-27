'use client'

import type { DashboardDto, OrderStatus } from '@/shared'
import { ORDER_STATUS_LABELS, ORDER_STATUSES, SERVICE_LABELS } from '@/shared'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { useLang } from '@/admin/lib/i18n'
import { cn } from '@/admin/lib/utils'
import { Table, Td, Th } from './ui'

/** Rounds an axis maximum up to 1, 2 or 5 × 10ⁿ so ticks are clean numbers. */
function niceMax(value: number) {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find(multiple => multiple * power >= value) ?? 10
  return step * power
}

const TILE_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  violet: 'bg-violet-soft text-violet',
  danger: 'bg-danger-soft text-danger',
} as const

/**
 * The change against the previous period. `relative` (the default) shows the % change; `points`
 * is for rates (0–1) and shows the difference in percentage points.
 */
export interface Delta {
  current: number
  previous: number
  /** Which way is good news: up for orders and revenue, down for cancellations. */
  betterWhen?: 'up' | 'down'
  kind?: 'relative' | 'points'
  /** The previous period's value, formatted, for the tooltip. */
  previousText?: string
}

function DeltaLine({ delta }: { delta: Delta }) {
  const { t, digits } = useLang()
  const { current, previous, betterWhen = 'up', kind = 'relative' } = delta
  const difference = current - previous
  const change = kind === 'points' ? Math.round(difference * 1000) / 10 : previous ? Math.round((difference / previous) * 100) : null
  const direction = difference === 0 ? 'flat' : difference > 0 ? 'up' : 'down'
  const good = direction !== 'flat' && direction === betterWhen
  const tone = direction === 'flat' ? 'text-muted' : good ? 'text-success-ink' : 'text-danger-ink'
  const amount =
    change === null ? t('নতুন', 'new') : kind === 'points' ? t(`${digits(Math.abs(change))} পয়েন্ট`, `${Math.abs(change)} pts`) : `${digits(Math.abs(change))}%`
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs" title={delta.previousText ? t(`আগের সময়কালে: ${delta.previousText}`, `Previous period: ${delta.previousText}`) : undefined}>
      <span className={cn('font-semibold tabular-nums', tone)}>
        {direction === 'flat' ? t('একই', 'No change') : `${direction === 'up' ? '▲' : '▼'} ${amount}`}
      </span>
      <span className="text-muted">{t('আগের সময়কালের তুলনায়', 'vs previous period')}</span>
    </p>
  )
}

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  delta,
  href,
  active,
  onClick,
}: {
  label: string
  value: string
  hint?: string
  icon?: LucideIcon
  tone?: keyof typeof TILE_TONES
  delta?: Delta
  /** Makes the tile a link (e.g. to the list it counts). */
  href?: string
  /** A tile that is also a filter: pressed while its filter is on. */
  active?: boolean
  onClick?: () => void
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted">{label}</p>
        {Icon && (
          <span className={cn('grid size-9 shrink-0 place-items-center rounded-xl', TILE_TONES[tone])} aria-hidden="true">
            <Icon className="size-4.5" />
          </span>
        )}
      </div>
      <p className="mt-1 text-2xl font-bold text-navy tabular-nums">{value}</p>
      {delta && <DeltaLine delta={delta} />}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </>
  )
  const className = cn(
    'block rounded-2xl border border-line bg-surface p-4 text-left shadow-card',
    (href || onClick) && 'transition-colors hover:border-brand-200 focus-visible:outline-2 focus-visible:outline-brand-600',
    active && 'border-brand-600 ring-1 ring-brand-600',
  )
  if (href)
    return (
      <Link href={href} className={className}>
        {body}
      </Link>
    )
  if (onClick)
    return (
      <button type="button" className={className} onClick={onClick} aria-pressed={active}>
        {body}
      </button>
    )
  return <div className={className}>{body}</div>
}

/** A row of stat tiles: two columns on phones, up to `columns` on wide screens. */
export function StatGrid({ children, columns = 4, className }: { children: React.ReactNode; columns?: 3 | 4 | 5 | 6; className?: string }) {
  const wide = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-3 xl:grid-cols-6' }[columns]
  return <div className={cn('grid grid-cols-2 gap-3', wide, className)}>{children}</div>
}

function TableToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useLang()
  return (
    <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" aria-pressed={shown} onClick={onToggle}>
      {shown ? t('চার্ট দেখুন', 'Show chart') : t('টেবিল দেখুন', 'Show table')}
    </button>
  )
}

/** Short amounts for an axis: 1.2k, 35k, 1.5M. */
const compact = (value: number) => (value >= 1_000_000 ? `${+(value / 1_000_000).toFixed(1)}M` : value >= 1000 ? `${+(value / 1000).toFixed(1)}k` : String(value))

/**
 * Orders or revenue over the period, per day or per week: one series, so one hue and no legend (the
 * card title and the switch name it). Columns are capped at 24px with a 4px rounded top, square at
 * the baseline, 2px apart. Each column is its own hover/focus target with a tooltip; the highest
 * carries a direct label.
 */
export function TrendChart({ series, bucket, title }: { series: DashboardDto['series']; bucket: DashboardDto['bucket']; title: string }) {
  const { t, digits, taka, formatDate } = useLang()
  const [metric, setMetric] = useState<'orders' | 'revenue'>('orders')
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const valueOf = (point: DashboardDto['series'][number]) => (metric === 'orders' ? point.orders : point.revenue)
  const max = niceMax(Math.max(0, ...series.map(valueOf)))
  const peak = series.reduce((best, point, index) => (valueOf(point) > valueOf(series[best] ?? point) ? index : best), 0)
  const labelEvery = Math.ceil(series.length / 7)
  const axis = (value: number) => (metric === 'orders' ? digits(value) : compact(value))
  const when = (date: string) => (bucket === 'week' ? t(`${formatDate(date)} থেকে সপ্তাহ`, `Week of ${formatDate(date)}`) : formatDate(date))

  return (
    <figure className="grid gap-3">
      <figcaption className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-base font-semibold">
          {title}
          <span className="ml-2 text-xs font-normal text-muted">{bucket === 'week' ? t('সাপ্তাহিক', 'per week') : t('দৈনিক', 'per day')}</span>
        </span>
        <span className="flex items-center gap-3">
          <span className="flex rounded-lg bg-canvas p-0.5 text-xs font-semibold" role="group" aria-label={t('কী দেখাবে', 'Show')}>
            {(['orders', 'revenue'] as const).map(option => (
              <button
                key={option}
                type="button"
                aria-pressed={metric === option}
                onClick={() => setMetric(option)}
                className={cn('rounded-md px-2.5 py-1', metric === option ? 'bg-surface text-navy shadow-card' : 'text-muted hover:text-ink')}
              >
                {option === 'orders' ? t('অর্ডার', 'Orders') : t('আয়', 'Revenue')}
              </button>
            ))}
          </span>
          <TableToggle shown={showTable} onToggle={() => setShowTable(!showTable)} />
        </span>
      </figcaption>
      {showTable ? (
        <Table>
          <thead>
            <tr>
              <Th>{bucket === 'week' ? t('সপ্তাহ', 'Week') : t('তারিখ', 'Date')}</Th>
              <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
              <Th className="text-right">{t('আয়', 'Revenue')}</Th>
            </tr>
          </thead>
          <tbody>
            {series.map(point => (
              <tr key={point.date}>
                <Td>{when(point.date)}</Td>
                <Td className="text-right tabular-nums">{digits(point.orders)}</Td>
                <Td className="text-right tabular-nums">{taka(point.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          {/* y-axis: 0, half, max */}
          <div className="relative h-44 min-w-6 text-right text-[10px] text-muted tabular-nums" aria-hidden="true">
            <span className="absolute top-0 right-0 -translate-y-1/2">{axis(max)}</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">{axis(max / 2)}</span>
            <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
          </div>
          <div className="relative h-44" role="img" aria-label={`${title}: ${series.map(point => `${point.date} ${valueOf(point)}`).join(', ')}`}>
            {/* hairline grid, recessive */}
            {[0, 50, 100].map(position => (
              <div key={position} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${position}%` }} aria-hidden="true" />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5">
              {series.map((point, index) => {
                const value = valueOf(point)
                return (
                  <button
                    key={point.date}
                    type="button"
                    className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                    aria-label={`${when(point.date)}: ${digits(point.orders)} ${t('অর্ডার', 'orders')}, ${taka(point.revenue)}`}
                    onPointerEnter={() => setActive(index)}
                    onPointerLeave={() => setActive(null)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  >
                    <span
                      className={cn('w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity', active !== null && active !== index && 'opacity-60', 'group-focus-visible:outline-2 group-focus-visible:outline-brand-700')}
                      style={{ height: `${(value / max) * 100}%`, minHeight: value ? 2 : 0 }}
                    />
                    {index === peak && value > 0 && active === null && (
                      <span className="absolute text-[10px] font-semibold whitespace-nowrap text-ink tabular-nums" style={{ bottom: `calc(${(value / max) * 100}% + 4px)` }}>
                        {metric === 'orders' ? digits(value) : compact(value)}
                      </span>
                    )}
                    {active === index && (
                      <span
                        className={cn(
                          'pointer-events-none absolute bottom-full z-10 mb-1 grid min-w-32 gap-0.5 rounded-xl border border-line bg-surface px-2.5 py-1.5 text-left text-xs shadow-raised',
                          // Keep the tooltip inside the chart at both ends.
                          index < series.length / 4 ? 'left-0' : index > (series.length * 3) / 4 ? 'right-0' : '',
                        )}
                      >
                        <strong className="text-sm tabular-nums">
                          {digits(point.orders)} {t('অর্ডার', 'orders')}
                        </strong>
                        <span className="text-muted tabular-nums">{taka(point.revenue)}</span>
                        <span className="text-muted">{when(point.date)}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
          <div />
          <div className="mt-1.5 flex gap-0.5 text-[10px] text-muted" aria-hidden="true">
            {series.map((point, index) => (
              <span key={point.date} className="flex-1 truncate text-center">
                {index % labelEvery === 0 || index === series.length - 1 ? formatDate(point.date).replace(/\s?[\d০-৯]{4}$/, '') : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  )
}

/** Horizontal bars in one hue, a label on the left and the value at the tip; each row can be a link. */
function BarRows({ rows }: { rows: { key: string; label: string; value: number; display: React.ReactNode; title: string; href?: string }[] }) {
  const max = Math.max(1, ...rows.map(row => row.value))
  return (
    <div className="grid gap-2.5">
      {rows.map(row => {
        const content = (
          <>
            <span className="truncate text-sm text-muted">{row.label}</span>
            <div className="flex items-center gap-2">
              <span className="h-5 rounded-r-[4px] bg-chart" style={{ width: `${(row.value / max) * 80}%`, minWidth: row.value ? 2 : 0 }} aria-hidden="true" />
              <span className="shrink-0 text-xs font-semibold tabular-nums">{row.display}</span>
            </div>
          </>
        )
        const className = 'grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3 rounded-lg'
        return row.href ? (
          <Link key={row.key} href={row.href} title={row.title} className={cn(className, '-mx-1.5 px-1.5 py-0.5 hover:bg-canvas focus-visible:outline-2 focus-visible:outline-brand-600')}>
            {content}
          </Link>
        ) : (
          <div key={row.key} title={row.title} className={className}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

/** Revenue per service, with the number of orders and the average bill. */
export function RevenueByServiceChart({ rows, title, hrefFor }: { rows: DashboardDto['byService']; title: string; hrefFor?: (service: DashboardDto['byService'][number]['service']) => string }) {
  const { t, text, taka, digits } = useLang()
  const [showTable, setShowTable] = useState(false)

  return (
    <figure className="grid gap-3">
      <figcaption className="flex items-center justify-between">
        <span className="text-base font-semibold">{title}</span>
        <TableToggle shown={showTable} onToggle={() => setShowTable(!showTable)} />
      </figcaption>
      {showTable ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('সেবা', 'Service')}</Th>
              <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
              <Th className="text-right">{t('আয়', 'Revenue')}</Th>
              <Th className="text-right">{t('গড় বিল', 'Average bill')}</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.service}>
                <Td>{text(SERVICE_LABELS[row.service])}</Td>
                <Td className="text-right tabular-nums">{digits(row.orders)}</Td>
                <Td className="text-right tabular-nums">{taka(row.revenue)}</Td>
                <Td className="text-right tabular-nums">{taka(row.averageBill)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <BarRows
          rows={rows.map(row => ({
            key: row.service,
            label: text(SERVICE_LABELS[row.service]),
            value: row.revenue,
            href: hrefFor?.(row.service),
            title: `${text(SERVICE_LABELS[row.service])}: ${taka(row.revenue)} · ${digits(row.orders)} ${t('অর্ডার', 'orders')} · ${t('গড়', 'avg')} ${taka(row.averageBill)}`,
            display: (
              <>
                {taka(row.revenue)}
                <span className="ml-1 font-normal text-muted">
                  · {digits(row.orders)} {t('অর্ডার', 'orders')}
                </span>
              </>
            ),
          }))}
        />
      )}
    </figure>
  )
}

/** Orders in the period by status; each row opens the order list with that status. */
export function StatusBreakdownChart({ byStatus, title, hrefFor }: { byStatus: Record<OrderStatus, number>; title: string; hrefFor?: (status: OrderStatus) => string }) {
  const { t, text, digits } = useLang()
  const [showTable, setShowTable] = useState(false)
  const total = ORDER_STATUSES.reduce((sum, status) => sum + byStatus[status], 0)
  const share = (count: number) => (total ? Math.round((count / total) * 100) : 0)

  return (
    <figure className="grid gap-3">
      <figcaption className="flex items-center justify-between">
        <span className="text-base font-semibold">{title}</span>
        <TableToggle shown={showTable} onToggle={() => setShowTable(!showTable)} />
      </figcaption>
      {showTable ? (
        <Table>
          <thead>
            <tr>
              <Th>{t('অবস্থা', 'Status')}</Th>
              <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
              <Th className="text-right">{t('অংশ', 'Share')}</Th>
            </tr>
          </thead>
          <tbody>
            {ORDER_STATUSES.map(status => (
              <tr key={status}>
                <Td>{text(ORDER_STATUS_LABELS[status])}</Td>
                <Td className="text-right tabular-nums">{digits(byStatus[status])}</Td>
                <Td className="text-right tabular-nums">{digits(share(byStatus[status]))}%</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <BarRows
          rows={ORDER_STATUSES.map(status => ({
            key: status,
            label: text(ORDER_STATUS_LABELS[status]),
            value: byStatus[status],
            href: hrefFor?.(status),
            title: `${text(ORDER_STATUS_LABELS[status])}: ${digits(byStatus[status])} (${digits(share(byStatus[status]))}%)`,
            display: (
              <>
                {digits(byStatus[status])}
                <span className="ml-1 font-normal text-muted">· {digits(share(byStatus[status]))}%</span>
              </>
            ),
          }))}
        />
      )}
    </figure>
  )
}
