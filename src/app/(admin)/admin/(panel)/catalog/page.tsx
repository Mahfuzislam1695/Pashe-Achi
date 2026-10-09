'use client'

import {
  type CatalogDto,
  type MessageCode,
  type Pricing,
  pricingSchema,
  supportSettingsSchema,
  toAmount,
  validateForm,
  type VehicleDto,
  vehicleSchema,
} from '@/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Save } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Badge, Button, Card, ErrorNote, Field, Input, Loading, PageHeader, Table, Td, Th } from '@/admin/components/ui'
import { api } from '@/admin/lib/api'
import { useLang } from '@/admin/lib/i18n'
import { queryKeys, useCatalog, useCurrentAdmin } from '@/admin/lib/queries'
import { canManage, errorCode } from '@/admin/lib/utils'

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
        <Input aria-label={t('রেট', 'Rate')} className="h-8 w-28 text-right" type="number" min={0} inputMode="numeric" value={form.rate} onChange={e => onChange({ ...form, rate: e.target.value })} />
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
      <Table>
        <thead>
          <tr>
            <Th>{t('বাংলা নাম', 'Name (Bangla)')}</Th>
            <Th>{t('ইংরেজি নাম', 'Name (English)')}</Th>
            <Th>{t('রেট', 'Rate')}</Th>
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
