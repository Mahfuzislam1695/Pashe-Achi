'use client'

import { type DeliveryWindow, deliveryHoursNotice, deliverySlots, describeTime, isoDateInBd, type ScheduleInput, type ServiceId } from '@/shared'
import { Clock } from 'lucide-react'

import { useLang } from '@/customer/lib/i18n'
import { Field, InlineField } from './ui'

export const EMPTY_SCHEDULE: ScheduleInput = { date: '', time: '' }

/**
 * ডেলিভারি তারিখ and ডেলিভারি টাইম, required on every service. `inline` matches the parcel screen's
 * label-left rows; shifting passes its own labels (শিফটিং এর তারিখ / সময়). With delivery hours
 * (`windows`) the time is picked from the slots inside them; with none any time can be typed.
 */
export function DeliverySchedule({
  value,
  onChange,
  windows = [],
  inline = false,
  dateLabel,
  timeLabel,
}: {
  value: ScheduleInput
  onChange: (value: ScheduleInput) => void
  windows?: readonly DeliveryWindow[]
  inline?: boolean
  dateLabel?: string
  timeLabel?: string
}) {
  const { t, text } = useLang()
  const Wrap = inline ? InlineField : Field
  const slots = deliverySlots(windows)
  const setTime = (time: string) => onChange({ ...value, time })
  const fields = (
    <>
      <Wrap label={dateLabel ?? t('ডেলিভারি তারিখ', 'Delivery date')}>
        <input type="date" min={isoDateInBd()} value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} />
      </Wrap>
      <Wrap label={timeLabel ?? t('ডেলিভারি টাইম', 'Delivery time')}>
        {slots.length ? (
          // A time outside the slots (an old draft, or hours changed in Catalog) shows as unpicked.
          <select value={slots.includes(value.time) ? value.time : ''} onChange={e => setTime(e.target.value)}>
            <option value="">{t('টাইম বাছুন', 'Choose a time')}</option>
            {slots.map(slot => (
              <option key={slot} value={slot}>
                {text(describeTime(slot))}
              </option>
            ))}
          </select>
        ) : (
          <input type="time" value={value.time} onChange={e => setTime(e.target.value)} />
        )}
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
