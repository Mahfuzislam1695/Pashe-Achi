import { describe, expect, it } from 'vitest'

import { isoDateInBd, normalizeMobile } from '../format'
import { pickIssueCode } from '../messages'
import { adminNextStatuses, isAwaitingPrice } from '../enums'
import { joinAddress, mapLink, toGeoPoint } from '../geo'
import { loginSchema, signupSchema } from './auth'
import { customerLocationSchema, geoPointSchema, reverseGeocodeQuerySchema } from './locations'
import { offerSchema, updateOfferSchema } from './offers'
import {
  confirmOrderSchema,
  createBazarOrderSchema,
  createMedicineOrderSchema,
  createParcelOrderSchema,
  createShiftingOrderSchema,
  FORM_ERROR_PRIORITY,
  quoteOrderSchema,
  shiftingQuoteSchema,
} from './orders'
import { deviceRemoveSchema, deviceTokenSchema, isPushEndpoint, pushSubscriptionSchema } from './push'

const today = isoDateInBd()
const schedule = { date: today, time: '09:30' }
const codes = (result: { success: boolean; error?: { issues: { message: string }[] } }) => result.error?.issues.map(issue => issue.message) ?? []
/** Every address is picked on the map, so orders carry a pin for each one. */
const pin = { lat: 23.807, lng: 90.368 }

describe('mobile numbers', () => {
  it('normalises +880, spaces and Bengali digits', () => {
    expect(normalizeMobile('+880 1712-345678')).toBe('01712345678')
    expect(normalizeMobile('০১৭১২৩৪৫৬৭৮')).toBe('01712345678')
    expect(normalizeMobile('8801812345678')).toBe('01812345678')
    expect(normalizeMobile('1912345678')).toBe('01912345678')
  })

  it('stores the normalised number', () => {
    expect(loginSchema.parse({ mobile: '+8801712345678', password: 'x' }).mobile).toBe('01712345678')
  })

  it('accepts every operator prefix, 013 to 019', () => {
    for (const prefix of ['013', '014', '015', '016', '017', '018', '019']) expect(loginSchema.safeParse({ mobile: `${prefix}12345678` }).success).toBe(true)
  })

  it('rejects numbers that are not Bangladeshi mobiles', () => {
    for (const mobile of ['0123', '01212345678', '01112345678', '0171234567', '017123456789', '+8811712345678', '01712abc678', '1212345678'])
      expect(codes(loginSchema.safeParse({ mobile }))).toContain('mobile.invalid')
  })
})

describe('login', () => {
  it('needs only the mobile number (the password is up to the super admin)', () => {
    expect(loginSchema.parse({ mobile: '01712345678' })).toEqual({ mobile: '01712345678' })
    expect(pickIssueCode(codes(loginSchema.safeParse({ mobile: '01712345678', password: '' })), FORM_ERROR_PRIORITY.login)).toBe('password.required')
  })
})

describe('signup', () => {
  it('reports missing fields with the sketch message first', () => {
    const result = signupSchema.safeParse({ name: '', mobile: '', password: '' })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.signup)).toBe('auth.signup')
  })

  const location = { address: 'Mirpur 10, Dhaka', ...pin }

  it('requires 6+ character passwords', () => {
    const result = signupSchema.safeParse({ name: 'Rahim', mobile: '01712345678', location, password: '123' })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.signup)).toBe('password.short')
  })

  it('requires a location picked on the map', () => {
    const signup = { name: 'Rahim', mobile: '01712345678', password: 'secret12' }
    expect(pickIssueCode(codes(signupSchema.safeParse(signup)), FORM_ERROR_PRIORITY.signup)).toBe('location.required')
    expect(pickIssueCode(codes(signupSchema.safeParse({ ...signup, location: { address: 'Mirpur 10' } })), FORM_ERROR_PRIORITY.signup)).toBe('field.invalid')
    expect(signupSchema.parse({ ...signup, location }).location).toEqual(location)
  })

  it('accepts no password (the mobile number becomes it while the switch is off)', () => {
    expect(signupSchema.safeParse({ name: 'Rahim', mobile: '01712345678', location }).success).toBe(true)
  })
})

describe('bazar order', () => {
  const valid = { address: 'House 1, Mirpur', addressPin: pin, contactMobile: '01712345678', schedule, items: [{ name: 'আলু', quantity: '1 কেজি' }] }

  it('accepts a minimal order', () => {
    expect(createBazarOrderSchema.safeParse(valid).success).toBe(true)
  })

  it('reports an incomplete row before missing details', () => {
    const result = createBazarOrderSchema.safeParse({ ...valid, address: '', items: [{ name: 'আলু', quantity: '' }] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.bazar)).toBe('bazar.rows')
  })

  it('requires at least one row', () => {
    const result = createBazarOrderSchema.safeParse({ ...valid, items: [] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.bazar)).toBe('bazar.details')
  })

  it('requires a map pin for the address', () => {
    expect(createBazarOrderSchema.parse(valid).addressPin).toEqual(pin)
    expect(pickIssueCode(codes(createBazarOrderSchema.safeParse({ ...valid, addressPin: undefined })), FORM_ERROR_PRIORITY.bazar)).toBe('location.required')
    expect(codes(createBazarOrderSchema.safeParse({ ...valid, addressPin: { lat: 123, lng: 90.4 } }))).toContain('field.invalid')
  })

  it('requires a schedule that is not in the past', () => {
    expect(pickIssueCode(codes(createBazarOrderSchema.safeParse({ ...valid, schedule: { date: '', time: '' } })), FORM_ERROR_PRIORITY.bazar)).toBe('schedule.required')
    expect(pickIssueCode(codes(createBazarOrderSchema.safeParse({ ...valid, schedule: { date: '2000-01-01', time: '09:00' } })), FORM_ERROR_PRIORITY.bazar)).toBe(
      'schedule.past',
    )
  })
})

describe('medicine order', () => {
  const base = { address: 'House 1', addressPin: pin, contactMobile: '01712345678', schedule, items: [] }

  it('needs a prescription or a medicine row', () => {
    expect(pickIssueCode(codes(createMedicineOrderSchema.safeParse(base)), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.details')
    expect(createMedicineOrderSchema.safeParse({ ...base, prescriptionUploadId: 'upl_1' }).success).toBe(true)
  })

  it('reports the prescription rule even when the schedule is also missing', () => {
    const result = createMedicineOrderSchema.safeParse({ ...base, schedule: { date: '', time: '' } })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.details')
  })

  it('requires all four columns, and no price', () => {
    const result = createMedicineOrderSchema.safeParse({ ...base, items: [{ name: 'Napa', quantity: '1', company: 'Beximco', category: '' }] })
    expect(pickIssueCode(codes(result), FORM_ERROR_PRIORITY.medicine)).toBe('medicine.rows')
    const parsed = createMedicineOrderSchema.parse({ ...base, items: [{ name: 'Napa', quantity: '1', company: 'Beximco', category: 'জ্বর', price: 5 }] })
    expect(parsed.items[0]).not.toHaveProperty('price')
  })
})

describe('quotes', () => {
  it('drops any price a customer sends with a bazar line', () => {
    const parsed = createBazarOrderSchema.parse({ address: 'House 1', addressPin: pin, contactMobile: '01712345678', schedule, items: [{ name: 'আলু', quantity: '1 কেজি', price: 1 }] })
    expect(parsed.items[0]).toEqual({ name: 'আলু', quantity: '1 কেজি' })
  })

  it('needs a name, quantity and price on every quoted line', () => {
    expect(quoteOrderSchema.safeParse({ items: [{ id: 'a', name: 'আলু', quantity: '1 কেজি', price: 60 }, { name: 'ডিম', quantity: '12', price: 150 }] }).success).toBe(true)
    expect(pickIssueCode(codes(quoteOrderSchema.safeParse({ items: [{ id: 'a', name: 'আলু', quantity: '1 কেজি' }] })), FORM_ERROR_PRIORITY.quote)).toBe('quote.items')
    expect(pickIssueCode(codes(quoteOrderSchema.safeParse({ items: [] })), FORM_ERROR_PRIORITY.quote)).toBe('quote.items')
  })

  it('lets staff set the shopping fee and delivery charge, or leave them as they are', () => {
    const items = [{ name: 'আলু', quantity: '1 কেজি', price: 60 }]
    expect(quoteOrderSchema.parse({ items, serviceFee: 0, deliveryFee: 120 })).toMatchObject({ serviceFee: 0, deliveryFee: 120 })
    expect(quoteOrderSchema.parse({ items })).not.toHaveProperty('deliveryFee')
    expect(pickIssueCode(codes(quoteOrderSchema.safeParse({ items, deliveryFee: -5 })), FORM_ERROR_PRIORITY.quote)).toBe('quote.fees')
    // A blank box in the editor is sent as null: an error, not "keep the old fee".
    expect(pickIssueCode(codes(quoteOrderSchema.safeParse({ items, serviceFee: null })), FORM_ERROR_PRIORITY.quote)).toBe('quote.fees')
    expect(pickIssueCode(codes(quoteOrderSchema.safeParse({ items: [], deliveryFee: -5 })), FORM_ERROR_PRIORITY.quote)).toBe('quote.items')
  })

  it('confirms the exact quote the customer saw', () => {
    expect(confirmOrderSchema.safeParse({ total: 880, quoteVersion: 2 }).success).toBe(true)
    expect(confirmOrderSchema.safeParse({ total: 880 }).success).toBe(false)
    expect(confirmOrderSchema.safeParse({ total: -1, quoteVersion: 1 }).success).toBe(false)
  })

  it('needs a valid vehicle rent in a shifting quote', () => {
    expect(shiftingQuoteSchema.parse({ vehicleRate: 1500, note: 'মিরপুর থেকে উত্তরা' })).toEqual({ vehicleRate: 1500, note: 'মিরপুর থেকে উত্তরা' })
    expect(pickIssueCode(codes(shiftingQuoteSchema.safeParse({})), FORM_ERROR_PRIORITY.shiftingQuote)).toBe('quote.vehicle')
    expect(pickIssueCode(codes(shiftingQuoteSchema.safeParse({ vehicleRate: -1 })), FORM_ERROR_PRIORITY.shiftingQuote)).toBe('quote.vehicle')
    expect(pickIssueCode(codes(shiftingQuoteSchema.safeParse({ vehicleRate: 12.5 })), FORM_ERROR_PRIORITY.shiftingQuote)).toBe('quote.vehicle')
  })

  it('lets staff leave PENDING only through a quote for bazar, medicine and shifting', () => {
    expect(adminNextStatuses('bazar', 'PENDING')).toEqual(['CANCELLED'])
    expect(adminNextStatuses('medicine', 'QUOTED')).toEqual(['CANCELLED'])
    expect(adminNextStatuses('shifting', 'PENDING')).toEqual(['CANCELLED'])
    expect(adminNextStatuses('parcel', 'PENDING')).toEqual(['BOOKED', 'CANCELLED'])
    expect(adminNextStatuses('bazar', 'BOOKED')).toContain('IN_PROGRESS')
    expect(isAwaitingPrice('bazar', 'PENDING')).toBe(true)
    expect(isAwaitingPrice('shifting', 'PENDING')).toBe(true)
    expect(isAwaitingPrice('shifting', 'QUOTED')).toBe(false)
    expect(isAwaitingPrice('parcel', 'PENDING')).toBe(false)
  })
})

describe('offers', () => {
  const offer = { titleBn: 'সবজিতে ১০% ছাড়', startsOn: today, endsOn: today }

  it('needs a Bangla title and dates in order', () => {
    expect(offerSchema.safeParse(offer).success).toBe(true)
    expect(pickIssueCode(codes(offerSchema.safeParse({ ...offer, titleBn: ' ' })), FORM_ERROR_PRIORITY.offer)).toBe('offer.title')
    expect(pickIssueCode(codes(offerSchema.safeParse({ ...offer, endsOn: '2000-01-01' })), FORM_ERROR_PRIORITY.offer)).toBe('offer.dates')
    expect(pickIssueCode(codes(offerSchema.safeParse({ ...offer, startsOn: 'tomorrow' })), FORM_ERROR_PRIORITY.offer)).toBe('offer.dates')
  })

  it('updates any subset, still checking dates given together', () => {
    expect(updateOfferSchema.parse({ isActive: false })).toEqual({ isActive: false })
    expect(updateOfferSchema.safeParse({ startsOn: '2026-10-10', endsOn: '2026-10-01' }).success).toBe(false)
  })
})

describe('push subscriptions', () => {
  const keys = { p256dh: 'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM', auth: 'tBHItJI5svbpez7KI4CCXg' }

  it("accepts the browsers' push services", () => {
    for (const endpoint of [
      'https://fcm.googleapis.com/fcm/send/abc:APA91b',
      'https://updates.push.services.mozilla.com/wpush/v2/gAAAA',
      'https://web.push.apple.com/QGuQyavXutnMH',
      'https://wns2-par02p.notify.windows.com/w/?token=BQYAAA',
    ]) {
      expect(pushSubscriptionSchema.safeParse({ endpoint, keys, lang: 'en' }).success).toBe(true)
    }
    expect(pushSubscriptionSchema.parse({ endpoint: 'https://fcm.googleapis.com/fcm/send/x', keys }).lang).toBe('bn')
  })

  it('refuses any other address, so the server never posts to an internal one', () => {
    for (const endpoint of [
      'http://fcm.googleapis.com/fcm/send/x',
      'https://localhost/push',
      'https://169.254.169.254/latest/meta-data',
      'https://fcm.googleapis.com.evil.example/x',
      'https://evilgoogleapis.com/x',
      'https://fcm.googleapis.com:8443/x',
      'https://user:pass@fcm.googleapis.com/x',
      'not a url',
    ]) {
      expect(codes(pushSubscriptionSchema.safeParse({ endpoint, keys }))).toContain('push.endpoint')
    }
    expect(isPushEndpoint('https://FCM.GOOGLEAPIS.COM/fcm/send/x')).toBe(true)
  })

  it('needs base64url keys', () => {
    expect(codes(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/x', keys: { p256dh: 'not base64!', auth: keys.auth } }))).toContain('push.endpoint')
  })
})

describe('app phones (FCM tokens)', () => {
  const token = 'dGVzdA:APA91bH' + 'x'.repeat(140)

  it('takes the token, the platform and the language (Bangla unless told otherwise)', () => {
    expect(deviceTokenSchema.parse({ token, platform: 'android' })).toEqual({ token, platform: 'android', lang: 'bn' })
    expect(deviceTokenSchema.parse({ token: ` ${token} `, platform: 'ios', lang: 'en', appVersion: '1.0.0+1' })).toEqual({ token, platform: 'ios', lang: 'en', appVersion: '1.0.0+1' })
  })

  it('refuses an empty token, an unknown platform or a token that is far too long', () => {
    expect(deviceTokenSchema.safeParse({ token: '  ', platform: 'android' }).success).toBe(false)
    expect(deviceTokenSchema.safeParse({ token, platform: 'web' }).success).toBe(false)
    expect(deviceTokenSchema.safeParse({ token: 'x'.repeat(4097), platform: 'android' }).success).toBe(false)
    expect(deviceRemoveSchema.parse({ token })).toEqual({ token })
  })
})

describe('parcel order', () => {
  const order = { product: 'Bag', pickupAddress: 'Mirpur 10', dropoffAddress: 'Uttara', receiverMobile: '01712345678', schedule }

  it('requires a pin for each address', () => {
    const uttara = { lat: 23.876, lng: 90.38 }
    const parsed = createParcelOrderSchema.parse({ ...order, pickupPin: pin, dropoffPin: uttara })
    expect(parsed).toMatchObject({ pickupPin: pin, dropoffPin: uttara })
    expect(pickIssueCode(codes(createParcelOrderSchema.safeParse({ ...order, pickupPin: pin })), FORM_ERROR_PRIORITY.parcel)).toBe('location.required')
  })

  it('reports missing details before a missing pin', () => {
    expect(pickIssueCode(codes(createParcelOrderSchema.safeParse({ ...order, product: '' })), FORM_ERROR_PRIORITY.parcel)).toBe('parcel.details')
  })
})

describe('shifting order', () => {
  it('requires both pins', () => {
    const order = { loadingArea: 'Mirpur 10', unloadingArea: 'Uttara', loadingPin: pin, schedule, vehicleId: 'v1', labourers: 1, loadingFloor: 1, unloadingFloor: 1 }
    expect(pickIssueCode(codes(createShiftingOrderSchema.safeParse(order)), FORM_ERROR_PRIORITY.shifting)).toBe('location.required')
    expect(createShiftingOrderSchema.safeParse({ ...order, unloadingPin: pin }).success).toBe(true)
  })
})

describe('customer location', () => {
  const home = { address: 'Mirpur 10, Dhaka', details: '  House 1, Road 2  ', ...pin }

  it('accepts the map address, optional details and a pin', () => {
    expect(customerLocationSchema.parse(home)).toEqual({ ...home, details: 'House 1, Road 2' })
    expect(customerLocationSchema.parse({ ...home, details: undefined }).details).toBeUndefined()
  })

  it('needs the address and the pin', () => {
    expect(pickIssueCode(codes(customerLocationSchema.safeParse({ ...home, address: ' ' })), FORM_ERROR_PRIORITY.location)).toBe('location.required')
    expect(customerLocationSchema.safeParse({ address: home.address }).success).toBe(false)
  })

  it('joins the details and the address into one line', () => {
    expect(joinAddress({ address: 'Mirpur 10', details: 'House 1' })).toBe('House 1, Mirpur 10')
    expect(joinAddress({ address: 'Mirpur 10', details: '  ' })).toBe('Mirpur 10')
  })

  it('rejects coordinates off the globe', () => {
    expect(geoPointSchema.safeParse({ lat: 91, lng: 0 }).success).toBe(false)
    expect(geoPointSchema.safeParse({ lat: 0, lng: -181 }).success).toBe(false)
    expect(geoPointSchema.safeParse({ lat: '23.8', lng: 90.4 }).success).toBe(false)
  })

  it('reads the reverse-geocoding query from strings, Bangla by default', () => {
    expect(reverseGeocodeQuerySchema.parse({ lat: '23.8', lng: '90.4' })).toEqual({ lat: 23.8, lng: 90.4, lang: 'bn' })
  })

  it('builds a pin only from two set columns, and a maps link from it', () => {
    expect(toGeoPoint(23.8, 90.4)).toEqual({ lat: 23.8, lng: 90.4 })
    expect(toGeoPoint(23.8, null)).toBeNull()
    expect(mapLink({ lat: 23.8, lng: 90.4 })).toBe('https://www.google.com/maps/search/?api=1&query=23.8,90.4')
  })
})
