'use client'

import { createParcelOrderSchema, FORM_ERROR_PRIORITY, type ScheduleInput, validateForm } from '@/shared'
import { useState } from 'react'

import { DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { ConfirmButton, CustomerInfo, InlineField, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type ParcelFields = { product: string; weight: string; pickup: string; dropoff: string; receiverMobile: string }
type ParcelDraft = ParcelFields & { schedule: ScheduleInput }
const EMPTY: ParcelDraft = { product: '', weight: '', pickup: '', dropoff: '', receiverMobile: '', schedule: EMPTY_SCHEDULE }
const PRIORITY = FORM_ERROR_PRIORITY.parcel

export function ParcelScreen() {
  const { t, taka } = useLang()
  const { user, catalog } = useSession()
  const [draft, setDraft] = useDraft<ParcelDraft>('parcel', () => EMPTY)
  const [showError, setShowError] = useState(false)
  const placeOrder = usePlaceOrder(api.orders.createParcel)

  const update = (patch: Partial<ParcelDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }
  const bind = (key: keyof ParcelFields) => ({ value: draft[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => update({ [key]: e.target.value }) })

  const check = validateForm(
    createParcelOrderSchema,
    {
      product: draft.product,
      weight: draft.weight || undefined,
      pickupAddress: draft.pickup,
      dropoffAddress: draft.dropoff,
      receiverMobile: draft.receiverMobile,
      schedule: draft.schedule,
    },
    PRIORITY,
  )
  const error = placeOrder.isError ? errorCode(placeOrder.error, PRIORITY) : showError && !check.success ? check.code : null

  const confirm = () => {
    if (!check.success) return setShowError(true)
    placeOrder.mutate(check.data, {
      onSuccess: () => {
        setDraft(EMPTY)
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard id="parcel">
      <CustomerInfo user={user} />
      <div className="field-rows">
        <InlineField label={t('পণ্যের নাম', 'Product name')}>
          <input {...bind('product')} placeholder={t('যেমন: কাপড়ের ব্যাগ', 'e.g. Bag of clothes')} />
        </InlineField>
        <InlineField label={t('পণ্যের ওজন', 'Product weight')}>
          <input {...bind('weight')} placeholder={t('যেমন: ২ কেজি', 'e.g. 2 kg')} />
        </InlineField>
        <InlineField label={t('গ্রহণের ঠিকানা', 'Pickup address')}>
          <input {...bind('pickup')} placeholder={t('কোথা থেকে নেওয়া হবে', 'Where to collect it')} />
        </InlineField>
        <InlineField label={t('পৌঁছানোর ঠিকানা', 'Delivery address')}>
          <input {...bind('dropoff')} placeholder={t('কোথায় পৌঁছাতে হবে', 'Where to deliver it')} />
        </InlineField>
        <InlineField label={t('গ্রহীতার মোবা', "Receiver's mobile")}>
          <input type="tel" inputMode="tel" {...bind('receiverMobile')} placeholder="01XXXXXXXXX" />
        </InlineField>
        <DeliverySchedule inline value={draft.schedule} onChange={schedule => update({ schedule })} />
        <div className="field-row charge">
          <span>{t('ডেলিভারী খরচ', 'Delivery charge')}</span>
          <div className="fixed-rate">{taka(catalog.pricing.parcelDeliveryFee)}</div>
        </div>
      </div>
      <ConfirmButton error={error} pending={placeOrder.isPending} onConfirm={confirm} />
    </ServiceCard>
  )
}
