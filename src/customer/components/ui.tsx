'use client'

import {
  APP_LOGO,
  APP_NAME,
  type CustomerDto,
  joinAddress,
  type Lang,
  type MessageCode,
  MESSAGES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type ServiceId,
  SERVICE_LABELS,
} from '@/shared'
import { Check, MessageCircle, Phone, Smartphone, type LucideIcon } from 'lucide-react'
import Link from 'next/link'

import { useLang } from '@/customer/lib/i18n'
import { useCatalog } from '@/customer/lib/queries'

export function Logo() {
  const { lang } = useLang()
  return (
    <div className="brand">
      <img className="brand-mark" src={APP_LOGO} alt="" />
      <div>
        <strong>{APP_NAME[lang]}</strong>
        <small>{APP_NAME[lang === 'bn' ? 'en' : 'bn']}</small>
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  )
}

export function InlineField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="field-row">
      <span>{label}</span>
      {children}
    </label>
  )
}

/** The card for Order history, notifications and Profile (icon + title). */
export function PageCard({ icon: Icon, title, subtitle, children }: { icon: LucideIcon; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="page-card">
      <div className="card-heading">
        <div className="card-heading-icon">
          <Icon size={21} />
        </div>
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

/**
 * Service screens have no heading: the bottom nav (phone) or the top bar (web) already shows which
 * service is open. `summary` (the bill and Confirm) follows the form on a phone and becomes a sticky
 * column beside it on a wide screen.
 */
export function ServiceCard({ id, banner, summary, children }: { id: ServiceId; banner?: React.ReactNode; summary?: React.ReactNode; children: React.ReactNode }) {
  const { text } = useLang()
  return (
    <section className={`page-card service-card svc-${id} ${summary ? 'has-summary' : ''} ${banner ? 'has-banner' : ''}`} aria-label={text(SERVICE_LABELS[id])}>
      {banner}
      <div className="service-main">{children}</div>
      {summary && <div className="service-summary">{summary}</div>}
    </section>
  )
}

export function LangToggle({ lang, onChange, compact = false }: { lang: Lang; onChange: (lang: Lang) => void; compact?: boolean }) {
  return (
    <div className={`lang-toggle ${compact ? 'compact' : ''}`} role="group" aria-label="ভাষা / Language">
      <button type="button" className={lang === 'bn' ? 'active' : ''} aria-pressed={lang === 'bn'} onClick={() => onChange('bn')}>
        {compact ? 'বাং' : 'বাংলা'}
      </button>
      <button type="button" className={lang === 'en' ? 'active' : ''} aria-pressed={lang === 'en'} onClick={() => onChange('en')}>
        {compact ? 'EN' : 'English'}
      </button>
    </div>
  )
}

/**
 * Chat and Call sit at the bottom centre of every screen. The numbers come from the admin panel's
 * Catalog. `appHref` adds an App button before them (the landing page's, to the app download page).
 */
export function ContactDock({ raised = false, appHref }: { raised?: boolean; appHref?: string }) {
  const { t } = useLang()
  const support = useCatalog().data?.support
  if (!support) return null
  return (
    <div className={`contact-dock ${raised ? 'raised' : ''}`}>
      {appHref && (
        <Link className="app" href={appHref} title={t('অ্যাপ ডাউনলোড', 'Get the app')}>
          <Smartphone size={16} />
          App
        </Link>
      )}
      <a className="chat" href={support.whatsapp} target="_blank" rel="noopener noreferrer" title={t('WhatsApp-এ চ্যাট করুন', 'Chat on WhatsApp')}>
        <MessageCircle size={17} />
        Chat
      </a>
      <a className="call" href={`tel:${support.phone}`} title={t('সাপোর্টে কল করুন', 'Call support')}>
        <Phone size={16} />
        Call
      </a>
    </div>
  )
}

/** নাম / মোবা / লোকেশন / point strip, the first thing on every service screen. */
export function CustomerInfo({ user, showPoints = true }: { user: CustomerDto; showPoints?: boolean }) {
  const { t } = useLang()
  return (
    <dl className="customer-info">
      <div>
        <dt>{t('নাম', 'Name')}</dt>
        <dd>{user.name}</dd>
      </div>
      <div>
        <dt>{t('লোকেশন', 'Location')}</dt>
        <dd>{user.location ? joinAddress(user.location) : '—'}</dd>
      </div>
      <div>
        <dt>{t('মোবা', 'Mobile')}</dt>
        <dd>{user.mobile || '—'}</dd>
      </div>
      {showPoints && (
        <div>
          <dt>{t('point', 'Points')}</dt>
          <dd>{user.points}</dd>
        </div>
      )}
    </dl>
  )
}

/** Bill lines, a rule, then the total. A text value (e.g. "price to follow") is shown as it is. */
export function BillSummary({ lines, totalLabel, total }: { lines: [string, number | string][]; totalLabel: string; total: number | string }) {
  const { taka } = useLang()
  return (
    <div className="bill">
      {lines.map(([label, amount]) => (
        <div className="bill-line" key={label}>
          <span>{label}</span>
          <strong className={typeof amount === 'string' ? 'bill-pending' : undefined}>{amount}</strong>
        </div>
      ))}
      <div className="bill-total">
        <span>{totalLabel}</span>
        <strong>{typeof total === 'string' ? total : taka(total)}</strong>
      </div>
    </div>
  )
}

export function FormError({ code }: { code: MessageCode | null }) {
  const { text } = useLang()
  if (!code) return null
  return (
    <p className="form-error" role="alert">
      {text(MESSAGES[code])}
    </p>
  )
}

export function ConfirmButton({ error, pending, onConfirm, label }: { error: MessageCode | null; pending?: boolean; onConfirm: () => void; label?: string }) {
  const { t } = useLang()
  return (
    <div className="confirm">
      <FormError code={error} />
      <button type="button" className="primary-button wide" onClick={onConfirm} disabled={pending} aria-busy={pending}>
        <Check size={17} />
        {pending ? t('অপেক্ষা করুন…', 'Please wait…') : (label ?? t('অর্ডার নিশ্চিত করুন', 'Confirm order'))}
      </button>
    </div>
  )
}

/**
 * Under a bazar, medicine or shifting bill: the customer sends the order, staff send the price (and
 * may adjust the charges shown, e.g. for a long way; for shifting, the vehicle rent by distance), and
 * the order is booked only once the customer confirms it.
 */
export function QuoteNotice({ service }: { service: 'bazar' | 'medicine' | 'shifting' }) {
  const { t } = useLang()
  return (
    <p className="quote-notice">
      {t(
        'অর্ডার পাঠালে আমরা দাম যাচাই করে পুরো বিল জানাব। দাম দেখে আপনি কনফার্ম করলে তবেই অর্ডার বুক হবে।',
        'Send the order and we will check the prices and send you the full bill. It is booked only after you confirm it.',
      )}{' '}
      {service === 'bazar'
        ? t('দূরত্ব বা বাজারের পরিমাণ অনুযায়ী মজুরী ও ডেলিভারী খরচ বদলাতে পারে; বিলে তা দেখতে পাবেন।', 'The shopping fee and delivery charge may change with the distance or the size of the bazar; the bill shows it.')
        : service === 'shifting'
          ? t(
              'গাড়ী ভাড়া Loading ও Unloading Area-র দূরত্ব দেখে ঠিক হবে; লেবার ও ফ্লোরের খরচ উপরের রেটেই।',
              'The vehicle rent depends on the distance between the loading and unloading areas; labour and floors are charged at the rates shown.',
            )
          : t('দূরত্ব অনুযায়ী ডেলিভারী চার্জ বদলাতে পারে; বিলে তা দেখতে পাবেন।', 'The delivery charge may change with the distance; the bill shows it.')}
    </p>
  )
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const { text } = useLang()
  return <span className={`status-pill ${status.toLowerCase()}`}>{text(ORDER_STATUS_LABELS[status])}</span>
}

export function LoadingNote() {
  const { t } = useLang()
  return <p className="empty-note">{t('লোড হচ্ছে…', 'Loading…')}</p>
}
