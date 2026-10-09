import { z } from 'zod'

import { ORDER_STATUSES, SERVICE_IDS } from '../enums'
import type { MessageCode } from '../messages'
import { amount, count, cursorQuery, mobile, optionalText, requiredText, scheduleSchema } from './common'

// The customer sends what they typed; the API computes every fee and total itself.

/** কাঁচা বাজার: item and quantity are required, variety and price (দর) are optional. */
export const bazarItemSchema = z.object({
  name: requiredText('bazar.rows', 120),
  quantity: requiredText('bazar.rows', 40),
  variety: optionalText(80),
  price: amount('bazar.rows').optional(),
})

export const createBazarOrderSchema = z.object({
  address: requiredText('bazar.details', 300),
  contactMobile: mobile('bazar.details'),
  schedule: scheduleSchema,
  items: z.array(bazarItemSchema).min(1, { error: 'bazar.details' }).max(60, { error: 'field.invalid' }),
  note: optionalText(500),
})
export type CreateBazarOrderInput = z.infer<typeof createBazarOrderSchema>

/** বাসা বদল */
export const createShiftingOrderSchema = z.object({
  loadingArea: requiredText('shifting.areas', 200),
  unloadingArea: requiredText('shifting.areas', 200),
  schedule: scheduleSchema,
  vehicleId: z.string({ error: 'shifting.vehicle' }).min(1, { error: 'shifting.vehicle' }).max(64),
  labourers: count('shifting.numbers', 50),
  loadingFloor: count('shifting.numbers', 60),
  unloadingFloor: count('shifting.numbers', 60),
  note: optionalText(500),
})
export type CreateShiftingOrderInput = z.infer<typeof createShiftingOrderSchema>

/** জরুরী ঔষুধ: all five columns are required in every row. */
export const medicineItemSchema = z.object({
  name: requiredText('medicine.rows', 120),
  quantity: requiredText('medicine.rows', 40),
  company: requiredText('medicine.rows', 80),
  category: requiredText('medicine.rows', 80),
  price: amount('medicine.rows'),
})

export const createMedicineOrderSchema = z
  .object({
    address: requiredText('medicine.details', 300),
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
  receiverMobile: mobile('parcel.details'),
  schedule: scheduleSchema,
  note: optionalText(500),
})
export type CreateParcelOrderInput = z.infer<typeof createParcelOrderSchema>

/** The order each form reports its problems in (matches the original screens). */
export const FORM_ERROR_PRIORITY = {
  bazar: ['bazar.rows', 'bazar.details', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  shifting: ['shifting.areas', 'schedule.required', 'schedule.past', 'shifting.vehicle', 'shifting.numbers'],
  medicine: ['medicine.rows', 'medicine.details', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  parcel: ['parcel.details', 'mobile.invalid', 'schedule.required', 'schedule.past'],
  signup: ['auth.signup', 'mobile.invalid', 'password.short'],
  login: ['auth.login', 'mobile.invalid'],
  profile: ['profile.name', 'profile.mobile', 'mobile.invalid'],
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

/** Admin correction of bazar/medicine line prices once the actual cost is known. */
export const updateOrderItemsSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1).max(64), price: amount() }))
    .min(1)
    .max(60),
  note: optionalText(500),
})
export type UpdateOrderItemsInput = z.infer<typeof updateOrderItemsSchema>
