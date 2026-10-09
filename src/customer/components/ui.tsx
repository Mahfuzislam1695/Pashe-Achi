'use client'

import {
  APP_INITIAL,
  APP_NAME,
  type CustomerDto,
  type Lang,
  type MessageCode,
  MESSAGES,
  ORDER_STATUS_LABELS,
  type OrderStatus,
  type ServiceId,
  SERVICE_LABELS,
} from '@/shared'
import { Check, MessageCircle, Phone, type LucideIcon } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'
import { useCatalog } from '@/customer/lib/queries'

export function Logo() {
  const { lang } = useLang()
  return (
    <div className="brand">
      <div className="brand-mark">{APP_INITIAL}</div>
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

/** Service screens have no heading: the bottom nav already shows which service is open. */
export function ServiceCard({ id, children }: { id: ServiceId; children: React.ReactNode }) {
  const { text } = useLang()
  return (
    <section className="page-card" aria-label={text(SERVICE_LABELS[id])}>
      {children}
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

/** Chat and Call sit at the bottom centre of every screen. The numbers come from the admin panel's Catalog. */
export function ContactDock({ raised = false }: { raised?: boolean }) {
  const { t } = useLang()
  const support = useCatalog().data?.support
  if (!support) return null
  return (
    <div className={`contact-dock ${raised ? 'raised' : ''}`}>
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
        <dd>{user.location || '—'}</dd>
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

/** Bill lines, a rule, then the total. */
export function BillSummary({ lines, totalLabel, total }: { lines: [string, number][]; totalLabel: string; total: number }) {
  const { taka } = useLang()
  return (
    <div className="bill">
      {lines.map(([label, amount]) => (
        <div className="bill-line" key={label}>
          <span>{label}</span>
          <strong>{amount}</strong>
        </div>
      ))}
      <div className="bill-total">
        <span>{totalLabel}</span>
        <strong>{taka(total)}</strong>
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

export function ConfirmButton({ error, pending, onConfirm }: { error: MessageCode | null; pending?: boolean; onConfirm: () => void }) {
  const { t } = useLang()
  return (
    <div className="confirm">
      <FormError code={error} />
      <button type="button" className="primary-button wide" onClick={onConfirm} disabled={pending} aria-busy={pending}>
        <Check size={17} />
        {pending ? t('অপেক্ষা করুন…', 'Please wait…') : t('অর্ডার নিশ্চিত করুন', 'Confirm order')}
      </button>
    </div>
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
