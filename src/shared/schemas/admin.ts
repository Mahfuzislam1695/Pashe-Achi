import { z } from 'zod'

import type { DeliveryHours } from '../delivery-hours'
import { ACTOR_TYPES, AUDIT_ACTIONS, AUDIT_ENTITIES, CUSTOMER_SORTS, NOTIFICATION_TYPES, OFFER_STATUSES, SERVICE_IDS } from '../enums'
import { addDays, dayCount, type DayRange, isoDateInBd, TIME_PATTERN } from '../format'
import { ALL_PERMISSIONS, normalizePermissions } from '../permissions'
import { amount, cursorQuery, isoDay, mobile, optionalText, orderedRange, pageQuery, password, rangeError, requiredText } from './common'

const customerFilters = {
  /** Name, mobile or location. */
  q: z.string().trim().max(80).optional(),
  blocked: z.enum(['true', 'false']).optional(),
  /** true: has placed an order; false: never has. */
  ordered: z.enum(['true', 'false']).optional(),
  /** Joined on these days (YYYY-MM-DD, inclusive, Bangladesh time). */
  from: isoDay.optional(),
  to: isoDay.optional(),
}

export const listCustomersQuerySchema = z
  .object({ ...pageQuery, ...customerFilters, sort: z.enum(CUSTOMER_SORTS).optional() })
  .refine(orderedRange, rangeError)
export type ListCustomersQuery = z.infer<typeof listCustomersQuerySchema>

/**
 * GET /admin/customers/stats: the customers the search matches, split by status and by whether they
 * have ordered (so each tile can be a filter), and how many of them joined in from–to.
 */
export const customerStatsQuerySchema = z.object({ q: customerFilters.q, from: customerFilters.from, to: customerFilters.to }).refine(orderedRange, rangeError)
export type CustomerStatsQuery = z.infer<typeof customerStatsQuerySchema>

/** GET /admin/staff. */
export const listStaffQuerySchema = z.object({
  ...pageQuery,
  /** Name or mobile. */
  q: z.string().trim().max(80).optional(),
  roleId: z.string().max(64).optional(),
  active: z.enum(['true', 'false']).optional(),
})
export type ListStaffQuery = z.infer<typeof listStaffQuerySchema>

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
  roleId: z.string({ error: 'field.required' }).min(1, { error: 'field.required' }).max(64),
})
export type CreateAdminInput = z.infer<typeof createAdminSchema>

export const updateAdminSchema = z.object({
  name: requiredText('field.required', 80).optional(),
  roleId: z.string().min(1).max(64).optional(),
  isActive: z.boolean().optional(),
  password: password('field.required').optional(),
})
export type UpdateAdminInput = z.infer<typeof updateAdminSchema>

/**
 * A role made on /admin/roles: names in both languages and the permissions it grants. Any action
 * also grants its module's view, and unknown permissions are refused.
 */
export const roleSchema = z.object({
  nameBn: requiredText('field.required', 60),
  nameEn: requiredText('field.required', 60),
  descriptionBn: optionalText(200),
  descriptionEn: optionalText(200),
  permissions: z
    .array(z.enum(ALL_PERMISSIONS, { error: 'field.invalid' }))
    .max(ALL_PERMISSIONS.length * 2)
    .transform(normalizePermissions),
})
export type RoleInput = z.infer<typeof roleSchema>

export const updateRoleSchema = roleSchema.partial()
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>

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

const adminNotificationFilters = {
  type: z.enum(NOTIFICATION_TYPES).optional(),
  /** YYYY-MM-DD, inclusive, in Bangladesh time. */
  from: isoDay.optional(),
  to: isoDay.optional(),
}

/** GET /admin/notifications: the admin's inbox, in numbered pages (the customer site pages by cursor). */
export const listAdminNotificationsQuerySchema = z
  .object({ ...pageQuery, ...adminNotificationFilters, unread: z.enum(['true', 'false']).optional() })
  .refine(orderedRange, rangeError)
export type ListAdminNotificationsQuery = z.infer<typeof listAdminNotificationsQuerySchema>

/** GET /admin/notifications/stats (the unread filter aside, so both tabs get their count). */
export const notificationStatsQuerySchema = z.object(adminNotificationFilters).refine(orderedRange, rangeError)
export type NotificationStatsQuery = z.infer<typeof notificationStatsQuerySchema>

const auditFilters = {
  action: z.enum(AUDIT_ACTIONS).optional(),
  entityType: z.enum(AUDIT_ENTITIES).optional(),
  entityId: z.string().max(64).optional(),
  /** What this admin did. */
  adminId: z.string().max(64).optional(),
  /** What this customer did, and what staff did to their account. */
  customerId: z.string().max(64).optional(),
  /** YYYY-MM-DD, inclusive, in Bangladesh time. */
  from: isoDay.optional(),
  to: isoDay.optional(),
  /** Who acted, the record's name or order code (PA-1042), or the note. */
  q: z.string().trim().max(80).optional(),
}

/** GET /admin/audit: the history log, newest first. */
export const listAuditQuerySchema = z
  .object({ ...pageQuery, ...auditFilters, actorType: z.enum(ACTOR_TYPES).optional() })
  .refine(orderedRange, rangeError)
export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>

/** GET /admin/audit/stats (who acted aside, so each "done by" tile gets its count). */
export const auditStatsQuerySchema = z.object(auditFilters).refine(orderedRange, rangeError)
export type AuditStatsQuery = z.infer<typeof auditStatsQuerySchema>

const offerFilters = {
  /** Either title. */
  q: z.string().trim().max(80).optional(),
  service: z.enum(SERVICE_IDS).optional(),
}

/** GET /admin/offers. */
export const listOffersQuerySchema = z.object({ ...pageQuery, ...offerFilters, status: z.enum(OFFER_STATUSES).optional() })
export type ListOffersQuery = z.infer<typeof listOffersQuerySchema>

/** GET /admin/offers/stats (the status aside, so every tab gets its count). */
export const offerStatsQuerySchema = z.object(offerFilters)
export type OfferStatsQuery = z.infer<typeof offerStatsQuerySchema>

/** The longest period the dashboard covers, in days. */
export const DASHBOARD_MAX_DAYS = 366

/**
 * GET /admin/dashboard and /admin/dashboard/staff: from–to in Bangladesh days, inclusive, ending
 * today at the latest and at most a year long. Left out, the period is the last `days` days
 * (default 7) up to `to` (default today).
 */
export const dashboardQuerySchema = z
  .object({
    from: isoDay.optional(),
    to: isoDay.optional(),
    days: z.coerce.number().int().min(1).max(DASHBOARD_MAX_DAYS).default(7),
  })
  .refine(value => {
    const today = isoDateInBd()
    const to = value.to ?? today
    return to <= today && (!value.from || (value.from <= to && dayCount(value.from, to) <= DASHBOARD_MAX_DAYS))
  }, rangeError)
export type DashboardQuery = z.infer<typeof dashboardQuerySchema>

/** The period a dashboard query names. */
export function dashboardRange(query: Partial<DashboardQuery>, today = isoDateInBd()): DayRange {
  const to = query.to ?? today
  return { from: query.from ?? addDays(to, -((query.days ?? 7) - 1)), to }
}

/** The period of the same length that ends the day before `range` starts. */
export const previousRange = (range: DayRange): DayRange => ({ from: addDays(range.from, -dayCount(range.from, range.to)), to: addDays(range.from, -1) })
