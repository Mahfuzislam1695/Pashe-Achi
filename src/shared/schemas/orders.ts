import { z } from 'zod'

import { ORDER_STATUSES, SERVICE_IDS } from '../enums'
import type { MessageCode } from '../messages'
import { amount, count, cursorQuery, mobile, optionalText, requiredText, scheduleSchema } from './common'
import { requiredPin } from './locations'

// The customer sends what they typed; the API computes every fee and total itself. Customers never
// send a price: staff price bazar and medicine lines and shifting's vehicle rent in a quote, and the
// rest comes from the Catalog.

/** কাঁচা বাজার: item and quantity are required, variety is optional. */
export const bazarItemSchema = z.object({
  name: requiredText('bazar.rows', 120),
  quantity: requiredText('bazar.rows', 40),
  variety: optionalText(80),
})

export const createBazarOrderSchema = z.object({
  address: requiredText('bazar.details', 300),
  addressPin: requiredPin,
  contactMobile: mobile('bazar.details'),
  schedule: scheduleSchema,
  items: z.array(bazarItemSchema).min(1, { error: 'bazar.details' }).max(60, { error: 'field.invalid' }),
  note: optionalText(500),
})
export type CreateBazarOrderInput = z.infer<typeof createBazarOrderSchema>

/** বাসা বদল: the vehicle is chosen here; staff send its rent by distance in a quote. */
export const createShiftingOrderSchema = z.object({
  loadingArea: requiredText('shifting.areas', 200),
  unloadingArea: requiredText('shifting.areas', 200),
  loadingPin: requiredPin,
  unloadingPin: requiredPin,
  schedule: scheduleSchema,
  vehicleId: z.string({ error: 'shifting.vehicle' }).min(1, { error: 'shifting.vehicle' }).max(64),
  labourers: count('shifting.numbers', 50),
  loadingFloor: count('shifting.numbers', 60),
  unloadingFloor: count('shifting.numbers', 60),
  note: optionalText(500),
})
export type CreateShiftingOrderInput = z.infer<typeof createShiftingOrderSchema>

/** জরুরী ঔষুধ: all four columns are required in every row (the price comes in the quote). */
export const medicineItemSchema = z.object({
  name: requiredText('medicine.rows', 120),
  quantity: requiredText('medicine.rows', 40),
  company: requiredText('medicine.rows', 80),
  category: requiredText('medicine.rows', 80),
})

export const createMedicineOrderSchema = z
  .object({
    address: requiredText('medicine.details', 300),
    addressPin: requiredPin,
    contactMobile: mobile('medicine.details'),
    schedule: scheduleSchema,
    prescriptionUploadId: z.string().min(1).max(64).optional(),
    items: z.array(medicineItemSchema).max(60, { error: 'field.invalid' }),
    note: optionalText(500),
  })
  // A prescription or at least one medicine row. `when` makes this run even if other fields
  // failed, so the form can still report it in the right order.
  .refine(value => !!value?.prescriptionUploadId || (Array.isArray(value?.items) && value.items.length > 0), {
    error: 'medicine.details',
    path: ['items'],
    when: () => true,
  })
export type CreateMedicineOrderInput = z.infer<typeof createMedicineOrderSchema>

/** পণ্য আদান প্রদান */
export const createParcelOrderSchema = z.object({
  product: requiredText('parcel.details', 160),
  weight: optionalText(40),
  pickupAddress: requiredText('parcel.details', 300),
  dropoffAddress: requiredText('parcel.details', 300),
  pickupPin: requiredPin,
  dropoffPin: requiredPin,
  receiverMobile: mobile('parcel.details'),
  schedule: scheduleSchema,
  note: optionalText(500),
})
export type CreateParcelOrderInput = z.infer<typeof createParcelOrderSchema>

/** The order each form reports its problems in (matches the original screens). */
export const FORM_ERROR_PRIORITY = {
  bazar: ['bazar.rows', 'bazar.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  shifting: ['shifting.areas', 'location.required', 'schedule.required', 'schedule.past', 'shifting.vehicle', 'shifting.numbers'],
  medicine: ['medicine.rows', 'medicine.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  parcel: ['parcel.details', 'location.required', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  signup: ['auth.signup', 'mobile.invalid', 'location.required', 'password.required', 'password.short'],
  login: ['auth.login', 'mobile.invalid', 'password.required', 'auth.no_account'],
  profile: ['profile.name', 'profile.mobile', 'mobile.invalid'],
  location: ['location.required'],
  quote: ['quote.items', 'quote.fees'],
  shiftingQuote: ['quote.vehicle'],
  offer: ['offer.title', 'offer.dates'],
} as const satisfies Record<string, readonly MessageCode[]>

export const listMyOrdersQuerySchema = z.object({
  ...cursorQuery,
  service: z.enum(SERVICE_IDS).optional(),
})
export type ListMyOrdersQuery = z.infer<typeof listMyOrdersQuerySchema>

// Admin

export const listOrdersQuerySchema = z.object({
  ...cursorQuery,
  service: z.enum(SERVICE_IDS).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
  /** YYYY-MM-DD, inclusive, by creation date in Bangladesh time. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** Order code (PA-1042 or 1042), customer name or mobile. */
  q: z.string().trim().max(80).optional(),
  customerId: z.string().max(64).optional(),
})
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>

export const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
  note: optionalText(500),
})
export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>

/** One priced line of a quote: an existing line (`id`) or a new one staff added (no `id`). */
export const quoteItemSchema = z.object({
  id: z.string().min(1).max(64).optional(),
  name: requiredText('quote.items', 120),
  quantity: requiredText('quote.items', 40),
  variety: optionalText(80),
  company: optionalText(80),
  category: optionalText(80),
  price: amount('quote.items'),
})

/**
 * Staff price a bazar or medicine order (PUT /admin/orders/:id/quote). `items` is the whole list:
 * lines left out are removed (e.g. not available), lines without an id are added (e.g. from a
 * prescription). The fees start as the Catalog's and staff may change them (a long way, a big
 * bazar); a fee left out keeps its current value. Medicine has no shopping fee. The note is shown
 * to the customer.
 */
export const quoteOrderSchema = z.object({
  items: z.array(quoteItemSchema).min(1, { error: 'quote.items' }).max(60, { error: 'field.invalid' }),
  serviceFee: amount('quote.fees').optional(),
  deliveryFee: amount('quote.fees').optional(),
  note: optionalText(500),
})
export type QuoteOrderInput = z.infer<typeof quoteOrderSchema>
export type QuoteItemInput = z.infer<typeof quoteItemSchema>

/**
 * Staff price a shifting order (PUT /admin/orders/:id/shifting-quote): the vehicle rent, set by the
 * distance between the loading and unloading areas. Labour and floors keep the Catalog rates the
 * order was placed with. The note is shown to the customer.
 */
export const shiftingQuoteSchema = z.object({
  vehicleRate: amount('quote.vehicle'),
  note: optionalText(500),
})
export type ShiftingQuoteInput = z.infer<typeof shiftingQuoteSchema>

/**
 * The customer confirms a quote (POST /orders/:id/confirm) with the quote they saw: its version
 * (every quote adds one) and total. A newer quote, even with the same total, can't be confirmed unseen.
 */
export const confirmOrderSchema = z.object({ total: amount(), quoteVersion: z.number().int().min(0).max(1_000_000) })
export type ConfirmOrderInput = z.infer<typeof confirmOrderSchema>
