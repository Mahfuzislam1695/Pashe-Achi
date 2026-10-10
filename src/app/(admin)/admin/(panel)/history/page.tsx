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
  type AuditAction,
  type AuditEntity,
  type ListAuditQuery,
} from '@/shared'
import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

import { AuditFeed } from '@/admin/components/audit-feed'
import { Button, Card, Empty, ErrorNote, Input, Loading, PageHeader, Select } from '@/admin/components/ui'
import { useLang } from '@/admin/lib/i18n'
import { useAuditList, useCurrentAdmin } from '@/admin/lib/queries'
import { canManage, errorCode } from '@/admin/lib/utils'

export default function HistoryPage() {
  const { t } = useLang()
  const me = useCurrentAdmin()
  if (!canManage(me.role)) {
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

const pick = <T extends string>(value: string | null, allowed: readonly T[]) => (value && allowed.includes(value as T) ? (value as T) : undefined)

/** Filters live in the URL, as on the Orders page, so a filtered view can be bookmarked or shared. */
function History() {
  const { t, text } = useLang()
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const entityType = pick<AuditEntity>(params.get('entityType'), AUDIT_ENTITIES)
  const filters: Partial<ListAuditQuery> = {
    entityType,
    action: pick<AuditAction>(params.get('action'), entityType ? AUDIT_ACTIONS_BY_ENTITY[entityType] : AUDIT_ACTIONS),
    actorType: pick<ActorType>(params.get('actorType'), ACTOR_TYPES),
    from: params.get('from') || undefined,
    to: params.get('to') || undefined,
    q: params.get('q') || undefined,
    adminId: params.get('adminId') || undefined,
    customerId: params.get('customerId') || undefined,
    entityId: params.get('entityId') || undefined,
  }
  const [search, setSearch] = useState(filters.q ?? '')
  const log = useAuditList(filters)
  const entries = log.data?.pages.flatMap(page => page.items) ?? []

  const setFilters = (changes: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false })
  }

  // Search as you type, without a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      if ((search.trim() || undefined) !== filters.q) setFilters({ q: search.trim() || undefined })
    }, 350)
    return () => clearTimeout(timer)
  }, [search])

  const hasFilters = Object.values(filters).some(Boolean)
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
      <Card>
        <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1.4fr_1fr_1fr_1fr_auto]">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder={t('নাম, অর্ডার কোড বা নোট', 'Name, order code or note')}
              aria-label={t('খুঁজুন', 'Search')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            aria-label={t('কিসের ইতিহাস', 'Record type')}
            value={entityType ?? ''}
            onChange={e => setFilters({ entityType: e.target.value || undefined, action: undefined })}
          >
            <option value="">{t('সব কিছু', 'Everything')}</option>
            {AUDIT_ENTITIES.map(entity => (
              <option key={entity} value={entity}>
                {text(AUDIT_ENTITY_LABELS[entity])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('কাজ', 'Action')} value={filters.action ?? ''} onChange={e => setFilters({ action: e.target.value || undefined })}>
            <option value="">{t('সব কাজ', 'All actions')}</option>
            {actions.map(action => (
              <option key={action} value={action}>
                {text(AUDIT_ACTION_LABELS[action])}
              </option>
            ))}
          </Select>
          <Select aria-label={t('কে করেছেন', 'Done by')} value={filters.actorType ?? ''} onChange={e => setFilters({ actorType: e.target.value || undefined })}>
            <option value="">{t('সবাই', 'Anyone')}</option>
            {ACTOR_TYPES.map(type => (
              <option key={type} value={type}>
                {text(ACTOR_TYPE_LABELS[type])}
              </option>
            ))}
          </Select>
          <Input type="date" aria-label={t('শুরুর তারিখ', 'From date')} value={filters.from ?? ''} onChange={e => setFilters({ from: e.target.value || undefined })} />
          <Input type="date" aria-label={t('শেষ তারিখ', 'To date')} value={filters.to ?? ''} onChange={e => setFilters({ to: e.target.value || undefined })} />
          <Button
            variant="ghost"
            disabled={!hasFilters}
            onClick={() => {
              setSearch('')
              router.replace(pathname, { scroll: false })
            }}
          >
            <X className="size-4" />
            {t('মুছুন', 'Clear')}
          </Button>
        </div>

        {chips.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {chips.map(chip => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setFilters({ [chip.key]: undefined })}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 ring-inset hover:bg-brand-100"
                aria-label={t(`${chip.label} ফিল্টার সরান`, `Remove filter ${chip.label}`)}
              >
                {chip.label}
                <X className="size-3.5" />
              </button>
            ))}
          </div>
        )}

        {log.isPending && <Loading />}
        <ErrorNote code={log.isError ? errorCode(log.error) : null} />
        {log.isSuccess && !entries.length && (
          <Empty>{hasFilters ? t('এই ফিল্টারে কিছু পাওয়া যায়নি।', 'Nothing matches these filters.') : t('এখনো কোনো ইতিহাস নেই।', 'No history yet.')}</Empty>
        )}
        {entries.length > 0 && <AuditFeed entries={entries} groupByDay />}
        {log.hasNextPage && (
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" loading={log.isFetchingNextPage} onClick={() => void log.fetchNextPage()}>
              {t('আরো দেখুন', 'Load more')}
            </Button>
          </div>
        )}
      </Card>
    </>
  )
}
