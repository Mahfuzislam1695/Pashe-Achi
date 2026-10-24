import { z } from 'zod'

import type { DeliveryHours } from '../delivery-hours'
import { ACTOR_TYPES, ADMIN_ROLES, AUDIT_ACTIONS, AUDIT_ENTITIES } from '../enums'
import { TIME_PATTERN } from '../format'
import { amount, cursorQuery, mobile, password, requiredText } from './common'

export const listCustomersQuerySchema = z.object({
  ...cursorQuery,
  q: z.string().trim().max(80).optional(),
  blocked: z.enum(['true', 'false']).optional(),
})
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>

export const updateCustomerSchema = z
  .object({
    isBlocked: z.boolean().optional(),
    points: amount().optional(),
  })
  .refine(value => value.isBlocked !== undefined || value.points !== undefined, { error: 'validation' })
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>

export const pricingSchema = z.object({
  bazarShoppingFee: amount(),
  bazarDeliveryFee: amount(),
  medicineDeliveryFee: amount(),
  parcelDeliveryFee: amount(),
  wagePerLabourer: amount(),
  loadingRatePerFloor: amount(),
  unloadingRatePerFloor: amount(),
})
export type PricingInput = z.infer<typeof pricingSchema>

export const vehicleSchema = z.object({
  nameBn: requiredText('field.required', 60),
  nameEn: requiredText('field.required', 60),
  rate: amount(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().min(0).max(1000).default(0),
})
export type VehicleInput = z.infer<typeof vehicleSchema>

export const updateVehicleSchema = vehicleSchema.partial()
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>

export const supportSettingsSchema = z.object({
  phone: requiredText('field.required', 20).regex(/^\+?[0-9]{6,15}$/, { error: 'field.invalid' }),
  whatsapp: z.url({ error: 'field.invalid' }).max(200),
})
export type SupportSettingsInput = z.infer<typeof supportSettingsSchema>

export const customerAuthSchema = z.object({ password: z.boolean({ error: 'field.invalid' }) })
export type CustomerAuthInput = z.infer<typeof customerAuthSchema>

const clockTime = z.string({ error: 'hours.invalid' }).regex(TIME_PATTERN, { error: 'hours.invalid' })

/** Up to four windows that each end after they start and don't overlap. Empty means any time. */
const deliveryWindows = z
  .array(z.object({ from: clockTime, to: clockTime }).refine(window => window.from < window.to, { error: 'hours.invalid' }), { error: 'hours.invalid' })
  .max(4, { error: 'hours.invalid' })
  .refine(
    windows => [...windows].sort((a, b) => a.from.localeCompare(b.from)).every((window, index, sorted) => index === 0 || sorted[index - 1]!.to <= window.from),
    { error: 'hours.invalid' },
  )

export const deliveryHoursSchema = z.object({
  bazar: deliveryWindows,
  shifting: deliveryWindows,
  medicine: deliveryWindows,
  parcel: deliveryWindows,
}) satisfies z.ZodType<DeliveryHours>
export type DeliveryHoursInput = z.infer<typeof deliveryHoursSchema>

export const createAdminSchema = z.object({
  name: requiredText('field.required', 80),
  mobile: mobile('field.required'),
  password: password('field.required'),
  role: z.enum(ADMIN_ROLES),
})
export type CreateAdminInput = z.infer<typeof createAdminSchema>

export const updateAdminSchema = z.object({
  name: requiredText('field.required', 80).optional(),
  role: z.enum(ADMIN_ROLES).optional(),
  isActive: z.boolean().optional(),
  password: password('field.required').optional(),
})
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>

export const broadcastSchema = z.object({
  titleBn: requiredText('field.required', 120),
  titleEn: requiredText('field.required', 120),
  bodyBn: requiredText('field.required', 1000),
  bodyEn: requiredText('field.required', 1000),
  /** Omit to send to every active customer. */
  userIds: z.array(z.string().min(1).max(64)).max(1000).optional(),
})
export type BroadcastInput = z.infer<typeof broadcastSchema>

export const listNotificationsQuerySchema = z.object({
  ...cursorQuery,
  unread: z.enum(['true', 'false']).optional(),
})
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>

const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** GET /admin/audit: the history log, newest first. */
export const listAuditQuerySchema = z.object({
  ...cursorQuery,
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(AUDIT_ENTITIES).optional(),
  entityId: z.string().max(64).optional(),
  actorType: z.enum(ACTOR_TYPES).optional(),
  /** What this admin did. */
  adminId: z.string().max(64).optional(),
  /** What this customer did, and what staff did to their account. */
  customerId: z.string().max(64).optional(),
  /** YYYY-MM-DD, inclusive, in Bangladesh time. */
  from: isoDay.optional(),
  to: isoDay.optional(),
  /** Who acted, the record's name or order code (PA-1042), or the note. */
  q: z.string().trim().max(80).optional(),
})
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>

export const dashboardQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
})
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
