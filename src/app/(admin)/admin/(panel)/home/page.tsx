'use client'

import {
  type AdminHomeBannerDto,
  type AdminHomeCategoryDto,
  type AdminHomeDto,
  can,
  HOME_BANNER_TARGETS,
  HOME_SECTIONS,
  HOME_TONE_LABELS,
  HOME_TONES,
  type HomeBannerTarget,
  homeBannerSchema,
  homeCategorySchema,
  type HomeSectionId,
  homeSectionsSchema,
  type HomeTone,
  type MessageCode,
  MESSAGES,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  validateForm,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Eye, EyeOff, ImagePlus, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { PermissionGate } from '@/admin/components/permission-gate'
import { Badge, Button, Card, Empty, ErrorNote, Field, Input, Loading, PageHeader, Select, Textarea } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useAdminHome, useCurrentAdmin } from '@/admin/lib/queries'
import { cn, errorCode } from '@/admin/lib/utils'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
type Kind = 'banners' | 'categories'

/** The tile colours as the customer site draws them (the admin theme has its own tokens). */
const TONE_SWATCH: Record<HomeTone, string> = {
  blue: 'bg-brand-600',
  coral: 'bg-coral',
  green: 'bg-success',
  orange: 'bg-accent',
  violet: 'bg-violet',
  neutral: 'bg-muted',
}

/** The customer home page: banners, categories, service pictures and sections. */
export default function HomePageAdmin() {
  const { t } = useLang()
  return (
    <PermissionGate permission="home.view" title={t('হোম পেজ', 'Home page')}>
      <HomeEditor />
    </PermissionGate>
  )
}

function HomeEditor() {
  const { t } = useLang()
  const admin = useCurrentAdmin()
  const home = useAdminHome()
  const canEdit = !!admin && can(admin, 'home.edit')

  return (
    <div className="grid gap-5">
      <PageHeader title={t('হোম পেজ', 'Home page')} subtitle={t('গ্রাহক লগইন করে যে পেজ প্রথম দেখেন। বদলালে পরের বার পেজ খুললেই দেখা যাবে।', 'The page customers see first after signing in. Changes show the next time the page opens.')} />
      {home.isPending && <Loading />}
      {home.isError && <ErrorNote code={errorCode(home.error)} />}
      {home.data && (
        <>
          <Banners rows={home.data.banners} canEdit={canEdit} />
          <Categories rows={home.data.categories} canEdit={canEdit} />
          <ServicePictures images={home.data.serviceImages} canEdit={canEdit} />
          <Sections sections={home.data.sections} canEdit={canEdit} />
        </>
      )}
    </div>
  )
}

/** Refreshes the page's data after any change. */
function useRefresh() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.home })
}

/** A row in the banner or category list: its picture, words, and move, show/hide, edit and delete. */
function RowControls({ kind, rowIds, id, label, isActive, canEdit, onEdit, onToggle }: { kind: Kind; rowIds: string[]; id: string; label: string; isActive: boolean; canEdit: boolean; onEdit: () => void; onToggle: () => Promise<unknown> }) {
  const { t, text } = useLang()
  const refresh = useRefresh()
  const index = rowIds.indexOf(id)
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => refresh(),
    onError: failure => {
      void refresh()
      toast.error(text(MESSAGES[errorCode(failure)]))
    },
  })
  const move = (by: number) => {
    const next = [...rowIds]
    next.splice(index, 1)
    next.splice(index + by, 0, id)
    act.mutate(() => api.home.reorder(kind, next))
  }
  if (!canEdit) return null
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1">
      <Button variant="ghost" size="sm" aria-label={t(`${label} উপরে নিন`, `Move ${label} up`)} disabled={index === 0 || act.isPending} onClick={() => move(-1)}>
        <ArrowUp className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={t(`${label} নিচে নিন`, `Move ${label} down`)} disabled={index === rowIds.length - 1 || act.isPending} onClick={() => move(1)}>
        <ArrowDown className="size-4" />
      </Button>
      <Button variant="ghost" size="sm" aria-label={isActive ? t(`${label} লুকান`, `Hide ${label}`) : t(`${label} দেখান`, `Show ${label}`)} disabled={act.isPending} onClick={() => act.mutate(onToggle)}>
        {isActive ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
      </Button>
      <Button variant="ghost" size="sm" aria-label={t(`${label} এডিট`, `Edit ${label}`)} onClick={onEdit}>
        <Pencil className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={t(`${label} মুছুন`, `Delete ${label}`)}
        disabled={act.isPending}
        onClick={() => {
          if (window.confirm(t(`"${label}" মুছে ফেলবেন? আর ফেরানো যাবে না।`, `Delete "${label}"? This can't be undone.`))) act.mutate(() => api.home.remove(kind, id))
        }}
      >
        <Trash2 className="size-4 text-danger-ink" />
      </Button>
    </div>
  )
}

function Thumb({ url, aspect = 'aspect-video', className }: { url: string | null; aspect?: string; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-line bg-canvas', aspect, className)}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center text-muted">
          <ImagePlus className="size-5" />
        </span>
      )}
    </div>
  )
}

/** Choose or replace a picture, and undo an upload. The file is sent when the form is saved. */
function PicturePicker({ current, uploaded, hint, file, drop, onFile, onDrop, onError }: { current: string | null; uploaded: boolean; hint: string; file: File | null; drop: boolean; onFile: (file: File) => void; onDrop: () => void; onError: (code: MessageCode) => void }) {
  const { t } = useLang()
  const [preview, setPreview] = useState<string | null>(null)
  useEffect(() => {
    if (!file) return setPreview(null)
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])
  const shown = preview ?? (drop ? null : current)
  return (
    <div className="grid gap-2">
      <span className="text-sm font-medium">{t('ছবি', 'Picture')}</span>
      <div className="grid grid-cols-[160px_minmax(0,1fr)] items-start gap-3">
        <Thumb url={shown} />
        <div className="grid gap-2 text-sm">
          <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 font-semibold hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
            <ImagePlus className="size-4" />
            {shown ? t('ছবি বদলান', 'Change picture') : t('ছবি বাছুন', 'Choose picture')}
            <input
              type="file"
              accept={IMAGE_TYPES.join(',')}
              className="sr-only"
              onChange={event => {
                const chosen = event.target.files?.[0]
                if (!chosen) return
                if (!IMAGE_TYPES.includes(chosen.type) || chosen.size > MAX_IMAGE_BYTES) return onError('image.invalid')
                onFile(chosen)
              }}
            />
          </label>
          {uploaded && !drop && !file && (
            <button type="button" className="w-fit text-left text-xs font-semibold text-danger-ink hover:underline" onClick={onDrop}>
              {t('আপলোড করা ছবি সরান', 'Remove the uploaded picture')}
            </button>
          )}
          <span className="text-xs text-muted">{hint}</span>
        </div>
      </div>
    </div>
  )
}

function Banners({ rows, canEdit }: { rows: AdminHomeBannerDto[]; canEdit: boolean }) {
  const { t, text } = useLang()
  const [editing, setEditing] = useState<AdminHomeBannerDto | 'new' | null>(null)
  const ids = rows.map(row => row.id)
  const refresh = useRefresh()
  return (
    <Card
      title={t('ব্যানার', 'Banners')}
      actions={
        canEdit && !editing ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            {t('নতুন ব্যানার', 'New banner')}
          </Button>
        ) : undefined
      }
    >
      <p className="mb-3 text-sm text-muted">{t('একটি থাকলে স্থির থাকে, দুই বা তার বেশি হলে স্লাইড করে।', 'One stays still; two or more slide.')}</p>
      {editing && <BannerForm key={editing === 'new' ? 'new' : editing.id} banner={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      {!rows.length && <Empty>{t('কোনো ব্যানার নেই।', 'No banners yet.')}</Empty>}
      <ul className="grid gap-2">
        {rows.map(row => (
          <li key={row.id} className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-line p-2', !row.isActive && 'opacity-60')}>
            <Thumb url={row.imageUrl} className="w-28 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-navy">{text(row.title)}</p>
              {row.body && <p className="truncate text-sm text-muted">{text(row.body)}</p>}
              {!row.isActive && <Badge>{t('লুকানো', 'Hidden')}</Badge>}
            </div>
            <RowControls
              kind="banners"
              rowIds={ids}
              id={row.id}
              label={text(row.title)}
              isActive={row.isActive}
              canEdit={canEdit}
              onEdit={() => setEditing(row)}
              onToggle={() => api.home.updateBanner(row.id, { isActive: !row.isActive }).then(refresh)}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function BannerForm({ banner, onDone }: { banner: AdminHomeBannerDto | null; onDone: () => void }) {
  const { t, text } = useLang()
  const refresh = useRefresh()
  const [draft, setDraft] = useState({
    titleBn: banner?.titleBn ?? '',
    titleEn: banner?.titleEn ?? '',
    bodyBn: banner?.bodyBn ?? '',
    bodyEn: banner?.bodyEn ?? '',
    ctaBn: banner?.ctaBn ?? '',
    ctaEn: banner?.ctaEn ?? '',
    target: (banner?.target ?? 'bazar') as HomeBannerTarget | '',
    isActive: banner?.isActive ?? true,
  })
  const [file, setFile] = useState<File | null>(null)
  const [drop, setDrop] = useState(false)
  const [error, setError] = useState<MessageCode | null>(null)
  const [savedId, setSavedId] = useState(banner?.id ?? null)
  const edit = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }
  const save = useMutation({
    mutationFn: async () => {
      const check = validateForm(homeBannerSchema, { ...draft, target: draft.target || null }, ['home.title'])
      if (!check.success) throw check.code
      const saved = savedId ? await api.home.updateBanner(savedId, check.data) : await api.home.createBanner(check.data)
      setSavedId(saved.id)
      if (file) await api.home.setImage('banners', saved.id, file)
      else if (drop) await api.home.removeImage('banners', saved.id)
    },
    onSuccess: () => {
      void refresh()
      toast.success(banner ? t('ব্যানার আপডেট হয়েছে', 'Banner updated') : t('ব্যানার যোগ হয়েছে', 'Banner added'))
      onDone()
    },
    onError: failure => {
      void refresh()
      setError(errorCode(failure, ['home.title']))
    },
  })
  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3"
      onSubmit={event => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Field label={t('শিরোনাম (বাংলা) *', 'Title (Bangla) *')}>
          <Input value={draft.titleBn} maxLength={120} onChange={e => edit('titleBn', e.target.value)} />
        </Field>
        <Field label={t('শিরোনাম (ইংরেজি)', 'Title (English)')} hint={t('খালি রাখলে বাংলা দেখানো হবে।', 'Left blank, the Bangla is shown.')}>
          <Input value={draft.titleEn} maxLength={120} onChange={e => edit('titleEn', e.target.value)} />
        </Field>
        <Field label={t('লেখা (বাংলা)', 'Text (Bangla)')}>
          <Textarea rows={2} maxLength={300} value={draft.bodyBn} onChange={e => edit('bodyBn', e.target.value)} />
        </Field>
        <Field label={t('লেখা (ইংরেজি)', 'Text (English)')}>
          <Textarea rows={2} maxLength={300} value={draft.bodyEn} onChange={e => edit('bodyEn', e.target.value)} />
        </Field>
        <Field label={t('বাটনের লেখা (বাংলা)', 'Button text (Bangla)')}>
          <Input value={draft.ctaBn} maxLength={40} disabled={!draft.target} onChange={e => edit('ctaBn', e.target.value)} placeholder="এখনই অর্ডার করুন" />
        </Field>
        <Field label={t('বাটনের লেখা (ইংরেজি)', 'Button text (English)')}>
          <Input value={draft.ctaEn} maxLength={40} disabled={!draft.target} onChange={e => edit('ctaEn', e.target.value)} placeholder="Order now" />
        </Field>
      </div>
      <Field label={t('বাটন যেখানে নেবে', 'Button opens')}>
        <Select value={draft.target} onChange={e => edit('target', e.target.value as HomeBannerTarget | '')}>
          <option value="">{t('বাটন নেই', 'No button')}</option>
          {HOME_BANNER_TARGETS.map(target => (
            <option key={target} value={target}>
              {target === 'offers' ? t('আজকের অফার', "Today's offers") : text(SERVICE_LABELS[target])}
            </option>
          ))}
        </Select>
      </Field>
      <PicturePicker
        current={banner?.imageUrl ?? null}
        uploaded={!!banner?.uploaded}
        hint={t('JPG, PNG বা WebP, ৫ MB পর্যন্ত। চওড়া ছবি (১৬:৯) সবচেয়ে ভালো দেখায়।', 'JPG, PNG or WebP, up to 5 MB. A wide picture (16:9) looks best.')}
        file={file}
        drop={drop}
        onFile={chosen => {
          setFile(chosen)
          setDrop(false)
          setError(null)
        }}
        onDrop={() => setDrop(true)}
        onError={setError}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-600" checked={draft.isActive} onChange={e => edit('isActive', e.target.checked)} />
        {t('চালু (বন্ধ করলে গ্রাহকরা দেখবেন না)', 'On (switched off, customers do not see it)')}
      </label>
      <ErrorNote code={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          <X className="size-4" />
          {t('বন্ধ', 'Close')}
        </Button>
        <Button type="submit" loading={save.isPending}>
          <Save className="size-4" />
          {t('সেভ করুন', 'Save')}
        </Button>
      </div>
    </form>
  )
}

function Categories({ rows, canEdit }: { rows: AdminHomeCategoryDto[]; canEdit: boolean }) {
  const { t, text } = useLang()
  const [editing, setEditing] = useState<AdminHomeCategoryDto | 'new' | null>(null)
  const ids = rows.map(row => row.id)
  const refresh = useRefresh()
  return (
    <Card
      title={t('ক্যাটাগরি', 'Categories')}
      actions={
        canEdit && !editing ? (
          <Button size="sm" onClick={() => setEditing('new')}>
            <Plus className="size-4" />
            {t('নতুন ক্যাটাগরি', 'New category')}
          </Button>
        ) : undefined
      }
    >
      {editing && <CategoryForm key={editing === 'new' ? 'new' : editing.id} category={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      {!rows.length && <Empty>{t('কোনো ক্যাটাগরি নেই।', 'No categories yet.')}</Empty>}
      <ul className="grid gap-2">
        {rows.map(row => (
          <li key={row.id} className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-line p-2', !row.isActive && 'opacity-60')}>
            <Thumb url={row.imageUrl} aspect="aspect-[4/3]" className="w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-semibold text-navy">
                <span className={cn('size-3 shrink-0 rounded-full', TONE_SWATCH[row.tone])} title={text(HOME_TONE_LABELS[row.tone])} />
                {text(row.name)}
              </p>
              <p className="text-sm text-muted">{row.addsItem ? t('বাজারের লিস্টে যোগ হয়', 'Adds to the bazar list') : t('শুধু বাজারের ফর্ম খোলে', 'Only opens the bazar form')}</p>
              {!row.isActive && <Badge>{t('লুকানো', 'Hidden')}</Badge>}
            </div>
            <RowControls
              kind="categories"
              rowIds={ids}
              id={row.id}
              label={text(row.name)}
              isActive={row.isActive}
              canEdit={canEdit}
              onEdit={() => setEditing(row)}
              onToggle={() => api.home.updateCategory(row.id, { isActive: !row.isActive }).then(refresh)}
            />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function CategoryForm({ category, onDone }: { category: AdminHomeCategoryDto | null; onDone: () => void }) {
  const { t, text } = useLang()
  const refresh = useRefresh()
  const [draft, setDraft] = useState({
    nameBn: category?.nameBn ?? '',
    nameEn: category?.nameEn ?? '',
    tone: (category?.tone ?? 'blue') as HomeTone,
    addsItem: category?.addsItem ?? true,
    isActive: category?.isActive ?? true,
  })
  const [file, setFile] = useState<File | null>(null)
  const [drop, setDrop] = useState(false)
  const [error, setError] = useState<MessageCode | null>(null)
  const [savedId, setSavedId] = useState(category?.id ?? null)
  const edit = <K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) => {
    setDraft(current => ({ ...current, [key]: value }))
    setError(null)
  }
  const save = useMutation({
    mutationFn: async () => {
      const check = validateForm(homeCategorySchema, draft, ['home.name'])
      if (!check.success) throw check.code
      const saved = savedId ? await api.home.updateCategory(savedId, check.data) : await api.home.createCategory(check.data)
      setSavedId(saved.id)
      if (file) await api.home.setImage('categories', saved.id, file)
      else if (drop) await api.home.removeImage('categories', saved.id)
    },
    onSuccess: () => {
      void refresh()
      toast.success(category ? t('ক্যাটাগরি আপডেট হয়েছে', 'Category updated') : t('ক্যাটাগরি যোগ হয়েছে', 'Category added'))
      onDone()
    },
    onError: failure => {
      void refresh()
      setError(errorCode(failure, ['home.name']))
    },
  })
  return (
    <form
      className="mb-4 grid gap-3 rounded-lg border border-brand-200 bg-brand-50/40 p-3"
      onSubmit={event => {
        event.preventDefault()
        save.mutate()
      }}
    >
      <div className="grid items-start gap-3 sm:grid-cols-3">
        <Field label={t('নাম (বাংলা) *', 'Name (Bangla) *')}>
          <Input value={draft.nameBn} maxLength={40} onChange={e => edit('nameBn', e.target.value)} />
        </Field>
        <Field label={t('নাম (ইংরেজি)', 'Name (English)')} hint={t('খালি রাখলে বাংলা দেখানো হবে।', 'Left blank, the Bangla is shown.')}>
          <Input value={draft.nameEn} maxLength={40} onChange={e => edit('nameEn', e.target.value)} />
        </Field>
        <Field label={t('রং', 'Colour')}>
          <Select value={draft.tone} onChange={e => edit('tone', e.target.value as HomeTone)}>
            {HOME_TONES.map(tone => (
              <option key={tone} value={tone}>
                {text(HOME_TONE_LABELS[tone])}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <PicturePicker
        current={category?.imageUrl ?? null}
        uploaded={!!category?.uploaded}
        hint={t('JPG, PNG বা WebP, ৫ MB পর্যন্ত। ৪:৩ মাপের ছবি সবচেয়ে ভালো দেখায়।', 'JPG, PNG or WebP, up to 5 MB. A 4:3 picture looks best.')}
        file={file}
        drop={drop}
        onFile={chosen => {
          setFile(chosen)
          setDrop(false)
          setError(null)
        }}
        onDrop={() => setDrop(true)}
        onError={setError}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-600" checked={draft.addsItem} onChange={e => edit('addsItem', e.target.checked)} />
        {t('চাপলে এই নামে বাজারের লিস্টে একটি সারি যোগ হবে (বন্ধ থাকলে শুধু ফর্ম খুলবে)', 'A tap adds a bazar list row with this name (off, it only opens the form)')}
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-brand-600" checked={draft.isActive} onChange={e => edit('isActive', e.target.checked)} />
        {t('চালু (বন্ধ করলে গ্রাহকরা দেখবেন না)', 'On (switched off, customers do not see it)')}
      </label>
      <ErrorNote code={error} />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onDone}>
          <X className="size-4" />
          {t('বন্ধ', 'Close')}
        </Button>
        <Button type="submit" loading={save.isPending}>
          <Save className="size-4" />
          {t('সেভ করুন', 'Save')}
        </Button>
      </div>
    </form>
  )
}

/** Each service tile's picture: replace it, or go back to the service's usual photo. Saved at once. */
function ServicePictures({ images, canEdit }: { images: AdminHomeDto['serviceImages']; canEdit: boolean }) {
  const { t, text } = useLang()
  const refresh = useRefresh()
  const [error, setError] = useState<MessageCode | null>(null)
  const act = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onSuccess: () => {
      setError(null)
      void refresh()
      toast.success(t('ছবি আপডেট হয়েছে', 'Picture updated'))
    },
    onError: failure => setError(errorCode(failure)),
  })
  const upload = (service: ServiceId, file: File | undefined) => {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type) || file.size > MAX_IMAGE_BYTES) return setError('image.invalid')
    act.mutate(() => api.home.setImage('services', service, file))
  }
  return (
    <Card title={t('সেবার ছবি', 'Service pictures')}>
      <ErrorNote code={error} />
      <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {SERVICE_IDS.map(service => (
          <li key={service} className="grid content-start gap-2 rounded-lg border border-line p-2">
            <Thumb url={images[service].url} aspect="aspect-[4/3]" />
            <p className="text-sm font-semibold text-navy">{text(SERVICE_LABELS[service])}</p>
            {canEdit && (
              <div className="grid gap-1 text-sm">
                <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 font-semibold hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700">
                  <ImagePlus className="size-4" />
                  {t('ছবি বদলান', 'Change')}
                  <input type="file" accept={IMAGE_TYPES.join(',')} className="sr-only" disabled={act.isPending} onChange={e => upload(service, e.target.files?.[0])} />
                </label>
                {images[service].uploaded && (
                  <button type="button" className="w-fit text-left text-xs font-semibold text-danger-ink hover:underline" disabled={act.isPending} onClick={() => act.mutate(() => api.home.removeImage('services', service))}>
                    {t('আগের ছবিতে ফেরান', 'Use the default')}
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}

/** Each section's heading and whether it shows. */
function Sections({ sections, canEdit }: { sections: AdminHomeDto['sections']; canEdit: boolean }) {
  const { t } = useLang()
  const refresh = useRefresh()
  const [draft, setDraft] = useState(() => Object.fromEntries(HOME_SECTIONS.map(id => [id, { headingBn: sections[id].headingBn, headingEn: sections[id].headingEn ?? '', visible: sections[id].visible }])) as Record<HomeSectionId, { headingBn: string; headingEn: string; visible: boolean }>)
  const [error, setError] = useState<MessageCode | null>(null)
  const names: Record<HomeSectionId, string> = {
    categories: t('ক্যাটাগরি অংশ', 'Categories section'),
    services: t('সেবা অংশ', 'Services section'),
    offers: t('অফার অংশ', 'Offers section'),
  }
  const edit = (id: HomeSectionId, patch: Partial<(typeof draft)[HomeSectionId]>) => {
    setDraft(current => ({ ...current, [id]: { ...current[id], ...patch } }))
    setError(null)
  }
  const save = useMutation({
    mutationFn: async () => {
      const check = validateForm(homeSectionsSchema, draft, ['home.heading'])
      if (!check.success) throw check.code
      await api.home.saveSections(check.data)
    },
    onSuccess: () => {
      void refresh()
      toast.success(t('সেভ হয়েছে', 'Saved'))
    },
    onError: failure => setError(errorCode(failure, ['home.heading'])),
  })
  return (
    <Card title={t('অংশের শিরোনাম', 'Section headings')}>
      <form
        className="grid gap-4"
        onSubmit={event => {
          event.preventDefault()
          save.mutate()
        }}
      >
        {HOME_SECTIONS.map(id => (
          <fieldset key={id} disabled={!canEdit} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:gap-3">
            <Field label={`${names[id]} (${t('বাংলা', 'Bangla')}) *`}>
              <Input value={draft[id].headingBn} maxLength={80} onChange={e => edit(id, { headingBn: e.target.value })} />
            </Field>
            <Field label={`${names[id]} (${t('ইংরেজি', 'English')})`}>
              <Input value={draft[id].headingEn} maxLength={80} onChange={e => edit(id, { headingEn: e.target.value })} />
            </Field>
            <label className="flex h-10 items-center gap-2 text-sm">
              <input type="checkbox" className="size-4 accent-brand-600" checked={draft[id].visible} onChange={e => edit(id, { visible: e.target.checked })} />
              {t('দেখান', 'Show')}
            </label>
          </fieldset>
        ))}
        <ErrorNote code={error} />
        {canEdit && (
          <div className="flex justify-end">
            <Button type="submit" loading={save.isPending}>
              <Save className="size-4" />
              {t('সেভ করুন', 'Save')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

