'use client'

import { ORDER_STATUS_LABELS, type OrderStatus } from '@/shared'
import { Check, ReceiptText, Route } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'
import { useCatalog } from '@/customer/lib/queries'

// Product previews for the landing page and the web login. They show what the app does: the
// tracker is an illustration of the status steps, and the bill uses the live catalog prices.

const TRACKER_STEPS: OrderStatus[] = ['PENDING', 'BOOKED', 'IN_PROGRESS', 'COMPLETED']

/** The four status steps, `current` being the one in progress. Illustrative: no real order. */
export function OrderTrackerCard({ current = 2, className = '' }: { current?: number; className?: string }) {
  const { t, text } = useLang()
  return (
    <div className={`showcase-card tracker-card ${className}`} aria-hidden="true">
      <div className="showcase-card-head">
        <span className="showcase-card-icon tone-violet">
          <Route size={16} />
        </span>
        <strong>{t('অর্ডার ট্র্যাকিং', 'Order tracking')}</strong>
      </div>
      <ol className="tracker-steps">
        {TRACKER_STEPS.map((status, index) => (
          <li key={status} className={index < current ? 'done' : index === current ? 'current' : ''}>
            <span className="tracker-dot">{index < current && <Check size={11} strokeWidth={3} />}</span>
            {text(ORDER_STATUS_LABELS[status])}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** The bazar service charges from the live catalog. Nothing renders until the catalog loads. */
export function BillPreviewCard({ className = '' }: { className?: string }) {
  const { t, taka } = useLang()
  const pricing = useCatalog().data?.pricing
  if (!pricing) return null
  const lines: [string, number][] = [
    [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), pricing.bazarShoppingFee],
    [t('ডেলিভারী খরচ', 'Delivery charge'), pricing.bazarDeliveryFee],
  ]
  return (
    <div className={`showcase-card bill-card ${className}`} aria-hidden="true">
      <div className="showcase-card-head">
        <span className="showcase-card-icon tone-green">
          <ReceiptText size={16} />
        </span>
        <strong>{t('কাঁচা বাজার', 'Fresh market')}</strong>
      </div>
      <dl>
        {lines.map(([label, amount]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{taka(amount)}</dd>
          </div>
        ))}
        <div className="bill-card-total">
          <dt>{t('সেবা খরচ মোট', 'Service total')}</dt>
          <dd>{taka(pricing.bazarShoppingFee + pricing.bazarDeliveryFee)}</dd>
        </div>
      </dl>
    </div>
  )
}

/** The headline split at its dash: the second half is highlighted with a hand-drawn underline. */
export function SplitHeadline({ text, as: Tag = 'h1' }: { text: string; as?: 'h1' | 'h2' }) {
  const [first, second] = text.split(/\s+[–-]\s+/)
  if (!second) return <Tag>{text}</Tag>
  return (
    <Tag>
      <span className="headline-first">{first}</span>{' '}
      <span className="headline-mark">
        {second}
        <svg viewBox="0 0 300 16" preserveAspectRatio="none" aria-hidden="true">
          <path d="M3 11c48-6 98-8 148-6 50 1 98 3 146-3" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
      </span>
    </Tag>
  )
}
