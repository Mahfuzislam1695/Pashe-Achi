'use client'

import { pageWindow } from '@/shared'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react'
import { useEffect } from 'react'

import { useLang } from '@/admin/lib/i18n'
import { PAGE_SIZES } from '@/admin/lib/url-state'
import { cn } from '@/admin/lib/utils'
import { Select } from './ui'

const pageButton =
  'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:pointer-events-none disabled:opacity-40'

/**
 * "Showing 26–50 of 312", the page buttons (first, previous, numbers with gaps, next, last) and the
 * rows-per-page picker. A page past the end (rows removed, or another filter) moves to the last one.
 */
export function Pagination({
  page,
  pageCount,
  total,
  limit,
  onPage,
  onLimit,
  fetching = false,
  className,
}: {
  page: number
  pageCount: number
  total: number
  limit: number
  onPage: (page: number) => void
  onLimit?: (limit: number) => void
  /** A new page is on its way (the old one stays on screen meanwhile). */
  fetching?: boolean
  className?: string
}) {
  const { t, digits } = useLang()

  useEffect(() => {
    if (total > 0 && page > pageCount) onPage(pageCount)
  }, [total, page, pageCount, onPage])

  if (total === 0) return null
  const first = (page - 1) * limit + 1
  const last = Math.min(total, page * limit)
  const go = (next: number) => {
    onPage(next)
    // Back to the top of the list, which may be far above the buttons.
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className={cn('mt-4 flex flex-wrap items-center justify-between gap-3 text-sm', className)}>
      <p className="flex items-center gap-2 text-muted tabular-nums" aria-live="polite">
        {t(`${digits(total)}টির মধ্যে ${digits(first)}–${digits(last)}`, `Showing ${digits(first)}–${digits(last)} of ${digits(total)}`)}
        {fetching && <Loader2 className="size-3.5 animate-spin" aria-label={t('লোড হচ্ছে', 'Loading')} />}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {onLimit && (
          <label className="flex items-center gap-2 text-xs text-muted">
            {t('প্রতি পাতায়', 'Rows')}
            <Select className="h-8 w-auto py-0 pr-8" value={limit} onChange={e => onLimit(Number(e.target.value))}>
              {PAGE_SIZES.map(size => (
                <option key={size} value={size}>
                  {digits(size)}
                </option>
              ))}
            </Select>
          </label>
        )}
        {pageCount > 1 && (
          <nav aria-label={t('পাতা', 'Pages')} className="flex items-center gap-1">
            <button type="button" className={cn(pageButton, 'hidden text-muted hover:bg-canvas sm:inline-flex')} disabled={page <= 1} onClick={() => go(1)} aria-label={t('প্রথম পাতা', 'First page')}>
              <ChevronsLeft className="size-4" />
            </button>
            <button type="button" className={cn(pageButton, 'text-muted hover:bg-canvas')} disabled={page <= 1} onClick={() => go(page - 1)} aria-label={t('আগের পাতা', 'Previous page')}>
              <ChevronLeft className="size-4" />
            </button>
            {/* Phones get a tighter window (one page either side), wider screens two. */}
            <PageNumbers page={page} pageCount={pageCount} around={1} onPage={go} className="flex sm:hidden" />
            <PageNumbers page={page} pageCount={pageCount} around={2} onPage={go} className="hidden sm:flex" />
            <button type="button" className={cn(pageButton, 'text-muted hover:bg-canvas')} disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label={t('পরের পাতা', 'Next page')}>
              <ChevronRight className="size-4" />
            </button>
            <button
              type="button"
              className={cn(pageButton, 'hidden text-muted hover:bg-canvas sm:inline-flex')}
              disabled={page >= pageCount}
              onClick={() => go(pageCount)}
              aria-label={t('শেষ পাতা', 'Last page')}
            >
              <ChevronsRight className="size-4" />
            </button>
          </nav>
        )}
      </div>
    </div>
  )
}

function PageNumbers({ page, pageCount, around, onPage, className }: { page: number; pageCount: number; around: number; onPage: (page: number) => void; className: string }) {
  const { t, digits } = useLang()
  return (
    <span className={cn('items-center gap-1', className)}>
      {pageWindow(page, pageCount, around).map((number, index) =>
        number === null ? (
          <span key={`gap-${index}`} className="px-1 text-muted" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={number}
            type="button"
            className={cn(pageButton, number === page ? 'bg-brand-600 text-white' : 'text-ink hover:bg-canvas')}
            aria-current={number === page ? 'page' : undefined}
            aria-label={t(`পাতা ${digits(number)}`, `Page ${number}`)}
            onClick={() => number !== page && onPage(number)}
          >
            {digits(number)}
          </button>
        ),
      )}
    </span>
  )
}
