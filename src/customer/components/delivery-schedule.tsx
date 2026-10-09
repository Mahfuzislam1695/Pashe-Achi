'use client'

import { isoDateInBd, type ScheduleInput } from '@/shared'

import { useLang } from '@/customer/lib/i18n'
import { Field, InlineField } from './ui'

export const EMPTY_SCHEDULE: ScheduleInput = { date: '', time: '' }

/** ডেলিভারি তারিখ and ডেলিভারি টাইম, required on every service. `inline` matches the parcel screen's label-left rows. */
export function DeliverySchedule({ value, onChange, inline = false }: { value: ScheduleInput; onChange: (value: ScheduleInput) => void; inline?: boolean }) {
  const { t } = useLang()
  const Wrap = inline ? InlineField : Field
  const fields = (
    <>
      <Wrap label={t('ডেলিভারি তারিখ', 'Delivery date')}>
        <input type="date" min={isoDateInBd()} value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} />
      </Wrap>
      <Wrap label={t('ডেলিভারি টাইম', 'Delivery time')}>
        <input type="time" value={value.time} onChange={e => onChange({ ...value, time: e.target.value })} />
      </Wrap>
    </>
  )
  return inline ? fields : <div className="field-pair even">{fields}</div>
}
