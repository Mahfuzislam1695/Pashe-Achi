'use client'

import { createParcelOrderSchema, FORM_ERROR_PRIORITY, type ScheduleInput, validateForm, withDeliveryHours } from '@/shared'
import { useState } from 'react'

import { AddressField, addressPin, addressText, type AddressValue, fromMyLocation } from '@/customer/components/address-field'
import { ServiceBanner } from '@/customer/components/banner'
import { DeliveryHoursNotice, DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { ConfirmButton, CustomerInfo, InlineField, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type ParcelFields = { product: string; weight: string; receiverMobile: string }
type ParcelDraft = ParcelFields & { pickup: AddressValue; dropoff: AddressValue; schedule: ScheduleInput }
const PRIORITY = FORM_ERROR_PRIORITY.parcel

export function ParcelScreen() {
  const { t, taka } = useLang()
  const { user, catalog } = useSession()
  // The pickup starts at the customer's own location.
  const empty = (): ParcelDraft => ({ product: '', weight: '', pickup: fromMyLocation(user.location), dropoff: null, receiverMobile: '', schedule: EMPTY_SCHEDULE })
  const [draft, setDraft] = useDraft<ParcelDraft>('parcel', empty)
  const [showError, setShowError] = useState(false)
  const placeOrder = usePlaceOrder(api.orders.createParcel)

  const update = (patch: Partial<ParcelDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }
  const bind = (key: keyof ParcelFields) => ({ value: draft[key], onChange: (e: React.ChangeEvent<HTMLInputElement>) => update({ [key]: e.target.value }) })

  const check = validateForm(
    withDeliveryHours(createParcelOrderSchema, catalog.deliveryHours.parcel),
    {
      product: draft.product,
      weight: draft.weight || undefined,
      pickupAddress: addressText(draft.pickup),
      dropoffAddress: addressText(draft.dropoff),
      pickupPin: addressPin(draft.pickup),
      dropoffPin: addressPin(draft.dropoff),
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
        setDraft(empty())
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard id="parcel" banner={<ServiceBanner id="parcel" />}>
      <CustomerInfo user={user} />
      <DeliveryHoursNotice service="parcel" windows={catalog.deliveryHours.parcel} />
      <div className="field-rows">
        <InlineField label={t('পণ্যের নাম', 'Product name')}>
          <input {...bind('product')} placeholder={t('যেমন: কাপড়ের ব্যাগ', 'e.g. Bag of clothes')} />
        </InlineField>
        <InlineField label={t('পণ্যের ওজন', 'Product weight')}>
          <input {...bind('weight')} placeholder={t('যেমন: ২ কেজি', 'e.g. 2 kg')} />
        </InlineField>
        <AddressField
          inline
          label={t('গ্রহণের ঠিকানা', 'Pickup address')}
          value={draft.pickup}
          onChange={pickup => update({ pickup })}
          myLocation={user.location}
        />
        <AddressField
          inline
          label={t('পৌঁছানোর ঠিকানা', 'Delivery address')}
          value={draft.dropoff}
          onChange={dropoff => update({ dropoff })}
          myLocation={user.location}
        />
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
