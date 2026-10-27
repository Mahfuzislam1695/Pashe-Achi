'use client'

import {
  type AdminOfferDto,
  can,
  FORM_ERROR_PRIORITY,
  isoDateInBd,
  type MessageCode,
  MESSAGES,
  OFFER_STATUSES,
  offerSchema,
  type OfferStatus,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgePercent, ImagePlus, Megaphone, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'

import { ClearFilters, FilterTabs, SearchBox } from '@/admin/components/filters'
import { PermissionGate } from '@/admin/components/permission-gate'
import { Pagination } from '@/admin/components/pagination'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Textarea } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCurrentAdmin, useOffers, useOfferStats } from '@/admin/lib/queries'
import { pick, useUrlFilters } from '@/admin/lib/url-state'
import { cn, errorCode } from '@/admin/lib/utils'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

type Draft = { titleBn: string; titleEn: string; bodyBn: string; bodyEn: string; service: ServiceId | ''; startsOn: string; endsOn: string; isActive: boolean }

const emptyDraft = (): Draft => {
  const today = isoDateInBd()
  return { titleBn: '', titleEn: '', bodyBn: '', bodyEn: '', service: '', startsOn: today, endsOn: today, isActive: true }
}

const draftOf = (offer: AdminOfferDto): Draft => ({
  titleBn: offer.titleBn,
  titleEn: offer.titleEn ?? '',
  bodyBn: offer.bodyBn ?? '',
  bodyEn: offer.bodyEn ?? '',
  service: offer.service ?? '',
  startsOn: offer.startsOn,
  endsOn: offer.endsOn,
  isActive: offer.isActive,
})

/** আজকের অফার: staff post offers with a picture; running ones show in the customer app and on the landing page. */
export default function OffersPage() {
  const { t } = useLang()
  return (
    <PermissionGate permission="offers.view" title={t('আজকের অফার', "Today's offers")}>
      <Offers />
    </PermissionGate>
  )
}

/** What this admin's role allows on offers; each button shows only with its permission. */
export interface OfferRights {
  create: boolean
  edit: boolean
  remove: boolean
  notify: boolean
}

function Offers() {
  const { t } = useLang()
  const admin = useCurrentAdmin()
  const rights: OfferRights = { create: can(admin, 'offers.create'), edit: can(admin, 'offers.edit'), remove: can(admin, 'offers.delete'), notify: can(admin, 'offers.notify') }
  const [editing, setEditing] = useState<AdminOfferDto | 'new' | null>(null)
  return (
    <>
      <PageHeader
        title={t('আজকের অফার', "Today's offers")}
        subtitle={t('ছবিসহ অফার দিন। চলমান অফার গ্রাহকের অ্যাপ ও হোম পেজে দেখা যায়।', 'Post offers with a picture. Running offers show in the customer app and on the home page.')}
        actions={
          rights.create && editing === null ? (
            <Button onClick={() => setEditing('new')}>
              <Plus className="size-4" />
              {t('নতুন অফার', 'New offer')}
            </Button>
          ) : null
        }
      />
      <div className={cn('grid grid-cols-1 items-start gap-5', editing && 'lg:grid-cols-[3fr_2fr]')}>
        {editing && <OfferForm key={editing === 'new' ? 'new' : editing.id} offer={editing === 'new' ? null : editing} canNotify={rights.notify} onDone={() => setEditing(null)} />}
        <Suspense fallback={<Loading />}>
          <OfferList rights={rights} onEdit={setEditing} className={editing ? 'lg:order-first' : undefined} />
        </Suspense>
      </div>
    </>
  )
}

const STATUS_TONES: Record<OfferStatus, 'brand' | 'neutral' | 'danger'> = { running: 'brand', upcoming: 'neutral', ended: 'neutral', off: 'danger' }

/** Status tabs with counts, search and service filters, and the page, all in the URL. */
function OfferList({ rights, onEdit, className }: { rights: OfferRights; onEdit: (offer: AdminOfferDto) => void; className?: string }) {
  const { t, text, formatDate, digits } = useLang()
  const queryClient = useQueryClient()
  const url = useUrlFilters(10)
  const filters = { q: url.get('q'), service: pick(url.get('service'), SERVICE_IDS) }
  const status = pick(url.get('status'), OFFER_STATUSES)
  const offers = useOffers({ ...filters, status, page: url.page, limit: url.limit })
  const stats = useOfferStats(filters)
  const items = offers.data?.items ?? []
  const hasFilters = Object.values(filters).some(Boolean) || !!status
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.offers })
  const statusLabel: Record<OfferStatus, string> = {
    running: t('চলমান', 'Running'),
    upcoming: t('আসন্ন', 'Upcoming'),
    ended: t('শেষ', 'Ended'),
    off: t('বন্ধ', 'Off'),
  }

  const notify = useMutation({
    mutationFn: api.offers.notify,
    onSuccess: ({ sent }) =>
      toast.success(t('নোটিফিকেশন পাঠানো হয়েছে', 'Notification sent'), {
        description: t(`${digits(sent)} জন গ্রাহক পেয়েছেন।`, `${sent} customer${sent === 1 ? '' : 's'} got it.`),
      }),
    onError: failure => toast.error(t('পাঠানো যায়নি', 'Could not send'), { description: text(MESSAGES[errorCode(failure)]) }),
  })
  const remove = useMutation({
    mutationFn: api.offers.remove,
    onSuccess: () => {
      void refresh()
      toast.success(t('অফার মুছে ফেলা হয়েছে', 'Offer deleted'))
    },
  })

  return (
    <Card title={t('সব অফার', 'All offers')} className={className}>
      <div className="mb-3 grid gap-2 sm:grid-cols-[2fr_1fr_auto]">
        <SearchBox value={filters.q} onSearch={q => url.set({ q })} placeholder={t('শিরোনাম', 'Title')} />
        <Select aria-label={t('সেবা', 'Service')} value={filters.service ?? ''} onChange={e => url.set({ service: e.target.value || undefined })}>
          <option value="">{t('সব সেবা', 'All services')}</option>
          {SERVICE_IDS.map(service => (
            <option key={service} value={service}>
              {text(SERVICE_LABELS[service])}
            </option>
          ))}
        </Select>
        <ClearFilters disabled={!hasFilters} onClear={() => url.clear()} />
      </div>
      <FilterTabs
        label={t('অবস্থা', 'Status')}
        value={status}
        onChange={value => url.set({ status: value })}
        items={[
          { value: undefined, label: t('সব', 'All'), count: stats.data?.total },
          ...OFFER_STATUSES.map(value => ({ value, label: statusLabel[value], count: stats.data?.byStatus[value] })),
        ]}
      />
      {offers.isPending && <Loading />}
      <ErrorNote code={offers.isError ? errorCode(offers.error) : remove.isError ? errorCode(remove.error) : null} />
      {offers.isSuccess && !items.length && <Empty>{hasFilters ? t('এই ফিল্টারে কোনো অফার নেই।', 'No offers match these filters.') : t('এখনো কোনো অফার নেই।', 'No offers yet.')}</Empty>}
      <ul className="grid gap-3">
        {items.map(offer => (
          <li key={offer.id} className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 rounded-xl border border-line p-3 sm:grid-cols-[128px_minmax(0,1fr)]">
            <div className="aspect-video overflow-hidden rounded-lg bg-canvas">
              {offer.imageUrl ? (
                <img src={offer.imageUrl} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-muted">
                  <BadgePercent className="size-6" />
                </span>
              )}
            </div>
            <div className="grid min-w-0 content-start gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{offer.titleBn}</span>
                <Badge tone={STATUS_TONES[offer.status]}>{statusLabel[offer.status]}</Badge>
              </div>
              {offer.titleEn && <p className="text-sm text-muted">{offer.titleEn}</p>}
              <p className="text-xs text-muted">
                {offer.startsOn === offer.endsOn ? formatDate(offer.startsOn) : `${formatDate(offer.startsOn)} – ${formatDate(offer.endsOn)}`}
                {offer.service ? ` · ${text(SERVICE_LABELS[offer.service])}` : ''}
              </p>
              {(rights.edit || rights.notify || rights.remove) && (
                <div className="mt-1 flex flex-wrap gap-2">
                  {rights.edit && (
                  <Button size="sm" variant="secondary" onClick={() => onEdit(offer)}>
                    <Pencil className="size-3.5" />
                    {t('এডিট', 'Edit')}
                  </Button>
                  )}
                  {rights.notify && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={offer.status !== 'running' || notify.isPending}
                    title={offer.status === 'running' ? undefined : t('শুধু চলমান অফারের নোটিফিকেশন পাঠানো যায়', 'Only running offers can be sent')}
                    loading={notify.isPending && notify.variables === offer.id}
                    onClick={() => {
                      if (window.confirm(t('সব গ্রাহককে এই অফারের নোটিফিকেশন পাঠাবেন?', 'Send this offer to every customer as a notification?'))) notify.mutate(offer.id)
                    }}
                  >
                    <Megaphone className="size-3.5" />
                    {t('গ্রাহকদের জানান', 'Notify customers')}
                  </Button>
                  )}
                  {rights.remove && (
                  <Button
                    size="sm"
                    variant="danger"
                    loading={remove.isPending && remove.variables === offer.id}
                    onClick={() => {
                      if (window.confirm(t('অফারটি মুছে ফেলবেন?', 'Delete this offer?'))) remove.mutate(offer.id)
                    }}
                  >
                    <Trash2 className="size-3.5" />
                    {t('মুছুন', 'Delete')}
                  </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {offers.data && (
        <Pagination
          page={offers.data.page}
          pageCount={offers.data.pageCount}
          total={offers.data.total}
          limit={offers.data.limit}
          fetching={offers.isPlaceholderData}
          onPage={page => url.set({ page })}
          onLimit={limit => url.set({ limit })}
        />
      )}
    </Card>
  )
}

/** Add or edit an offer. Saving writes the text, then the picture, then (for a new running offer, if ticked) tells every customer. */
function OfferForm({ offer, canNotify, onDone }: { offer: AdminOfferDto | null; canNotify: boolean; onDone: () => void }) {
  const { t, text } = useLang()
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState<Draft>(() => (offer ? draftOf(offer) : emptyDraft()))
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(offer?.imageUrl ?? null)
  const [dropImage, setDropImage] = useState(false)
  const [notify, setNotify] = useState(true)
  const [error, setError] = useState<MessageCode | null>(null)
  // A new offer saved before its picture failed: a retry updates it instead of adding a second one.
  const [savedId, setSavedId] = useState<string | null>(offer?.id ?? null)

  // A chosen file is shown from memory; release it when it is replaced or the form closes.
  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const today = isoDateInBd()
  const runsToday = draft.isActive && draft.startsOn <= today && today <= draft.endsOn
  const edit = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }
  const pick = (chosen: File | undefined) => {
    setError(null)
    if (!chosen) return
    if (!IMAGE_TYPES.includes(chosen.type) || chosen.size > MAX_IMAGE_BYTES) return setError('offer.image')
    setFile(chosen)
    setDropImage(false)
  }

  const save = useMutation({
    mutationFn: async () => {
      const check = validateForm(offerSchema, { ...draft, service: draft.service || null }, FORM_ERROR_PRIORITY.offer)
      if (!check.success) throw check.code
      let saved = savedId ? await api.offers.update(savedId, check.data) : await api.offers.create(check.data)
      setSavedId(saved.id)
      if (file) saved = await api.offers.setImage(saved.id, file)
      else if (dropImage) saved = await api.offers.removeImage(saved.id)
      const sent = !offer && canNotify && notify && saved.status === 'running' ? (await api.offers.notify(saved.id)).sent : null
      return { saved, sent }
    },
    onSuccess: ({ sent }) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers })
      toast.success(offer ? t('অফার আপডেট হয়েছে', 'Offer updated') : t('অফার যোগ হয়েছে', 'Offer added'), {
        description: sent === null ? undefined : t(`${sent} জন গ্রাহককে নোটিফিকেশন পাঠানো হয়েছে।`, `Sent to ${sent} customer${sent === 1 ? '' : 's'}.`),
      })
      onDone()
    },
    onError: failure => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.offers })
      setError(errorCode(failure, FORM_ERROR_PRIORITY.offer))
    },
  })

  return (
    <Card
      title={offer ? t('অফার এডিট', 'Edit offer') : t('নতুন অফার', 'New offer')}
      actions={
        <Button variant="ghost" size="sm" onClick={onDone}>
          <X className="size-4" />
          {t('বন্ধ', 'Close')}
        </Button>
      }
    >
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          save.mutate()
        }}
      >
        <Field label={t('শিরোনাম (বাংলা) *', 'Title (Bangla) *')}>
          <Input value={draft.titleBn} maxLength={120} onChange={e => edit('titleBn', e.target.value)} placeholder="যেমন: আজ সব সবজিতে ১০% ছাড়" />
        </Field>
        <Field label={t('শিরোনাম (ইংরেজি)', 'Title (English)')} hint={t('খালি রাখলে বাংলা দেখানো হবে।', 'Left blank, the Bangla is shown.')}>
          <Input value={draft.titleEn} maxLength={120} onChange={e => edit('titleEn', e.target.value)} placeholder="e.g. 10% off all vegetables today" />
        </Field>
        <Field label={t('বিবরণ (বাংলা)', 'Details (Bangla)')}>
          <Textarea rows={3} maxLength={1000} value={draft.bodyBn} onChange={e => edit('bodyBn', e.target.value)} />
        </Field>
        <Field label={t('বিবরণ (ইংরেজি)', 'Details (English)')}>
          <Textarea rows={3} maxLength={1000} value={draft.bodyEn} onChange={e => edit('bodyEn', e.target.value)} />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={t('সেবা', 'Service')} hint={t('“অর্ডার করুন” বাটন এখানে নেবে।', 'Its “Order now” button opens this.')}>
            <Select value={draft.service} onChange={e => edit('service', e.target.value as ServiceId | '')}>
              <option value="">{t('কোনোটি না', 'None')}</option>
              {SERVICE_IDS.map(service => (
                <option key={service} value={service}>
                  {text(SERVICE_LABELS[service])}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('শুরু', 'Starts')}>
            <Input type="date" value={draft.startsOn} onChange={e => edit('startsOn', e.target.value)} />
          </Field>
          <Field label={t('শেষ', 'Ends')}>
            <Input type="date" value={draft.endsOn} min={draft.startsOn} onChange={e => edit('endsOn', e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={draft.isActive} onChange={e => edit('isActive', e.target.checked)} />
          {t('চালু (বন্ধ করলে গ্রাহকরা দেখবেন না)', 'On (switched off, customers do not see it)')}
        </label>

        <div className="grid gap-2">
          <span className="text-sm font-medium">{t('ছবি', 'Picture')}</span>
          <div className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-3">
            <div className="aspect-video overflow-hidden rounded-lg border border-line bg-canvas">
              {preview && !dropImage ? (
                <img src={preview} alt="" className="size-full object-cover" />
              ) : (
                <span className="grid size-full place-items-center text-muted">
                  <ImagePlus className="size-6" />
                </span>
              )}
            </div>
            <div className="grid gap-2 text-sm">
              <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                <ImagePlus className="size-4" />
                {preview && !dropImage ? t('ছবি বদলান', 'Change picture') : t('ছবি বাছুন', 'Choose picture')}
                <input type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" onChange={e => pick(e.target.files?.[0])} />
              </label>
              {preview && !dropImage && (
                <button
                  type="button"
                  className="w-fit text-left text-xs font-semibold text-danger-ink hover:underline"
                  onClick={() => {
                    setFile(null)
                    setDropImage(true)
                  }}
                >
                  {t('ছবি সরান', 'Remove picture')}
                </button>
              )}
              <span className="text-xs text-muted">{t('JPG, PNG বা WebP, ৫ MB পর্যন্ত। ১৬:৯ মাপের ছবি সবচেয়ে ভালো দেখায়।', 'JPG, PNG or WebP, up to 5 MB. A 16:9 picture looks best.')}</span>
            </div>
          </div>
        </div>

        {!offer && canNotify && (
          <label className={cn('flex items-center gap-2 text-sm', !runsToday && 'text-muted')}>
            <input type="checkbox" className="size-4 accent-brand-600" checked={notify && runsToday} disabled={!runsToday} onChange={e => setNotify(e.target.checked)} />
            {runsToday
              ? t('সেভ করার পর সব গ্রাহককে নোটিফিকেশন পাঠান', 'Send it to every customer as a notification after saving')
              : t('আজ চালু নয়, তাই এখন নোটিফিকেশন পাঠানো যাবে না', 'Not running today, so it cannot be sent now')}
          </label>
        )}

        <ErrorNote code={error} />
        <div className="flex justify-end">
          <Button type="submit" loading={save.isPending}>
            <Save className="size-4" />
            {t('সেভ করুন', 'Save')}
          </Button>
        </div>
      </form>
    </Card>
  )
}
