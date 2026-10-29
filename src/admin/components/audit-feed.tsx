'use client'

import {
  ACTOR_TYPE_LABELS,
  AUDIT_ACTION_LABELS,
  AUDIT_ENTITY_LABELS,
  AUDIT_FIELD_LABELS,
  type AuditAction,
  type AuditChange,
  type AuditLogDto,
  type AuditValue,
  can,
  describeDeliveryHours,
  isPermission,
  isoDateInBd,
  LEGACY_ROLE_NAMES,
  ORDER_STATUSES,
  type OrderStatus,
  parseDeliveryWindows,
  PERMISSION_LABELS,
  PERMISSION_MODULE_LABELS,
  permissionModule,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  type Text,
} from '@/shared'
import {
  ArrowRightLeft,
  BadgePercent,
  Ban,
  CircleCheck,
  ClipboardList,
  Clock,
  DatabaseBackup,
  KeyRound,
  LogIn,
  LogOut,
  type LucideIcon,
  MapPin,
  MapPinOff,
  Megaphone,
  Phone,
  Receipt,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  ShieldPlus,
  ShieldX,
  Smartphone,
  Star,
  Truck,
  UserPen,
  UserPlus,
  UserX,
} from 'lucide-react'
import Link from 'next/link'

import { useLang } from '@/admin/lib/i18n'
import { useCurrentAdmin, useRoles } from '@/admin/lib/queries'
import { cn, fileSize } from '@/admin/lib/utils'
import { Badge, StatusBadge } from './ui'

type Tone = 'brand' | 'neutral' | 'success' | 'danger'

const TONES: Record<Tone, string> = {
  brand: 'bg-brand-50 text-brand-700',
  neutral: 'bg-canvas text-muted',
  success: 'bg-success-soft text-success-ink',
  danger: 'bg-danger-soft text-danger-ink',
}

const ACTION_ICONS: Record<AuditAction, [LucideIcon, Tone]> = {
  CUSTOMER_SIGNED_UP: [UserPlus, 'success'],
  CUSTOMER_PROFILE_UPDATED: [UserPen, 'neutral'],
  CUSTOMER_PASSWORD_CHANGED: [KeyRound, 'neutral'],
  CUSTOMER_LOCATION_ADDED: [MapPin, 'success'],
  CUSTOMER_LOCATION_UPDATED: [MapPin, 'neutral'],
  CUSTOMER_LOCATION_DELETED: [MapPinOff, 'neutral'],
  CUSTOMER_BLOCKED: [Ban, 'danger'],
  CUSTOMER_UNBLOCKED: [CircleCheck, 'success'],
  CUSTOMER_POINTS_CHANGED: [Star, 'brand'],
  CUSTOMER_DELETED: [UserX, 'danger'],
  ORDER_CREATED: [ClipboardList, 'success'],
  ORDER_STATUS_CHANGED: [ArrowRightLeft, 'brand'],
  ORDER_BILL_UPDATED: [Receipt, 'brand'],
  PRICING_UPDATED: [Settings2, 'brand'],
  VEHICLE_CREATED: [Truck, 'success'],
  VEHICLE_UPDATED: [Truck, 'brand'],
  SUPPORT_UPDATED: [Phone, 'brand'],
  STAFF_CREATED: [ShieldCheck, 'success'],
  STAFF_UPDATED: [ShieldCheck, 'brand'],
  STAFF_PASSWORD_RESET: [KeyRound, 'brand'],
  ADMIN_SIGNED_IN: [LogIn, 'neutral'],
  ADMIN_SIGN_IN_FAILED: [ShieldAlert, 'danger'],
  ADMIN_SIGNED_OUT: [LogOut, 'neutral'],
  ADMIN_PASSWORD_CHANGED: [KeyRound, 'neutral'],
  ANNOUNCEMENT_SENT: [Megaphone, 'brand'],
  DELIVERY_HOURS_UPDATED: [Clock, 'brand'],
  CUSTOMER_AUTH_UPDATED: [KeyRound, 'brand'],
  OFFER_CREATED: [BadgePercent, 'success'],
  OFFER_UPDATED: [BadgePercent, 'brand'],
  OFFER_DELETED: [BadgePercent, 'danger'],
  OFFER_ANNOUNCED: [Megaphone, 'brand'],
  ROLE_CREATED: [ShieldPlus, 'success'],
  ROLE_UPDATED: [ShieldCheck, 'brand'],
  ROLE_DELETED: [ShieldX, 'danger'],
  SYSTEM_BACKUP_DOWNLOADED: [DatabaseBackup, 'brand'],
  APK_UPLOADED: [Smartphone, 'success'],
  APK_REMOVED: [Smartphone, 'danger'],
}

const MONEY_FIELDS = new Set([
  'bazarShoppingFee',
  'bazarDeliveryFee',
  'medicineDeliveryFee',
  'parcelDeliveryFee',
  'wagePerLabourer',
  'loadingRatePerFloor',
  'unloadingRatePerFloor',
  'rate',
  'item.price',
  'item.added',
  'item.removed',
  'serviceFee',
  'deliveryFee',
  'total',
])

/** Delivery hours, stored as "08:00-10:00,18:00-21:00" (empty: any time). */
const HOURS_FIELDS = new Set(SERVICE_IDS.map(service => `${service}Hours`))

const isStatus = (value: AuditValue): value is OrderStatus => ORDER_STATUSES.includes(value as OrderStatus)
const isService = (value: AuditValue): value is ServiceId => SERVICE_IDS.includes(value as ServiceId)

/** "Chrome · Windows" from a user agent, or null when it says nothing useful. */
function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null
  const browser = /Edg\//.test(userAgent)
    ? 'Edge'
    : /OPR\//.test(userAgent)
      ? 'Opera'
      : /Chrome\//.test(userAgent)
        ? 'Chrome'
        : /Firefox\//.test(userAgent)
          ? 'Firefox'
          : /Safari\//.test(userAgent)
            ? 'Safari'
            : /Dart|okhttp|CFNetwork/i.test(userAgent)
              ? 'App'
              : null
  const os = /Android/.test(userAgent)
    ? 'Android'
    : /iPhone|iPad/.test(userAgent)
      ? 'iOS'
      : /Windows/.test(userAgent)
        ? 'Windows'
        : /Mac OS X/.test(userAgent)
          ? 'macOS'
          : /Linux/.test(userAgent)
            ? 'Linux'
            : null
  return [browser, os].filter(Boolean).join(' · ') || null
}

/**
 * The history log as a list: what happened, to which record, who did it and when, with each
 * changed field as "before → after". Used by the History page, order and customer pages and the dashboard.
 */
export function AuditFeed({ entries, groupByDay = false, showEntity = true }: { entries: AuditLogDto[]; groupByDay?: boolean; showEntity?: boolean }) {
  const { t, formatDate } = useLang()
  if (!groupByDay) {
    return (
      <ol className="divide-y divide-line">
        {entries.map(entry => (
          <AuditEntry key={entry.id} entry={entry} showEntity={showEntity} />
        ))}
      </ol>
    )
  }

  const today = isoDateInBd()
  const yesterday = isoDateInBd(new Date(Date.now() - 24 * 60 * 60 * 1000))
  const days: { day: string; entries: AuditLogDto[] }[] = []
  for (const entry of entries) {
    const day = isoDateInBd(new Date(entry.createdAt))
    const last = days[days.length - 1]
    if (last?.day === day) last.entries.push(entry)
    else days.push({ day, entries: [entry] })
  }
  return (
    <div className="grid gap-2">
      {days.map(({ day, entries: dayEntries }) => (
        <section key={day} aria-label={formatDate(day)}>
          <h3 className="sticky top-14 z-10 -mx-1 border-b border-line bg-surface/95 px-1 py-2 text-xs font-semibold text-muted backdrop-blur">
            {day === today ? t('আজ', 'Today') : day === yesterday ? t('গতকাল', 'Yesterday') : formatDate(day)}
          </h3>
          <ol className="divide-y divide-line">
            {dayEntries.map(entry => (
              <AuditEntry key={entry.id} entry={entry} showEntity={showEntity} timeOnly />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function AuditEntry({ entry, showEntity, timeOnly = false }: { entry: AuditLogDto; showEntity: boolean; timeOnly?: boolean }) {
  const { t, text, lang, formatDate } = useLang()
  const [Icon, tone] = ACTION_ICONS[entry.action]
  const device = describeDevice(entry.userAgent)
  const time = timeOnly
    ? new Date(entry.createdAt).toLocaleTimeString(lang === 'bn' ? 'bn-BD' : 'en-GB', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' })
    : formatDate(entry.createdAt, true)
  const statusChange = entry.action === 'ORDER_STATUS_CHANGED' ? entry.changes.find(change => change.field === 'status') : undefined
  // An announcement keeps its English body as the note and the Bangla one in meta.
  const note = entry.action === 'ANNOUNCEMENT_SENT' && lang === 'bn' && typeof entry.meta.bodyBn === 'string' ? entry.meta.bodyBn : entry.note

  return (
    <li className="flex gap-3 py-3">
      <span className={cn('mt-0.5 grid size-8 shrink-0 place-items-center rounded-full', TONES[tone])} aria-hidden="true">
        <Icon className="size-4" />
      </span>
      <div className="grid min-w-0 flex-1 gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className="min-w-0 text-sm">
            <strong className="font-semibold">{text(AUDIT_ACTION_LABELS[entry.action])}</strong>
            {showEntity && <EntityRef entry={entry} />}
          </p>
          <time dateTime={entry.createdAt} className="shrink-0 text-xs text-muted tabular-nums">
            {time}
          </time>
        </div>

        <ActorLine entry={entry} device={device} />

        {statusChange ? (
          <p className="flex flex-wrap items-center gap-1.5 text-sm">
            <Value change={statusChange} value={statusChange.from} />
            <span className="text-muted" aria-hidden="true">
              →
            </span>
            <span className="sr-only">{t('থেকে', 'to')}</span>
            <Value change={statusChange} value={statusChange.to} />
          </p>
        ) : (
          entry.changes.length > 0 && <Changes changes={entry.changes} />
        )}

        <MetaLine entry={entry} />

        {note && <p className="rounded-lg bg-canvas px-3 py-2 text-sm whitespace-pre-line">{note}</p>}
      </div>
    </li>
  )
}

function EntityRef({ entry }: { entry: AuditLogDto }) {
  const { text, lang } = useLang()
  const me = useCurrentAdmin()
  const { type, id } = entry.entity
  // An announcement's label is its English title; Bangla readers get the Bangla title.
  const label =
    type === 'ANNOUNCEMENT' && lang === 'bn' && typeof entry.meta.titleBn === 'string' ? entry.meta.titleBn : (entry.entity.label ?? text(AUDIT_ENTITY_LABELS[type]))
  const href =
    type === 'ORDER' && id
      ? `/admin/orders/${id}`
      : type === 'CUSTOMER' && id
        ? `/admin/customers/${id}`
        : type === 'STAFF' && can(me, 'staff.view')
          ? '/admin/staff'
          : type === 'PRICING' || type === 'VEHICLE' || type === 'SUPPORT' || type === 'DELIVERY_HOURS'
            ? '/admin/catalog'
            : type === 'OFFER'
              ? '/admin/offers'
              : type === 'ROLE' && can(me, 'roles.view')
                ? '/admin/roles'
                : type === 'SYSTEM' && can(me, 'system.view')
                  ? '/admin/system'
                  : null
  return (
    <>
      <span className="text-muted"> · </span>
      {href ? (
        <Link href={href} className="font-medium text-brand-700 hover:underline">
          {label}
        </Link>
      ) : (
        <span className="font-medium">{label}</span>
      )}
    </>
  )
}

function ActorLine({ entry, device }: { entry: AuditLogDto; device: string | null }) {
  const { t, text } = useLang()
  const { actor } = entry
  const name =
    actor.type === 'CUSTOMER' && actor.id ? (
      <Link href={`/admin/customers/${actor.id}`} className="font-medium text-ink hover:underline">
        {actor.name}
      </Link>
    ) : (
      <span className="font-medium text-ink">{actor.type === 'SYSTEM' ? t('সিস্টেম', 'System') : actor.name}</span>
    )
  const extra = [device, entry.ip].filter(Boolean).join(' · ')
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted">
      {name}
      {actor.role ? <RoleBadge role={actor.role} /> : actor.type !== 'SYSTEM' && <Badge>{text(ACTOR_TYPE_LABELS[actor.type])}</Badge>}
      {extra && (
        <span title={entry.userAgent ?? undefined} className="tabular-nums">
          {extra}
        </span>
      )}
    </p>
  )
}

/** The role the admin had when they acted. */
function RoleBadge({ role }: { role: Text }) {
  const { text } = useLang()
  return <Badge tone="brand">{text(role)}</Badge>
}

/** Field: before → after. For a new record (nothing before), just Field: value. */
function Changes({ changes }: { changes: AuditChange[] }) {
  const { t, text } = useLang()
  return (
    <ul className="grid gap-1 text-sm">
      {changes.map((change, index) => {
        const fieldLabel = AUDIT_FIELD_LABELS[change.field]
        return (
          <li key={`${change.field}-${index}`} className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <span className="text-muted">{change.label ?? (fieldLabel ? text(fieldLabel) : change.field)}:</span>
            {change.from !== null && (
              <>
                <Value change={change} value={change.from} muted />
                <span className="text-muted" aria-hidden="true">
                  →
                </span>
                <span className="sr-only">{t('থেকে', 'to')}</span>
              </>
            )}
            <Value change={change} value={change.to} />
          </li>
        )
      })}
    </ul>
  )
}

function Value({ change, value, muted = false }: { change: AuditChange; value: AuditValue; muted?: boolean }) {
  const { t, text, taka, digits } = useLang()
  const roles = useRoles().data
  // Staff entries name the role in English as it was: the old fixed roles by key, and roles that still exist in the reader's language.
  const roleText = (name: string) => LEGACY_ROLE_NAMES[name] ?? roles?.find(role => role.name.en === name)?.name
  if (change.field === 'status' && isStatus(value)) return <StatusBadge status={value} />
  const hours = HOURS_FIELDS.has(change.field) && typeof value === 'string' ? parseDeliveryWindows(value) : null
  const shown = hours
    ? hours.length
      ? text(describeDeliveryHours(hours))
      : t('যেকোনো সময়', 'Any time')
    : value === null || value === ''
      ? '—'
      : MONEY_FIELDS.has(change.field) && typeof value === 'number'
        ? taka(value)
        : change.field === 'service' && isService(value)
          ? text(SERVICE_LABELS[value])
          : change.field === 'image'
            ? value === 'removed'
              ? t('মুছে ফেলা হয়েছে', 'Removed')
              : value === 'replaced'
                ? t('বদলানো হয়েছে', 'Replaced')
                : t('যোগ করা হয়েছে', 'Added')
        : change.field === 'isBlocked'
          ? value
            ? t('বন্ধ', 'Blocked')
            : t('চালু', 'Active')
          : change.field === 'isActive'
            ? value
              ? t('চালু', 'Active')
              : t('বন্ধ', 'Off')
            : change.field === 'role' && typeof value === 'string'
              ? text(roleText(value) ?? { bn: value, en: value })
              : (change.field === 'permission.added' || change.field === 'permission.removed') && isPermission(value)
                ? `${text(PERMISSION_MODULE_LABELS[permissionModule(value)])} · ${text(PERMISSION_LABELS[value].label)}`
              : change.field === 'lang'
                ? value === 'bn'
                  ? 'বাংলা'
                  : 'English'
                : typeof value === 'number'
                  ? digits(value)
                  : typeof value === 'boolean'
                    ? value
                      ? t('হ্যাঁ', 'Yes')
                      : t('না', 'No')
                    : value
  return <span className={cn('tabular-nums', muted ? 'text-muted line-through decoration-muted/50' : 'font-medium')}>{shown}</span>
}

/** Facts some actions carry: the order's service and total, how many got an announcement, why a sign-in failed. */
function MetaLine({ entry }: { entry: AuditLogDto }) {
  const { t, text, taka, digits } = useLang()
  const { meta } = entry
  let line: string | null = null
  if (entry.action === 'ORDER_CREATED' && isService(meta.service ?? null)) {
    line = [text(SERVICE_LABELS[meta.service as ServiceId]), typeof meta.total === 'number' ? taka(meta.total) : null].filter(Boolean).join(' · ')
  } else if ((entry.action === 'ANNOUNCEMENT_SENT' || entry.action === 'OFFER_ANNOUNCED') && typeof meta.sent === 'number') {
    line = t(`${digits(meta.sent)} জন গ্রাহক পেয়েছেন`, `Sent to ${meta.sent} customer${meta.sent === 1 ? '' : 's'}`)
  } else if (entry.action === 'ADMIN_SIGN_IN_FAILED') {
    line =
      meta.reason === 'unknown_mobile'
        ? t('এই নম্বরে কোনো অ্যাকাউন্ট নেই', 'No account with this number')
        : meta.reason === 'wrong_password'
          ? t('ভুল পাসওয়ার্ড', 'Wrong password')
          : meta.reason === 'inactive'
            ? t('অ্যাকাউন্ট বন্ধ', 'Account disabled')
            : null
  } else if (entry.entity.type === 'SYSTEM' && typeof meta.size === 'number') {
    line = [typeof meta.version === 'string' ? t(`ভার্সন ${meta.version}`, `Version ${meta.version}`) : null, fileSize(meta.size)].filter(Boolean).join(' · ')
  }
  return line ? <p className="text-sm text-muted">{line}</p> : null
}
