'use client'

import { calcShifting, createShiftingOrderSchema, FORM_ERROR_PRIORITY, type MessageCode, type ScheduleInput, toAmount, validateForm } from '@/shared'
import { useState } from 'react'

import { AddressField, addressPin, addressText, type AddressValue, fromMyLocation } from '@/customer/components/address-field'
import { ServiceBanner } from '@/customer/components/banner'
import { DeliveryHoursNotice, DeliverySchedule, EMPTY_SCHEDULE } from '@/customer/components/delivery-schedule'
import { BillSummary, ConfirmButton, CustomerInfo, Field, ServiceCard } from '@/customer/components/ui'
import { api } from '@/customer/lib/api'
import { useDraft } from '@/customer/lib/drafts'
import { useLang } from '@/customer/lib/i18n'
import { errorCode, usePlaceOrder, useSession } from '@/customer/lib/queries'

type ShiftingDraft = {
  loading: AddressValue
  unloading: AddressValue
  schedule: ScheduleInput
  vehicleId: string
  labourers: string
  loadingFloor: string
  unloadingFloor: string
}
const PRIORITY = FORM_ERROR_PRIORITY.shifting
// The shifting page never says ডেলিভারি, so the shared schedule errors get its own wording.
const SHIFTING_WORDING: Partial<Record<MessageCode, MessageCode>> = { 'schedule.required': 'shifting.schedule_required' }

function StepRow({ n, label, rateLabel, rate, children }: { n: number; label: string; rateLabel: string; rate: number; children: React.ReactNode }) {
  const { digits, taka } = useLang()
  return (
    <div className="step-row">
      <span className="step-no">{digits(n)}</span>
      <Field label={label}>{children}</Field>
      <div className="field">
        <span>{rateLabel}</span>
        <div className="fixed-rate">{taka(rate)}</div>
      </div>
    </div>
  )
}

export function ShiftingScreen() {
  const { t, text } = useLang()
  const { user, catalog } = useSession()
  const { pricing, vehicles } = catalog
  const [draft, setDraft] = useDraft<ShiftingDraft>('shifting', () => ({
    loading: fromMyLocation(user.location),
    unloading: null,
    schedule: EMPTY_SCHEDULE,
    vehicleId: vehicles[0]?.id ?? '',
    labourers: '1',
    loadingFloor: '1',
    unloadingFloor: '1',
  }))
  const [showError, setShowError] = useState(false)
  const placeOrder = usePlaceOrder(api.orders.createShifting)

  const update = (patch: Partial<ShiftingDraft>) => {
    setDraft(current => ({ ...current, ...patch }))
    if (placeOrder.isError) placeOrder.reset()
  }

  // A vehicle the admin has since disabled falls back to the first available one.
  const vehicle = vehicles.find(option => option.id === draft.vehicleId) ?? vehicles[0]
  const bill = calcShifting(pricing, { vehicleRate: vehicle?.rate ?? 0, ...draft })
  const check = validateForm(
    createShiftingOrderSchema,
    {
      loadingArea: addressText(draft.loading),
      unloadingArea: addressText(draft.unloading),
      loadingPin: addressPin(draft.loading),
      unloadingPin: addressPin(draft.unloading),
      schedule: draft.schedule,
      vehicleId: vehicle?.id ?? '',
      labourers: toAmount(draft.labourers),
      loadingFloor: toAmount(draft.loadingFloor),
      unloadingFloor: toAmount(draft.unloadingFloor),
    },
    PRIORITY,
  )
  const rawError = placeOrder.isError ? errorCode(placeOrder.error, PRIORITY) : showError && !check.success ? check.code : null
  const error = (rawError && SHIFTING_WORDING[rawError]) ?? rawError

  const confirm = () => {
    if (!check.success) return setShowError(true)
    placeOrder.mutate(check.data, {
      onSuccess: () => {
        setDraft(current => ({ ...current, loading: fromMyLocation(user.location), unloading: null, schedule: EMPTY_SCHEDULE }))
        setShowError(false)
      },
    })
  }

  return (
    <ServiceCard
      id="shifting"
      banner={<ServiceBanner id="shifting" />}
      summary={
        <>
          <BillSummary lines={[]} totalLabel={t('Total cost', 'Total cost')} total={bill.total} />
          <ConfirmButton error={error} pending={placeOrder.isPending} onConfirm={confirm} />
        </>
      }
    >
      <CustomerInfo user={user} showPoints={false} />
      <DeliveryHoursNotice service="shifting" windows={catalog.deliveryHours.shifting} />
      <div className="field-pair even">
        <AddressField
          label={t('Loading Area', 'Loading area')}
          value={draft.loading}
          onChange={loading => update({ loading })}
        />
        <AddressField
          label={t('Unloading Area', 'Unloading area')}
          value={draft.unloading}
          onChange={unloading => update({ unloading })}
        />
      </div>
      <DeliverySchedule
       
        value={draft.schedule}
        onChange={schedule => update({ schedule })}
        dateLabel={t('শিফটিং এর তারিখ', 'Shifting date')}
        timeLabel={t('শিফটিং এর সময়', 'Shifting time')}
      />
      <div className="steps">
        <StepRow n={1} label={t('গাড়ী', 'Vehicle')} rateLabel={t('রেট', 'Rate')} rate={vehicle?.rate ?? 0}>
          <select value={vehicle?.id ?? ''} onChange={e => update({ vehicleId: e.target.value })} disabled={!vehicles.length}>
            {vehicles.map(option => (
              <option key={option.id} value={option.id}>
                {text(option.name)}
              </option>
            ))}
          </select>
        </StepRow>
        <StepRow n={2} label={t('লেবার সংখ্যা', 'Number of labourers')} rateLabel={t('জনপ্রতি মজুরী', 'Wage per person')} rate={pricing.wagePerLabourer}>
          <input type="number" min={0} inputMode="numeric" value={draft.labourers} onChange={e => update({ labourers: e.target.value })} />
        </StepRow>
        <StepRow n={3} label={t('ফ্লোর নং (loading)', 'Floor no. (loading)')} rateLabel={t('প্রতি ফ্লোর', 'Per floor')} rate={pricing.loadingRatePerFloor}>
          <input type="number" min={0} inputMode="numeric" value={draft.loadingFloor} onChange={e => update({ loadingFloor: e.target.value })} />
        </StepRow>
        <StepRow n={4} label={t('ফ্লোর নং (unloading)', 'Floor no. (unloading)')} rateLabel={t('প্রতি ফ্লোর', 'Per floor')} rate={pricing.unloadingRatePerFloor}>
          <input type="number" min={0} inputMode="numeric" value={draft.unloadingFloor} onChange={e => update({ unloadingFloor: e.target.value })} />
        </StepRow>
      </div>
    </ServiceCard>
  )
}
