'use client'

import { calcBazar, createBazarOrderSchema, FORM_ERROR_PRIORITY, type ScheduleInput, validateForm } from '@/shared'
import { useEffect, useState } from 'react'

import { AddressField, addressPin, addressText, type AddressValue, fromMyLocation } from '@/customer/components/address-field'
import { PromoSlider } from '@/customer/components/banner'
import { DeliveryHoursNotice, DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { type Column, isRowStarted, LineTable, type Row } from '@/customer/components/line-table'
import { BillSummary, ConfirmButton, CustomerInfo, Field, QuoteNotice, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft, useTakeBazarItems } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type BazarDraft = { place: AddressValue; mobile: string; schedule: ScheduleInput; rows: Row[] }
const PRIORITY = FORM_ERROR_PRIORITY.bazar

export function BazarScreen() {
  const { t, taka } = useLang()
  const { user, catalog } = useSession()
  const [draft, setDraft] = useDraft<BazarDraft>('bazar', () => ({ place: fromMyLocation(user.location), mobile: user.mobile, schedule: EMPTY_SCHEDULE, rows: [{}] }))
  const [showError, setShowError] = useState(false)
  const placeOrder = usePlaceOrder(api.orders.createBazar)
  const takeItems = useTakeBazarItems()

  // Items picked on Home (a category or a search) join the list as new rows, after the filled ones.
  useEffect(() => {
    const items = takeItems()
    if (items.length) setDraft(current => ({ ...current, rows: [...current.rows.filter(isRowStarted), ...items.map(name => ({ name }))] }))
  }, [])

  const update = (patch: Partial<BazarDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }

  const columns: Column[] = [
    { key: 'name', label: t('কাঁচা বাজারের লিস্ট লিখুন', 'Bazar list item'), placeholder: t('আলু', 'Potatoes') },
    { key: 'quantity', label: t('পরিমাণ', 'Quantity'), placeholder: t('1 কেজি', '1 kg') },
    { key: 'variety', label: t('জাত বা ধরণ', 'Variety / type'), placeholder: t('দেশি', 'Local'), optional: true },
    { key: 'price', label: t('দর', 'Price'), placeholder: '৳', numeric: true, disabled: true },
  ]
  // The customer sends the list only; staff send the prices (see QuoteNotice).
  const bill = calcBazar(catalog.pricing, [])
  const check = validateForm(
    createBazarOrderSchema,
    {
      address: addressText(draft.place),
      addressPin: addressPin(draft.place),
      contactMobile: draft.mobile,
      schedule: draft.schedule,
      items: draft.rows.filter(isRowStarted).map(row => ({
        name: row.name ?? '',
        quantity: row.quantity ?? '',
        variety: row.variety || undefined,
      })),
    },
    PRIORITY,
  )
  const error = placeOrder.isError ? errorCode(placeOrder.error, PRIORITY) : showError && !check.success ? check.code : null

  const confirm = () => {
    if (!check.success) return setShowError(true)
    placeOrder.mutate(check.data, {
      onSuccess: () => {
        setDraft(current => ({ ...current, place: fromMyLocation(user.location), schedule: EMPTY_SCHEDULE, rows: [{}] }))
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard
      id="bazar"
      banner={<PromoSlider current="bazar" />}
      summary={
        <>
          <BillSummary
            lines={[
              [t('সর্বমোট বাজারের দাম', 'Total bazar cost'), t('পরে জানানো হবে', 'We will send it')],
              [t('বাজার ক্রয় বাবদ মজুরী', 'Shopping fee'), bill.serviceFee],
              [t('ডেলিভারী খরচ', 'Delivery charge'), bill.deliveryFee],
            ]}
            totalLabel={t('Total Bill', 'Total bill')}
            total={t(`${taka(bill.total)} + বাজারের দাম`, `${taka(bill.total)} + goods`)}
          />
          <QuoteNotice service="bazar" />
          <ConfirmButton error={error} pending={placeOrder.isPending} onConfirm={confirm} label={t('অর্ডার পাঠান', 'Send order')} />
        </>
      }
    >
      <CustomerInfo user={user} />
      <DeliveryHoursNotice service="bazar" windows={catalog.deliveryHours.bazar} />
      <div className="field-pair">
        <AddressField
          label={t('পার্সেল ডেলিভারি ঠিকানা', 'Parcel delivery address')}
          value={draft.place}
          onChange={place => update({ place })}
        />
        <Field label={t('পার্সেল গ্রহীতার মোবাইল', "Parcel receiver's mobile")}>
          <input type="tel" inputMode="tel" value={draft.mobile} onChange={e => update({ mobile: e.target.value })} placeholder="01XXXXXXXXX" />
        </Field>
      </div>
      <DeliverySchedule value={draft.schedule} onChange={schedule => update({ schedule })} />
      <LineTable template="1.7fr .8fr .9fr .8fr" columns={columns} rows={draft.rows} onChange={rows => update({ rows })} addLabel={t('আরো যোগ করতে ক্লিক করুন', 'Click to add more')} />
    </ServiceCard>
  )
}
