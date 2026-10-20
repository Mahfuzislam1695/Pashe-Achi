import { describe, expect, it } from 'vitest'

import {
  DEFAULT_DELIVERY_HOURS,
  deliveryHoursNotice,
  deliverySlots,
  describeDeliveryHours,
  describeTime,
  formatDeliveryWindows,
  isWithinDeliveryHours,
  parseDeliveryWindows,
  withDeliveryHours,
} from './delivery-hours'
import { isoDateInBd } from './format'
import { deliveryHoursSchema } from './schemas/admin'
import { createBazarOrderSchema, FORM_ERROR_PRIORITY } from './schemas/orders'
import { validateForm } from './validate'

const bazar = DEFAULT_DELIVERY_HOURS.bazar

describe('delivery hours text', () => {
  it('reproduces the sketch notice for the default bazar hours', () => {
    expect(deliveryHoursNotice('bazar', bazar)).toEqual({
      bn: 'কাঁচা বাজার ডেলিভারির সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।',
      en: 'Fresh market delivery hours: 8–10 am and 6–9 pm.',
    })
  })

  it('never says delivery on the shifting notice', () => {
    expect(deliveryHoursNotice('shifting', bazar)).toEqual({
      bn: 'বাসা বদলের সময় সূচী: সকাল ৮ থেকে ১০ এবং সন্ধ্যা ৬ থেকে ৯ পর্যন্ত।',
      en: 'House shifting hours: 8–10 am and 6–9 pm.',
    })
  })

  it('shows no notice for a service without hours', () => {
    expect(deliveryHoursNotice('parcel', [])).toBeNull()
  })

  it('shows minutes and names both ends when a window crosses noon', () => {
    expect(describeDeliveryHours([{ from: '11:30', to: '14:00' }])).toEqual({ bn: 'সকাল ১১:৩০ থেকে দুপুর ২', en: '11:30 am–2 pm' })
  })

  it('lists three windows in start order', () => {
    const windows = [
      { from: '20:00', to: '22:00' },
      { from: '07:00', to: '09:00' },
      { from: '15:00', to: '17:00' },
    ]
    expect(describeDeliveryHours(windows)).toEqual({ bn: 'সকাল ৭ থেকে ৯, বিকাল ৩ থেকে ৫ এবং রাত ৮ থেকে ১০', en: '7–9 am, 3–5 pm and 8–10 pm' })
  })
})

describe('isWithinDeliveryHours', () => {
  it('includes both ends of a window', () => {
    expect(isWithinDeliveryHours(bazar, '08:00')).toBe(true)
    expect(isWithinDeliveryHours(bazar, '10:00')).toBe(true)
    expect(isWithinDeliveryHours(bazar, '21:00')).toBe(true)
  })

  it('rejects times between and outside the windows', () => {
    expect(isWithinDeliveryHours(bazar, '10:01')).toBe(false)
    expect(isWithinDeliveryHours(bazar, '12:00')).toBe(false)
    expect(isWithinDeliveryHours(bazar, '07:59')).toBe(false)
  })

  it('accepts any time when the service has no windows, and leaves a missing time to schedule.required', () => {
    expect(isWithinDeliveryHours([], '03:00')).toBe(true)
    expect(isWithinDeliveryHours(bazar, '')).toBe(true)
  })
})

describe('stored form', () => {
  it('round-trips through the Setting value, sorted', () => {
    const value = formatDeliveryWindows([...bazar].reverse())
    expect(value).toBe('08:00-10:00,18:00-21:00')
    expect(parseDeliveryWindows(value)).toEqual(bazar)
    expect(parseDeliveryWindows('')).toEqual([])
  })

  it('drops malformed windows', () => {
    expect(parseDeliveryWindows('10:00-08:00,junk,25:00-26:00,09:00-11:00')).toEqual([{ from: '09:00', to: '11:00' }])
  })
})

describe('schemas', () => {
  const order = {
    address: 'Mirpur 10',
    addressPin: { lat: 23.807, lng: 90.368 },
    contactMobile: '01711111111',
    schedule: { date: isoDateInBd(), time: '12:00' },
    items: [{ name: 'আলু', quantity: '1 কেজি' }],
  }

  it('reports schedule.hours for an order outside the delivery hours', () => {
    const check = validateForm(withDeliveryHours(createBazarOrderSchema, bazar), order, FORM_ERROR_PRIORITY.bazar)
    expect(check).toEqual({ success: false, code: 'schedule.hours' })
    expect(validateForm(withDeliveryHours(createBazarOrderSchema, bazar), { ...order, schedule: { ...order.schedule, time: '09:00' } }, FORM_ERROR_PRIORITY.bazar).success).toBe(true)
  })

  it('still reports earlier problems first', () => {
    const check = validateForm(withDeliveryHours(createBazarOrderSchema, bazar), { ...order, address: '' }, FORM_ERROR_PRIORITY.bazar)
    expect(check).toEqual({ success: false, code: 'bazar.details' })
  })

  it('rejects admin windows that end before they start or overlap', () => {
    const base = { bazar: [], shifting: [], medicine: [], parcel: [] }
    expect(deliveryHoursSchema.safeParse({ ...base, bazar }).success).toBe(true)
    expect(deliveryHoursSchema.safeParse({ ...base, bazar: [{ from: '10:00', to: '08:00' }] }).success).toBe(false)
    expect(deliveryHoursSchema.safeParse({ ...base, bazar: [{ from: '08:00', to: '12:00' }, { from: '11:00', to: '13:00' }] }).success).toBe(false)
    expect(deliveryHoursSchema.safeParse({ ...base, bazar: [{ from: '', to: '' }] }).success).toBe(false)
  })
})

describe('delivery time slots', () => {
  it('offers every half hour inside the default bazar hours, both ends included', () => {
    const slots = deliverySlots(bazar)
    expect(slots).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'])
    expect(slots.every(slot => isWithinDeliveryHours(bazar, slot))).toBe(true)
  })

  it('offers no slots when the service takes any time', () => {
    expect(deliverySlots([])).toEqual([])
  })

  it('names each slot in both languages', () => {
    expect(describeTime('18:30')).toEqual({ bn: 'সন্ধ্যা ৬:৩০', en: '6:30 pm' })
    expect(describeTime('08:00')).toEqual({ bn: 'সকাল ৮:০০', en: '8:00 am' })
  })
})
