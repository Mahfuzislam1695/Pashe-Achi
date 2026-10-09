'use client'

import type { DashboardDto } from '@/shared'
import { SERVICE_LABELS } from '@/shared'
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

export function StatTile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1.5 text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  )
}

function TableToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  const { t } = useLang()
  return (
    <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" aria-pressed={shown} onClick={onToggle}>
      {shown ? t('চার্ট দেখুন', 'Show chart') : t('টেবিল দেখুন', 'Show table')}
    </button>
  )
}

/**
 * Orders per day: one series, so one hue and no legend (the card title names it). Columns are
 * capped at 24px with a 4px rounded top, square at the baseline, 2px apart. Each column is its
 * own hover/focus target with a tooltip; the busiest day carries a direct label.
 */
export function DailyOrdersChart({ daily, title }: { daily: DashboardDto['daily']; title: string }) {
  const { t, digits, taka, formatDate } = useLang()
  const [active, setActive] = useState<number | null>(null)
  const [showTable, setShowTable] = useState(false)
  const max = niceMax(Math.max(0, ...daily.map(day => day.orders)))
  const peak = daily.reduce((best, day, index) => (day.orders > (daily[best]?.orders ?? -1) ? index : best), 0)
  const labelEvery = Math.ceil(daily.length / 7)

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
              <Th>{t('তারিখ', 'Date')}</Th>
              <Th className="text-right">{t('অর্ডার', 'Orders')}</Th>
              <Th className="text-right">{t('আয়', 'Revenue')}</Th>
            </tr>
          </thead>
          <tbody>
            {daily.map(day => (
              <tr key={day.date}>
                <Td>{formatDate(day.date)}</Td>
                <Td className="text-right tabular-nums">{digits(day.orders)}</Td>
                <Td className="text-right tabular-nums">{taka(day.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="grid grid-cols-[auto_1fr] gap-x-2">
          {/* y-axis: 0, half, max */}
          <div className="relative h-44 text-right text-[10px] text-muted tabular-nums" aria-hidden="true">
            <span className="absolute top-0 right-0 -translate-y-1/2">{digits(max)}</span>
            <span className="absolute top-1/2 right-0 -translate-y-1/2">{digits(max / 2)}</span>
            <span className="absolute right-0 bottom-0 translate-y-1/2">0</span>
          </div>
          <div className="relative h-44" role="img" aria-label={`${title}: ${daily.map(day => `${day.date} ${day.orders}`).join(', ')}`}>
            {/* hairline grid, recessive */}
            {[0, 50, 100].map(position => (
              <div key={position} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${position}%` }} aria-hidden="true" />
            ))}
            <div className="absolute inset-0 flex items-end gap-0.5">
              {daily.map((day, index) => (
                <button
                  key={day.date}
                  type="button"
                  className="group relative flex h-full flex-1 items-end justify-center focus:outline-none"
                  aria-label={`${formatDate(day.date)}: ${day.orders}`}
                  onPointerEnter={() => setActive(index)}
                  onPointerLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={cn('w-full max-w-6 rounded-t-[4px] bg-chart transition-opacity', active !== null && active !== index && 'opacity-60', 'group-focus-visible:outline-2 group-focus-visible:outline-brand-700')}
                    style={{ height: `${(day.orders / max) * 100}%`, minHeight: day.orders ? 2 : 0 }}
                  />
                  {index === peak && day.orders > 0 && active === null && (
                    <span className="absolute text-[10px] font-semibold text-ink tabular-nums" style={{ bottom: `calc(${(day.orders / max) * 100}% + 4px)` }}>
                      {digits(day.orders)}
                    </span>
                  )}
                  {active === index && (
                    <span className="pointer-events-none absolute bottom-full z-10 mb-1 grid min-w-28 gap-0.5 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs shadow-lg">
                      <strong className="text-sm tabular-nums">
                        {digits(day.orders)} {t('অর্ডার', 'orders')}
                      </strong>
                      <span className="text-muted tabular-nums">{taka(day.revenue)}</span>
                      <span className="text-muted">{formatDate(day.date)}</span>
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div />
          <div className="mt-1.5 flex gap-0.5 text-[10px] text-muted" aria-hidden="true">
            {daily.map((day, index) => (
              <span key={day.date} className="flex-1 truncate text-center">
                {index % labelEvery === 0 || index === daily.length - 1 ? formatDate(day.date).replace(/\s?\d{4}$/, '') : ''}
              </span>
            ))}
          </div>
        </div>
      )}
    </figure>
  )
}

/** Revenue per service: horizontal bars, one hue (the category axis names each bar), value at the tip. */
export function RevenueByServiceChart({ rows, title }: { rows: DashboardDto['byService']; title: string }) {
  const { t, text, taka, digits } = useLang()
  const [showTable, setShowTable] = useState(false)
  const max = Math.max(1, ...rows.map(row => row.revenue))

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
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.service}>
                <Td>{text(SERVICE_LABELS[row.service])}</Td>
                <Td className="text-right tabular-nums">{digits(row.orders)}</Td>
                <Td className="text-right tabular-nums">{taka(row.revenue)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <div className="grid gap-2.5">
          {rows.map(row => (
            <div
              key={row.service}
              className="grid grid-cols-[minmax(0,8rem)_1fr] items-center gap-3"
              title={`${text(SERVICE_LABELS[row.service])}: ${taka(row.revenue)} · ${row.orders} ${t('অর্ডার', 'orders')}`}
            >
              <span className="truncate text-sm text-muted">{text(SERVICE_LABELS[row.service])}</span>
              <div className="flex items-center gap-2">
                <span className="h-5 rounded-r-[4px] bg-chart" style={{ width: `${(row.revenue / max) * 85}%`, minWidth: row.revenue ? 2 : 0 }} aria-hidden="true" />
                <span className="shrink-0 text-xs font-semibold tabular-nums">
                  {taka(row.revenue)}
                  <span className="ml-1 font-normal text-muted">· {digits(row.orders)}</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </figure>
  )
}
