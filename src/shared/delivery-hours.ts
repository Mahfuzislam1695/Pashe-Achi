import type { z } from 'zod'

import type { ServiceId, Text } from './enums'
import { TIME_PATTERN, toBnDigits } from './format'
import { SERVICE_LABELS } from './labels'

/** One delivery window, HH:mm to HH:mm, both ends included. */
export type DeliveryWindow = { from: string; to: string }

/** The windows a customer may pick a ডেলিভারি টাইম in, per service. No windows means any time. */
export type DeliveryHours = Record<ServiceId, DeliveryWindow[]>

/** The sketch's কাঁচা বাজার hours; the other services take any time until an admin sets hours in Catalog. */
export const DEFAULT_DELIVERY_HOURS: DeliveryHours = {
  bazar: [
    { from: '08:00', to: '10:00' },
    { from: '18:00', to: '21:00' },
  ],
  shifting: [],
  medicine: [],
  parcel: [],
}

const byStart = (a: DeliveryWindow, b: DeliveryWindow) => a.from.localeCompare(b.from)

/** "08:00-10:00,18:00-21:00" (how a Setting row stores the windows), sorted. */
export const formatDeliveryWindows = (windows: readonly DeliveryWindow[]) =>
  [...windows]
    .sort(byStart)
    .map(window => `${window.from}-${window.to}`)
    .join(',')

/** The reverse of formatDeliveryWindows. Anything malformed is dropped. */
export const parseDeliveryWindows = (value: string): DeliveryWindow[] =>
  value
    .split(',')
    .map(part => part.trim().split('-'))
    .filter((pair): pair is [string, string] => pair.length === 2 && TIME_PATTERN.test(pair[0]!) && TIME_PATTERN.test(pair[1]!) && pair[0]! < pair[1]!)
    .map(([from, to]) => ({ from, to }))
    .sort(byStart)

/**
 * Whether a ডেলিভারি টাইম is allowed. With no windows any time is. A missing or malformed
 * time also passes here, because the schedule schema already reports it as schedule.required.
 */
export const isWithinDeliveryHours = (windows: readonly DeliveryWindow[], time: unknown) =>
  !windows.length || typeof time !== 'string' || !TIME_PATTERN.test(time) || windows.some(window => window.from <= time && time <= window.to)

/**
 * Adds the `schedule.hours` check to an order schema. `when` makes it run even if other fields
 * failed, so the form can still report it in the right order (see FORM_ERROR_PRIORITY).
 */
export const withDeliveryHours = <TSchema extends z.ZodType>(schema: TSchema, windows: readonly DeliveryWindow[]) =>
  schema.refine(value => isWithinDeliveryHours(windows, (value as { schedule?: { time?: unknown } } | undefined)?.schedule?.time), {
    error: 'schedule.hours',
    path: ['schedule', 'time'],
    when: () => true,
  })

const clock = (time: string) => {
  const [hour, minute] = time.split(':').map(Number) as [number, number]
  return { hour, minute, label: `${hour % 12 || 12}${minute ? `:${String(minute).padStart(2, '0')}` : ''}` }
}

/** The Bangla part of day an hour falls in. */
const banglaPeriod = (hour: number) =>
  hour >= 4 && hour < 6 ? 'ভোর' : hour >= 6 && hour < 12 ? 'সকাল' : hour >= 12 && hour < 15 ? 'দুপুর' : hour >= 15 && hour < 18 ? 'বিকাল' : hour >= 18 && hour < 20 ? 'সন্ধ্যা' : 'রাত'

const join = (parts: string[], and: string) => (parts.length > 1 ? `${parts.slice(0, -1).join(', ')} ${and} ${parts.at(-1)}` : (parts[0] ?? ''))

/** "সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯" / "8–10 am and 6–9 pm". */
export function describeDeliveryHours(windows: readonly DeliveryWindow[]): Text {
  const sorted = [...windows].sort(byStart)
  const bn = sorted.map(window => {
    const from = clock(window.from)
    const to = clock(window.to)
    // Name the end's part of day only when it crosses noon: "সকাল ১১ থেকে দুপুর ২", but "সন্ধ্যা ৬ থেকে ৯".
    const end = from.hour < 12 === to.hour < 12 ? toBnDigits(to.label) : `${banglaPeriod(to.hour)} ${toBnDigits(to.label)}`
    return `${banglaPeriod(from.hour)} ${toBnDigits(from.label)} থেকে ${end}`
  })
  const en = sorted.map(window => {
    const from = clock(window.from)
    const to = clock(window.to)
    const half = (hour: number) => (hour < 12 ? 'am' : 'pm')
    return half(from.hour) === half(to.hour) ? `${from.label}–${to.label} ${half(to.hour)}` : `${from.label} ${half(from.hour)}–${to.label} ${half(to.hour)}`
  })
  return { bn: join(bn, 'এবং'), en: join(en, 'and') }
}

/** The notice a service screen shows above its form, or null when the service takes any time. */
export function deliveryHoursNotice(service: ServiceId, windows: readonly DeliveryWindow[]): Text | null {
  if (!windows.length) return null
  const hours = describeDeliveryHours(windows)
  const label = SERVICE_LABELS[service]
  return { bn: `${label.bn} ডেলিভারির সময় সূচী: ${hours.bn} পর্যন্ত।`, en: `${label.en} delivery hours: ${hours.en}.` }
}
