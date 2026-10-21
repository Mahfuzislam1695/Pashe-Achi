export const LANGS = ['bn', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** A string in both app languages. */
export type Text = { bn: string; en: string }

export const SERVICE_IDS = ['bazar', 'shifting', 'medicine', 'parcel'] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

export const ORDER_STATUSES = ['PENDING', 'QUOTED', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * Services whose prices staff set on each order: the customer sends the order (no prices), staff
 * send a quote (QUOTED), and the order is booked only when the customer confirms it. Bazar and
 * medicine lines are priced one by one; shifting's vehicle rent is priced by distance (its labour
 * and floors come from the Catalog). Parcel is priced from the Catalog, so its bill is exact at once.
 */
export const QUOTED_SERVICES: readonly ServiceId[] = ['bazar', 'medicine', 'shifting']
export const isQuotedService = (service: ServiceId) => QUOTED_SERVICES.includes(service)

/** A bazar, medicine or shifting order still waiting for staff to price it. */
export const isAwaitingPrice = (service: ServiceId, status: OrderStatus) => isQuotedService(service) && status === 'PENDING'

/** Which status an admin may move an order to from its current status (see adminNextStatuses). */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['BOOKED', 'CANCELLED'],
  // Waiting for the customer: they confirm (→ BOOKED) or cancel; staff can only cancel.
  QUOTED: ['CANCELLED'],
  BOOKED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

/** The statuses staff may pick next. A bazar, medicine or shifting order leaves PENDING through a quote, not a status change. */
export const adminNextStatuses = (service: ServiceId, status: OrderStatus): readonly OrderStatus[] =>
  isQuotedService(service) && status === 'PENDING' ? ['CANCELLED'] : ORDER_TRANSITIONS[status]

/** Customers may cancel their own order until it is booked (also while deciding on a quote). */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING', 'QUOTED']

/** Staff can price (and re-price) a quoted order until the customer confirms; then the bill is locked. */
export const QUOTE_EDITABLE: readonly OrderStatus[] = ['PENDING', 'QUOTED']

export const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'OPERATOR'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const NOTIFICATION_TYPES = ['ORDER_CREATED', 'ORDER_STATUS', 'ORDER_BILL', 'ANNOUNCEMENT', 'OFFER'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** Who acted, in the order timeline and the history log. */
export const ACTOR_TYPES = ['CUSTOMER', 'ADMIN', 'SYSTEM'] as const
export type ActorType = (typeof ACTOR_TYPES)[number]

/** The kinds of record the history log (AuditLog) is about. */
export const AUDIT_ENTITIES = ['ORDER', 'CUSTOMER', 'STAFF', 'PRICING', 'VEHICLE', 'SUPPORT', 'ANNOUNCEMENT', 'DELIVERY_HOURS', 'OFFER'] as const
export type AuditEntity = (typeof AUDIT_ENTITIES)[number]

/** Every action the history log records (same order as the AuditAction enum in schema.prisma). */
export const AUDIT_ACTIONS = [
  'CUSTOMER_SIGNED_UP',
  'CUSTOMER_PROFILE_UPDATED',
  'CUSTOMER_PASSWORD_CHANGED',
  'CUSTOMER_BLOCKED',
  'CUSTOMER_UNBLOCKED',
  'CUSTOMER_POINTS_CHANGED',
  'ORDER_CREATED',
  'ORDER_STATUS_CHANGED',
  'ORDER_BILL_UPDATED',
  'PRICING_UPDATED',
  'VEHICLE_CREATED',
  'VEHICLE_UPDATED',
  'SUPPORT_UPDATED',
  'STAFF_CREATED',
  'STAFF_UPDATED',
  'STAFF_PASSWORD_RESET',
  'ADMIN_SIGNED_IN',
  'ADMIN_SIGN_IN_FAILED',
  'ADMIN_SIGNED_OUT',
  'ADMIN_PASSWORD_CHANGED',
  'ANNOUNCEMENT_SENT',
  'DELIVERY_HOURS_UPDATED',
  'CUSTOMER_LOCATION_ADDED',
  'CUSTOMER_LOCATION_UPDATED',
  'CUSTOMER_LOCATION_DELETED',
  'OFFER_CREATED',
  'OFFER_UPDATED',
  'OFFER_DELETED',
  'OFFER_ANNOUNCED',
] as const
export type AuditAction = (typeof AUDIT_ACTIONS)[number]

/** The actions grouped by the record they are about (the history page's filters). */
export const AUDIT_ACTIONS_BY_ENTITY: Record<AuditEntity, readonly AuditAction[]> = {
  ORDER: ['ORDER_CREATED', 'ORDER_STATUS_CHANGED', 'ORDER_BILL_UPDATED'],
  CUSTOMER: [
    'CUSTOMER_SIGNED_UP',
    'CUSTOMER_PROFILE_UPDATED',
    'CUSTOMER_PASSWORD_CHANGED',
    'CUSTOMER_LOCATION_ADDED',
    'CUSTOMER_LOCATION_UPDATED',
    'CUSTOMER_LOCATION_DELETED',
    'CUSTOMER_BLOCKED',
    'CUSTOMER_UNBLOCKED',
    'CUSTOMER_POINTS_CHANGED',
  ],
  STAFF: ['STAFF_CREATED', 'STAFF_UPDATED', 'STAFF_PASSWORD_RESET', 'ADMIN_SIGNED_IN', 'ADMIN_SIGN_IN_FAILED', 'ADMIN_SIGNED_OUT', 'ADMIN_PASSWORD_CHANGED'],
  PRICING: ['PRICING_UPDATED'],
  VEHICLE: ['VEHICLE_CREATED', 'VEHICLE_UPDATED'],
  SUPPORT: ['SUPPORT_UPDATED'],
  ANNOUNCEMENT: ['ANNOUNCEMENT_SENT'],
  DELIVERY_HOURS: ['DELIVERY_HOURS_UPDATED'],
  OFFER: ['OFFER_CREATED', 'OFFER_UPDATED', 'OFFER_DELETED', 'OFFER_ANNOUNCED'],
}

/** Where the REST API lives on the one server: /api/v1. The pages call it on their own origin. */
export const API_PREFIX = 'api/v1'

/** Socket.IO namespace and event names used by the API gateway and both front ends. */
export const SOCKET_NAMESPACE = '/ws'
export const SOCKET_EVENTS = {
  /** A notification row was created for the connected user or admin. Payload: NotificationDto. */
  notificationNew: 'notification:new',
  /** Admins only: a customer placed an order. Payload: OrderSummary. */
  orderNew: 'order:new',
  /** An order changed (status or bill). Payload: OrderSummary. */
  orderUpdated: 'order:updated',
} as const
