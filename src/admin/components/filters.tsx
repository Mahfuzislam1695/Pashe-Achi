'use client'

import { addDays, type DayRange, isoDateInBd } from '@/shared'
import { Search, X } from 'lucide-react'
import { useState } from 'react'

import { useLang } from '@/admin/lib/i18n'
import { useDebouncedSearch } from '@/admin/lib/url-state'
import { cn } from '@/admin/lib/utils'
import { Button, Input, Select } from './ui'

/** A search box that reports what was typed 350 ms after typing stops. */
export function SearchBox({ value, onSearch, placeholder, className }: { value: string | undefined; onSearch: (value: string | undefined) => void; placeholder: string; className?: string }) {
  const { t } = useLang()
  const [text, setText] = useDebouncedSearch(value, onSearch)
  return (
    <div className={cn('relative', className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
      <Input type="search" className="pl-9" placeholder={placeholder} aria-label={t('খুঁজুন', 'Search')} value={text} onChange={e => setText(e.target.value)} />
    </div>
  )
}

export type RangePreset = 'any' | 'today' | 'yesterday' | '7' | '30' | '90' | 'month' | 'last_month' | 'year'

/** The days a preset covers, ending today (Bangladesh time). `any` is no range. */
export function presetRange(preset: Exclude<RangePreset, 'any'>, today = isoDateInBd()): DayRange {
  const monthStart = `${today.slice(0, 8)}01`
  switch (preset) {
    case 'today':
      return { from: today, to: today }
    case 'yesterday':
      return { from: addDays(today, -1), to: addDays(today, -1) }
    case '7':
    case '30':
    case '90':
      return { from: addDays(today, -(Number(preset) - 1)), to: today }
    case 'month':
      return { from: monthStart, to: today }
    case 'last_month': {
      const lastMonthEnd = addDays(monthStart, -1)
      return { from: `${lastMonthEnd.slice(0, 8)}01`, to: lastMonthEnd }
    }
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today }
  }
}

export const LIST_PRESETS: RangePreset[] = ['any', 'today', 'yesterday', '7', '30', 'month', 'last_month']

/**
 * A period picker: presets (Today, Last 7 days, This month …) and Custom, which shows two date
 * boxes. A range that matches no preset shows as Custom. `max` stops the boxes at a day (the
 * dashboard: today).
 */
export function DateRangeFilter({
  from,
  to,
  onChange,
  presets = LIST_PRESETS,
  max,
  className,
}: {
  from: string | undefined
  to: string | undefined
  onChange: (range: Partial<DayRange>) => void
  presets?: RangePreset[]
  max?: string
  className?: string
}) {
  const { t, digits } = useLang()
  const labels: Record<RangePreset, string> = {
    any: t('যেকোনো সময়', 'Any time'),
    today: t('আজ', 'Today'),
    yesterday: t('গতকাল', 'Yesterday'),
    '7': t(`শেষ ${digits(7)} দিন`, 'Last 7 days'),
    '30': t(`শেষ ${digits(30)} দিন`, 'Last 30 days'),
    '90': t(`শেষ ${digits(90)} দিন`, 'Last 90 days'),
    month: t('এই মাস', 'This month'),
    last_month: t('গত মাস', 'Last month'),
    year: t('এই বছর', 'This year'),
  }
  const matched = presets.find(preset => {
    if (preset === 'any') return !from && !to
    const range = presetRange(preset)
    return range.from === from && range.to === to
  })
  const [customChosen, setCustomChosen] = useState(false)
  const custom = customChosen || !matched

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <Select
        aria-label={t('সময়কাল', 'Period')}
        className="w-auto min-w-36 flex-1"
        value={custom ? 'custom' : matched}
        onChange={e => {
          const value = e.target.value as RangePreset | 'custom'
          if (value === 'custom') return setCustomChosen(true)
          setCustomChosen(false)
          onChange(value === 'any' ? { from: undefined, to: undefined } : presetRange(value))
        }}
      >
        {presets.map(preset => (
          <option key={preset} value={preset}>
            {labels[preset]}
          </option>
        ))}
        <option value="custom">{t('নির্দিষ্ট তারিখ', 'Custom dates')}</option>
      </Select>
      {custom && (
        <>
          <Input type="date" className="w-auto flex-1" aria-label={t('শুরুর তারিখ', 'From date')} value={from ?? ''} max={to ?? max} onChange={e => onChange({ from: e.target.value || undefined, to })} />
          <Input type="date" className="w-auto flex-1" aria-label={t('শেষ তারিখ', 'To date')} value={to ?? ''} min={from} max={max} onChange={e => onChange({ from, to: e.target.value || undefined })} />
        </>
      )}
    </div>
  )
}

export interface TabItem<T extends string> {
  value: T | undefined
  label: string
  count?: number
}

/** Status tabs over a list, each with its count. The current tab is pressed; they scroll sideways on phones. */
export function FilterTabs<T extends string>({ items, value, onChange, label }: { items: TabItem<T>[]; value: T | undefined; onChange: (value: T | undefined) => void; label: string }) {
  const { digits } = useLang()
  return (
    <div className="-mx-4 mb-3 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label={label}>
      <div className="flex w-max gap-1 rounded-xl bg-canvas p-1">
        {items.map(item => {
          const active = item.value === value
          return (
            <button
              key={item.value ?? 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(item.value)}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-brand-600',
                active ? 'bg-surface text-navy shadow-card' : 'text-muted hover:text-ink',
              )}
            >
              {item.label}
              {item.count !== undefined && (
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-brand-50 text-brand-700' : 'bg-surface/70 text-muted')}>{digits(item.count)}</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The filters in force, each with a button that removes it. */
export function FilterChips({ chips, onRemove }: { chips: { key: string; label: string }[]; onRemove: (key: string) => void }) {
  const { t } = useLang()
  if (!chips.length) return null
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {chips.map(chip => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onRemove(chip.key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset hover:bg-brand-100"
          aria-label={t(`${chip.label} ফিল্টার সরান`, `Remove filter ${chip.label}`)}
        >
          {chip.label}
          <X className="size-3.5" />
        </button>
      ))}
    </div>
  )
}

export function ClearFilters({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
  const { t } = useLang()
  return (
    <Button variant="ghost" disabled={disabled} onClick={onClear}>
      <X className="size-4" />
      {t('মুছুন', 'Clear')}
    </Button>
  )
}
