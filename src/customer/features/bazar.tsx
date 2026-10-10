'use client'

import { calcBazar, createBazarOrderSchema, FORM_ERROR_PRIORITY, type ScheduleInput, toAmount, validateForm } from '@/shared'
import { Clock } from 'lucide-react'
import { useState } from 'react'

import { DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { type Column, isRowStarted, LineTable, type Row } from '@/customer/components/line-table'
import { BillSummary, ConfirmButton, CustomerInfo, Field, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type BazarDraft = { address: string; mobile: string; schedule: ScheduleInput; rows: Row[] }
const PRIORITY = FORM_ERROR_PRIORITY.bazar

export function BazarScreen() {
  const { t } = useLang()
  const { user, catalog } = useSession()
  const [draft, setDraft] = useDraft<BazarDraft>('bazar', () => ({ address: '', mobile: user.mobile, schedule: EMPTY_SCHEDULE, rows: [{}] }))
  const [showError, setShowError] = useState(false)
  const placeOrder = usePlaceOrder(api.orders.createBazar)

  const update = (patch: Partial<BazarDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }

  const columns: Column[] = [
    { key: 'name', label: t('কাঁচা বাজারের লিস্ট লিখুন', 'Bazar list item'), placeholder: t('আলু', 'Potatoes') },
    { key: 'quantity', label: t('পরিমাণ', 'Quantity'), placeholder: t('1 কেজি', '1 kg') },
    { key: 'variety', label: t('জাত বা ধরণ', 'Variety / type'), placeholder: t('দেশি', 'Local'), optional: true },
    { key: 'price', label: t('দর', 'Price'), placeholder: '৳', numeric: true, optional: true },
  ]
  const bill = calcBazar(catalog.pricing, draft.rows.map(row => row.price))
  const check = validateForm(
    createBazarOrderSchema,
    {
      address: draft.address,
      contactMobile: draft.mobile,
      schedule: draft.schedule,
      items: draft.rows.filter(isRowStarted).map(row => ({
        name: row.name ?? '',
        quantity: row.quantity ?? '',
        variety: row.variety || undefined,
        price: row.price?.trim() ? toAmount(row.price) : undefined,
      })),
    },
    PRIORITY,
  )
  const error = placeOrder.isError ? errorCode(placeOrder.error, PRIORITY) : showError && !check.success ? check.code : null

  const confirm = () => {
    if (!check.success) return setShowError(true)
    placeOrder.mutate(check.data, {
      onSuccess: () => {
        setDraft(current => ({ ...current, address: '', schedule: EMPTY_SCHEDULE, rows: [{}] }))
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard
      id="bazar"
      summary={
        <>
          <BillSummary
            lines={[
              [t('সর্বমোট বাজারের দাম', 'Total bazar cost'), bill.itemsTotal],
              [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), bill.serviceFee],
              [t('ডেলিভারী খরচ', 'Delivery charge'), bill.deliveryFee],
            ]}
            totalLabel={t('Total Bill', 'Total bill')}
            total={bill.total}
          />
          <ConfirmButton error={error} pending={placeOrder.isPending} onConfirm={confirm} />
        </>
      }
    >
      <CustomerInfo user={user} />
      <p className="notice">
        <Clock size={16} />
        <span>{t('কাঁচা বাজার ডেলিভারির সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।', 'Fresh market delivery hours: 8–10 am and 6–9 pm.')}</span>
      </p>
      <div className="field-pair">
        <Field label={t('ঠিকানা', 'Address')}>
          <input value={draft.address} onChange={e => update({ address: e.target.value })} placeholder={t('বাসা, রোড, এলাকা', 'House, road, area')} />
        </Field>
        <Field label={t('মোবা', 'Mobile')}>
          <input type="tel" inputMode="tel" value={draft.mobile} onChange={e => update({ mobile: e.target.value })} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <DeliverySchedule value={draft.schedule} onChange={schedule => update({ schedule })} />
      <LineTable template="1.7fr .8fr .9fr .8fr" columns={columns} rows={draft.rows} onChange={rows => update({ rows })} addLabel={t('আরো যোগ করতে ক্লিক করুন', 'Click to add more')} />
    </ServiceCard>
  )
}
