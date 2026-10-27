'use client'

import {
  ACTOR_TYPE_LABELS,
  ACTOR_TYPES,
  type ActorType,
  AUDIT_ACTION_LABELS,
  AUDIT_ACTIONS,
  AUDIT_ACTIONS_BY_ENTITY,
  AUDIT_ENTITIES,
  AUDIT_ENTITY_LABELS,
  can,
  type AuditAction,
  type AuditEntity,
  type ListAuditQuery,
} from '@/shared'
import { Cpu, History as HistoryIcon, ShieldCheck, User } from 'lucide-react'
import { Suspense } from 'react'

import { AuditFeed } from '@/admin/components/audit-feed'
import { StatGrid, StatTile } from '@/admin/components/charts'
import { ClearFilters, DateRangeFilter, FilterChips, SearchBox } from '@/admin/components/filters'
import { Pagination } from '@/admin/components/pagination'
import { Card, Empty, ErrorNote, Loading, PageHeader, Select } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useAuditList, useAuditStats, useCurrentAdmin } from '@/admin/lib/queries'
import { pick, pickDay, useUrlFilters } from '@/admin/lib/url-state'
import { errorCode } from '@/admin/lib/utils'

export default function HistoryPage() {
  const { t } = useLang()
  const me = useCurrentAdmin()
  if (!can(me, 'history.view')) {
    return (
      <>
        <PageHeader title={t('ইতিহাস', 'History')} />
        <ErrorNote code="forbidden" />
      </>
    )
  }
  return (
    <Suspense fallback={<Loading />}>
      <History />
    </Suspense>
  )
}

const ACTOR_ICONS = { ADMIN: ShieldCheck, CUSTOMER: User, SYSTEM: Cpu } as const
const ACTOR_TONES = { ADMIN: 'brand', CUSTOMER: 'violet', SYSTEM: 'warning' } as const

/** Filters and page live in the URL, as on the Orders page, so a filtered view can be bookmarked or shared. */
function History() {
  const { t, text, digits } = useLang()
  const url = useUrlFilters()
  const entityType = pick<AuditEntity>(url.get('entityType'), AUDIT_ENTITIES)
  const filters = {
    entityType,
    action: pick<AuditAction>(url.get('action'), entityType ? AUDIT_ACTIONS_BY_ENTITY[entityType] : AUDIT_ACTIONS),
    from: pickDay(url.get('from')),
    to: pickDay(url.get('to')),
    q: url.get('q'),
    adminId: url.get('adminId'),
    customerId: url.get('customerId'),
    entityId: url.get('entityId'),
  }
  const actorType = pick<ActorType>(url.get('actorType'), ACTOR_TYPES)
  const query: Partial<ListAuditQuery> = { ...filters, actorType, page: url.page, limit: url.limit }
  const log = useAuditList(query)
  const stats = useAuditStats(filters)
  const entries = log.data?.items ?? []

  const hasFilters = Object.values({ ...filters, actorType }).some(Boolean)
  // Names for the person filters, taken from the entries they found.
  const adminName = filters.adminId ? entries.find(entry => entry.actor.type === 'ADMIN' && entry.actor.id === filters.adminId)?.actor.name : undefined
  const customerName = filters.customerId
    ? (entries.find(entry => entry.actor.type === 'CUSTOMER' && entry.actor.id === filters.customerId)?.actor.name ??
      entries.find(entry => entry.entity.type === 'CUSTOMER' && entry.entity.id === filters.customerId)?.entity.label)
    : undefined
  const chips = [
    filters.adminId && { key: 'adminId', label: t(`স্টাফ: ${adminName ?? '…'}`, `Staff: ${adminName ?? '…'}`) },
    filters.customerId && { key: 'customerId', label: t(`গ্রাহক: ${customerName ?? '…'}`, `Customer: ${customerName ?? '…'}`) },
    filters.entityId && { key: 'entityId', label: t('একটি রেকর্ড', 'One record') },
  ].filter(Boolean) as { key: string; label: string }[]
  const actions = entityType ? AUDIT_ACTIONS_BY_ENTITY[entityType] : AUDIT_ACTIONS

  return (
    <>
      <PageHeader
        title={t('ইতিহাস', 'History')}
        subtitle={t('কে, কখন, কী বদলেছেন: অর্ডার, দাম, গ্রাহক, স্টাফ ও সাইন ইন।', 'Who changed what, and when: orders, pricing, customers, staff and sign-ins.')}
      />
      {stats.data && (
        <StatGrid className="mb-5">
          <StatTile icon={HistoryIcon} label={t('মোট', 'Entries')} value={digits(stats.data.total)} hint={hasFilters ? t('এই ফিল্টারে', 'Matching the filters') : undefined} />
          {ACTOR_TYPES.map(type => (
            <StatTile
              key={type}
              icon={ACTOR_ICONS[type]}
              tone={ACTOR_TONES[type]}
              label={t(`করেছেন: ${text(ACTOR_TYPE_LABELS[type])}`, `By ${text(ACTOR_TYPE_LABELS[type]).toLowerCase()}`)}
              value={digits(stats.data.byActorType[type])}
              active={actorType === type}
              onClick={() => url.set({ actorType: actorType === type ? undefined : type })}
            />
          ))}
        </StatGrid>
      )}
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_1fr_auto]">
          <SearchBox className="sm:col-span-2 lg:col-span-1" value={filters.q} onSearch={q => url.set({ q })} placeholder={t('নাম, অর্ডার কোড বা নোট', 'Name, order code or note')} />
          <Select aria-label={t('কিসের ইতিহাস', 'Record type')} value={entityType ?? ''} onChange={e => url.set({ entityType: e.target.value || undefined, action: undefined })}>
            <option value="">{t('সব কিছু', 'Everything')}</option>
            {AUDIT_ENTITIES.map(entity => (
              <option key={entity} value={entity}>
                {text(AUDIT_ENTITY_LABELS[entity])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('কাজ', 'Action')} value={filters.action ?? ''} onChange={e => url.set({ action: e.target.value || undefined })}>
            <option value="">{t('সব কাজ', 'All actions')}</option>
            {actions.map(action => (
              <option key={action} value={action}>
                {text(AUDIT_ACTION_LABELS[action])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('কে করেছেন', 'Done by')} value={actorType ?? ''} onChange={e => url.set({ actorType: e.target.value || undefined })}>
            <option value="">{t('সবাই', 'Anyone')}</option>
            {ACTOR_TYPES.map(type => (
              <option key={type} value={type}>
                {text(ACTOR_TYPE_LABELS[type])}
              </option>
            ))}
          </Select>
          <ClearFilters disabled={!hasFilters} onClear={() => url.clear()} />
          <DateRangeFilter className="sm:col-span-2 lg:col-span-5" from={filters.from} to={filters.to} onChange={range => url.set({ from: range.from, to: range.to })} />
        </div>

        <FilterChips chips={chips} onRemove={key => url.set({ [key]: undefined })} />

        {log.isPending && <Loading />}
        <ErrorNote code={log.isError ? errorCode(log.error) : null} />
        {log.isSuccess && !entries.length && (
          <Empty>{hasFilters ? t('এই ফিল্টারে কিছু পাওয়া যায়নি।', 'Nothing matches these filters.') : t('এখনো কোনো ইতিহাস নেই।', 'No history yet.')}</Empty>
        )}
        {entries.length > 0 && <AuditFeed entries={entries} groupByDay />}
        {log.data && (
          <Pagination
            page={log.data.page}
            pageCount={log.data.pageCount}
            total={log.data.total}
            limit={log.data.limit}
            fetching={log.isPlaceholderData}
            onPage={page => url.set({ page })}
            onLimit={limit => url.set({ limit })}
          />
        )}
      </Card>
    </>
  )
}
