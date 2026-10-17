'use client'

import { type DeliveryWindow, deliveryHoursNotice, isoDateInBd, type ScheduleInput, type ServiceId } from '@/shared'
import { Clock } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'
import { Field, InlineField } from './ui'

export const EMPTY_SCHEDULE: ScheduleInput = { date: '', time: '' }

/**
 * ডেলিভারি তারিখ and ডেলিভারি টাইম, required on every service. `inline` matches the parcel screen's
 * label-left rows; shifting passes its own labels (শিফটিং এর তারিখ / সময়).
 */
export function DeliverySchedule({
  value,
  onChange,
  inline = false,
  dateLabel,
  timeLabel,
}: {
  value: ScheduleInput
  onChange: (value: ScheduleInput) => void
  inline?: boolean
  dateLabel?: string
  timeLabel?: string
}) {
  const { t } = useLang()
  const Wrap = inline ? InlineField : Field
  const fields = (
    <>
      <Wrap label={dateLabel ?? t('ডেলিভারি তারিখ', 'Delivery date')}>
        <input type="date" min={isoDateInBd()} value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} />
      </Wrap>
      <Wrap label={timeLabel ?? t('ডেলিভারি টাইম', 'Delivery time')}>
        <input type="time" value={value.time} onChange={e => onChange({ ...value, time: e.target.value })} />
      </Wrap>
    </>
  )
  return inline ? fields : <div className="field-pair even">{fields}</div>
}

/** "কাঁচা বাজার ডেলিভারির সময় সূচী: …", built from the hours set in the admin Catalog. Nothing when the service takes any time. */
export function DeliveryHoursNotice({ service, windows, className }: { service: ServiceId; windows: readonly DeliveryWindow[]; className?: string }) {
  const { text } = useLang()
  const notice = deliveryHoursNotice(service, windows)
  if (!notice) return null
  return (
    <p className={className ? `notice ${className}` : 'notice'}>
      <Clock size={16} />
      <span>{text(notice)}</span>
    </p>
  )
}
