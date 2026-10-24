'use client'

import {
  type CatalogDto,
  type DeliveryHours,
  deliveryHoursSchema,
  type DeliveryWindow,
  describeDeliveryHours,
  formatDeliveryWindows,
  type MessageCode,
  parseDeliveryWindows,
  type Pricing,
  pricingSchema,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  supportSettingsSchema,
  toAmount,
  validateForm,
  type VehicleDto,
  vehicleSchema,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, ErrorNote, Field, Input, Loading, PageHeader, Table, Td, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCatalog, useCurrentAdmin } from '@/admin/lib/queries'
import { canManage, errorCode, isSuperAdmin } from '@/admin/lib/utils'

export default function CatalogPage() {
  const { t } = useLang()
  const catalog = useCatalog()
  const admin = useCurrentAdmin()
  const editable = canManage(admin.role)
  return (
    <>
      <PageHeader
        title={t('দাম ও গাড়ী', 'Pricing & vehicles')}
        subtitle={
          editable
            ? t('নতুন অর্ডারে নতুন দাম লাগবে; আগের অর্ডারের বিল বদলাবে না।', 'New prices apply to new orders; existing bills keep the prices they were placed with.')
            : t('দাম দেখতে পারবেন; বদলাতে ম্যানেজার লাগবে।', 'You can view prices; a manager can change them.')
        }
      />
      {catalog.isPending && <Loading />}
      <ErrorNote code={catalog.isError ? errorCode(catalog.error) : null} />
      {catalog.data && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <PricingCard pricing={catalog.data.pricing} editable={editable} />
          <div className="grid min-w-0 content-start gap-5">
            <SupportCard catalog={catalog.data} editable={editable} />
            <DeliveryHoursCard hours={catalog.data.deliveryHours} editable={editable} />
            <CustomerAuthCard password={catalog.data.customerAuth.password} editable={isSuperAdmin(admin.role)} />
          </div>
          <div className="lg:col-span-2">
            <VehiclesCard vehicles={catalog.data.vehicles} editable={editable} />
          </div>
        </div>
      )}
    </>
  )
}

function useCatalogMutation<TInput, TResult>(send: (input: TInput) => Promise<TResult>, success: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.catalog })
      toast.success(success)
    },
  })
}

function PricingCard({ pricing, editable }: { pricing: Pricing; editable: boolean }) {
  const { t } = useLang()
  const [form, setForm] = useState<Record<keyof Pricing, string>>(() => Object.fromEntries(Object.entries(pricing).map(([key, value]) => [key, String(value)])) as Record<keyof Pricing, string>)
  const [error, setError] = useState<MessageCode | null>(null)
  const save = useCatalogMutation(api.catalog.updatePricing, t('দাম সেভ হয়েছে', 'Prices saved'))

  const fields: [keyof Pricing, string][] = [
    ['bazarShoppingFee', t('বাজার ক্রয় বাবদ মজুরী', 'Bazar shopping fee')],
    ['bazarDeliveryFee', t('বাজার ডেলিভারী খরচ', 'Bazar delivery charge')],
    ['medicineDeliveryFee', t('ঔষুধ ডেলিভারী চার্জ', 'Medicine delivery charge')],
    ['parcelDeliveryFee', t('পার্সেল ডেলিভারী খরচ', 'Parcel delivery charge')],
    ['wagePerLabourer', t('লেবার জনপ্রতি মজুরী', 'Wage per labourer')],
    ['loadingRatePerFloor', t('প্রতি ফ্লোর (loading)', 'Per floor (loading)')],
    ['unloadingRatePerFloor', t('প্রতি ফ্লোর (unloading)', 'Per floor (unloading)')],
  ]

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const check = validateForm(pricingSchema, Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value.trim() === '' ? NaN : Number(value)])), [])
    if (!check.success) return setError('field.invalid')
    setError(null)
    save.mutate(check.data)
  }

  return (
    <Card title={t('ফি ও রেট (টাকা)', 'Fees and rates (taka)')}>
      <form className="grid gap-3" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          {fields.map(([key, label]) => (
            <Field key={key} label={label}>
              <Input type="number" min={0} step={1} inputMode="numeric" disabled={!editable} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} />
            </Field>
          ))}
        </div>
        <ErrorNote code={error ?? (save.isError ? errorCode(save.error) : null)} />
        {editable && (
          <div>
            <Button type="submit" loading={save.isPending}>
              <Save className="size-4" />
              {t('দাম সেভ করুন', 'Save prices')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

function SupportCard({ catalog, editable }: { catalog: CatalogDto; editable: boolean }) {
  const { t } = useLang()
  const [form, setForm] = useState(catalog.support)
  const [error, setError] = useState<MessageCode | null>(null)
  const save = useCatalogMutation(api.catalog.updateSupport, t('সাপোর্ট নম্বর সেভ হয়েছে', 'Support line saved'))
  return (
    <Card title={t('সাপোর্ট (Chat ও Call)', 'Support (Chat and Call)')}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          const check = validateForm(supportSettingsSchema, form, [])
          if (!check.success) return setError(check.code)
          setError(null)
          save.mutate(check.data)
        }}
      >
        <Field label={t('কল নম্বর', 'Call number')} hint="+8801XXXXXXXXX">
          <Input type="tel" disabled={!editable} value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
        </Field>
        <Field label={t('WhatsApp লিংক', 'WhatsApp link')} hint="https://wa.me/8801XXXXXXXXX">
          <Input type="url" disabled={!editable} value={form.whatsapp} onChange={e => setForm({ ...form, whatsapp: e.target.value })} />
        </Field>
        <ErrorNote code={error ?? (save.isError ? errorCode(save.error) : null)} />
        {editable && (
          <div>
            <Button type="submit" variant="secondary" loading={save.isPending}>
              <Save className="size-4" />
              {t('সেভ করুন', 'Save')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

/** Whether customers sign up and log in with a password. Only the super admin can change it. */
function CustomerAuthCard({ password, editable }: { password: boolean; editable: boolean }) {
  const { t } = useLang()
  const [checked, setChecked] = useState(password)
  const save = useCatalogMutation(api.catalog.updateCustomerAuth, t('গ্রাহকের লগইন সেভ হয়েছে', 'Customer sign-in saved'))
  return (
    <Card title={t('গ্রাহকের লগইন', 'Customer sign-in')}>
      <form
        className="grid gap-3"
        onSubmit={event => {
          event.preventDefault()
          save.mutate({ password: checked })
        }}
      >
        <label className="inline-flex items-center gap-2 text-sm font-medium text-ink">
          <input type="checkbox" className="size-4 accent-brand-600" disabled={!editable} checked={checked} onChange={e => setChecked(e.target.checked)} />
          {t('গ্রাহকদের কাছে পাসওয়ার্ড চাওয়া হবে', 'Ask customers for a password')}
        </label>
        <p className="text-sm text-muted">
          {checked
            ? t('সাইন আপ ও লগইনে পাসওয়ার্ড লাগবে। পাসওয়ার্ড ছাড়া খোলা অ্যাকাউন্টের পাসওয়ার্ড তাদের মোবাইল নম্বর।', 'Sign up and login ask for a password. Accounts opened without one use their mobile number as the password.')
            : t('গ্রাহক শুধু মোবাইল নম্বর দিয়ে সাইন আপ ও লগইন করবেন। নম্বর জানলে যে কেউ সেই অ্যাকাউন্টে ঢুকতে পারবে।', 'Customers sign up and log in with their mobile number only. Anyone who knows a number can open that account.')}
        </p>
        {!editable && <p className="text-sm text-muted">{t('শুধু সুপার অ্যাডমিন এটি বদলাতে পারবেন।', 'Only the super admin can change this.')}</p>}
        <ErrorNote code={save.isError ? errorCode(save.error) : null} />
        {editable && (
          <div>
            <Button type="submit" variant="secondary" loading={save.isPending} disabled={checked === password}>
              <Save className="size-4" />
              {t('সেভ করুন', 'Save')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

/** The ডেলিভারি টাইম windows per service. The customer forms and the API reject a time outside them. */
function DeliveryHoursCard({ hours, editable }: { hours: DeliveryHours; editable: boolean }) {
  const { t, text } = useLang()
  const [form, setForm] = useState(hours)
  const [error, setError] = useState<MessageCode | null>(null)
  const save = useCatalogMutation(api.catalog.updateDeliveryHours, t('ডেলিভারির সময় সেভ হয়েছে', 'Delivery hours saved'))

  const setWindows = (service: ServiceId, windows: DeliveryWindow[]) => setForm({ ...form, [service]: windows })
  const setWindow = (service: ServiceId, index: number, patch: Partial<DeliveryWindow>) =>
    setWindows(service, form[service].map((window, at) => (at === index ? { ...window, ...patch } : window)))

  return (
    <Card title={t('ডেলিভারির সময় সূচী', 'Delivery hours')}>
      <form
        className="grid gap-4"
        onSubmit={event => {
          event.preventDefault()
          const check = validateForm(deliveryHoursSchema, form, [])
          if (!check.success) return setError(check.code)
          setError(null)
          save.mutate(check.data)
        }}
      >
        <p className="text-xs text-muted">
          {t('এই সময় সূচী গ্রাহকের ফর্মে নোটিশ হিসেবে দেখানো হয়; গ্রাহক যেকোনো সময় দিতে পারবেন। কোনো সময় না দিলে নোটিশ দেখাবে না।', 'Shown to customers as a notice on the order form; they can still pick any time. With no windows, no notice is shown.')}
        </p>
        {SERVICE_IDS.map(service => {
          const windows = form[service]
          // Only the complete windows, so the preview never shows a half-typed one.
          const preview = parseDeliveryWindows(formatDeliveryWindows(windows))
          return (
            <fieldset key={service} className="grid gap-2">
              <legend className="mb-1 text-xs font-semibold text-muted">{text(SERVICE_LABELS[service])}</legend>
              {windows.map((window, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    type="time"
                    aria-label={t('শুরু', 'From')}
                    className="h-9 w-32"
                    disabled={!editable}
                    value={window.from}
                    onChange={e => setWindow(service, index, { from: e.target.value })}
                  />
                  <span className="text-muted">–</span>
                  <Input
                    type="time"
                    aria-label={t('শেষ', 'To')}
                    className="h-9 w-32"
                    disabled={!editable}
                    value={window.to}
                    onChange={e => setWindow(service, index, { to: e.target.value })}
                  />
                  {editable && (
                    <Button size="icon" variant="ghost" aria-label={t('সময়টি মুছুন', 'Remove window')} onClick={() => setWindows(service, windows.filter((_, at) => at !== index))}>
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                {editable && windows.length < 4 && (
                  <Button size="sm" variant="secondary" onClick={() => setWindows(service, [...windows, { from: '', to: '' }])}>
                    <Plus className="size-4" />
                    {t('সময় যোগ করুন', 'Add window')}
                  </Button>
                )}
                <span className="text-xs text-muted">{preview.length ? text(describeDeliveryHours(preview)) : t('যেকোনো সময়', 'Any time')}</span>
              </div>
            </fieldset>
          )
        })}
        <ErrorNote code={error ?? (save.isError ? errorCode(save.error) : null)} />
        {editable && (
          <div>
            <Button type="submit" variant="secondary" loading={save.isPending}>
              <Save className="size-4" />
              {t('সেভ করুন', 'Save')}
            </Button>
          </div>
        )}
      </form>
    </Card>
  )
}

type VehicleForm = { nameBn: string; nameEn: string; rate: string; sortOrder: string; isActive: boolean }
const toForm = (vehicle?: VehicleDto): VehicleForm => ({
  nameBn: vehicle?.name.bn ?? '',
  nameEn: vehicle?.name.en ?? '',
  rate: vehicle ? String(vehicle.rate) : '',
  sortOrder: vehicle ? String(vehicle.sortOrder) : '0',
  isActive: vehicle?.isActive ?? true,
})
const toBody = (form: VehicleForm) => ({ ...form, rate: form.rate.trim() === '' ? NaN : toAmount(form.rate), sortOrder: toAmount(form.sortOrder) })

function VehiclesCard({ vehicles, editable }: { vehicles: VehicleDto[]; editable: boolean }) {
  const { t, taka } = useLang()
  const [adding, setAdding] = useState<VehicleForm | null>(null)
  const [editing, setEditing] = useState<{ id: string; form: VehicleForm } | null>(null)
  const [error, setError] = useState<MessageCode | null>(null)
  const create = useCatalogMutation(api.catalog.createVehicle, t('গাড়ী যোগ হয়েছে', 'Vehicle added'))
  const update = useCatalogMutation((input: { id: string; form: VehicleForm }) => api.catalog.updateVehicle(input.id, toBody(input.form)), t('গাড়ী সেভ হয়েছে', 'Vehicle saved'))

  const saveNew = () => {
    if (!adding) return
    const check = validateForm(vehicleSchema, toBody(adding), [])
    if (!check.success) return setError(check.code)
    setError(null)
    create.mutate(check.data, { onSuccess: () => setAdding(null) })
  }
  const saveEdit = () => {
    if (!editing) return
    const check = validateForm(vehicleSchema, toBody(editing.form), [])
    if (!check.success) return setError(check.code)
    setError(null)
    update.mutate(editing, { onSuccess: () => setEditing(null) })
  }

  const row = (form: VehicleForm, onChange: (form: VehicleForm) => void) => (
    <>
      <Td>
        <Input aria-label={t('বাংলা নাম', 'Name (Bangla)')} className="h-8" value={form.nameBn} onChange={e => onChange({ ...form, nameBn: e.target.value })} />
      </Td>
      <Td>
        <Input aria-label={t('ইংরেজি নাম', 'Name (English)')} className="h-8" value={form.nameEn} onChange={e => onChange({ ...form, nameEn: e.target.value })} />
      </Td>
      <Td>
        <Input aria-label={t('শুরুর রেট', 'Starting rate')} className="h-8 w-28 text-right" type="number" min={0} inputMode="numeric" value={form.rate} onChange={e => onChange({ ...form, rate: e.target.value })} />
      </Td>
      <Td>
        <Input aria-label={t('ক্রম', 'Order')} className="h-8 w-20" type="number" min={0} inputMode="numeric" value={form.sortOrder} onChange={e => onChange({ ...form, sortOrder: e.target.value })} />
      </Td>
      <Td>
        <label className="inline-flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-brand-600" checked={form.isActive} onChange={e => onChange({ ...form, isActive: e.target.checked })} />
          {t('চালু', 'Active')}
        </label>
      </Td>
    </>
  )

  return (
    <Card
      title={t('বাসা বদলের গাড়ী', 'House-shifting vehicles')}
      actions={
        editable && !adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(toForm())}>
            <Plus className="size-4" />
            {t('গাড়ী যোগ করুন', 'Add vehicle')}
          </Button>
        ) : null
      }
    >
      <p className="mb-3 text-sm text-muted">
        {t(
          'গ্রাহক এই রেটকে “থেকে” হিসেবে দেখেন। প্রতিটি অর্ডারের গাড়ী ভাড়া দূরত্ব দেখে অর্ডারের পাতা থেকে পাঠানো হয়।',
          'Customers see this rate as a “from” price. Each order’s vehicle rent is set by distance and sent from the order’s page.',
        )}
      </p>
      <Table>
        <thead>
          <tr>
            <Th>{t('বাংলা নাম', 'Name (Bangla)')}</Th>
            <Th>{t('ইংরেজি নাম', 'Name (English)')}</Th>
            <Th>{t('শুরুর রেট', 'Starting rate')}</Th>
            <Th>{t('ক্রম', 'Order')}</Th>
            <Th>{t('অবস্থা', 'Status')}</Th>
            {editable && <Th />}
          </tr>
        </thead>
        <tbody>
          {vehicles.map(vehicle =>
            editing?.id === vehicle.id ? (
              <tr key={vehicle.id}>
                {row(editing.form, form => setEditing({ id: vehicle.id, form }))}
                <Td className="whitespace-nowrap">
                  <Button size="sm" loading={update.isPending} onClick={saveEdit}>
                    {t('সেভ', 'Save')}
                  </Button>{' '}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                    {t('বাতিল', 'Cancel')}
                  </Button>
                </Td>
              </tr>
            ) : (
              <tr key={vehicle.id}>
                <Td className="font-medium">{vehicle.name.bn}</Td>
                <Td>{vehicle.name.en}</Td>
                <Td className="tabular-nums">{taka(vehicle.rate)}</Td>
                <Td className="tabular-nums">{vehicle.sortOrder}</Td>
                <Td>{vehicle.isActive ? <Badge tone="brand">{t('চালু', 'Active')}</Badge> : <Badge>{t('বন্ধ', 'Hidden')}</Badge>}</Td>
                {editable && (
                  <Td className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing({ id: vehicle.id, form: toForm(vehicle) })}>
                      {t('এডিট', 'Edit')}
                    </Button>
                  </Td>
                )}
              </tr>
            ),
          )}
          {adding && (
            <tr>
              {row(adding, setAdding)}
              <Td className="whitespace-nowrap">
                <Button size="sm" loading={create.isPending} onClick={saveNew}>
                  {t('যোগ করুন', 'Add')}
                </Button>{' '}
                <Button size="sm" variant="ghost" onClick={() => setAdding(null)}>
                  {t('বাতিল', 'Cancel')}
                </Button>
              </Td>
            </tr>
          )}
        </tbody>
      </Table>
      <div className="mt-3">
        <ErrorNote code={error ?? (create.isError ? errorCode(create.error) : update.isError ? errorCode(update.error) : null)} />
      </div>
    </Card>
  )
}
