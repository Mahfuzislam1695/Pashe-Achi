export const LANGS = ['bn', 'en'] as const
export type Lang = (typeof LANGS)[number]

/** A string in both app languages. */
export type Text = { bn: string; en: string }

export const SERVICE_IDS = ['bazar', 'shifting', 'medicine', 'parcel'] as const
export type ServiceId = (typeof SERVICE_IDS)[number]

export const ORDER_STATUSES = ['PENDING', 'BOOKED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const
export type OrderStatus = (typeof ORDER_STATUSES)[number]

/** Which status an admin may move an order to from its current status. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ['BOOKED', 'CANCELLED'],
  BOOKED: ['IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
}

export const canTransition = (from: OrderStatus, to: OrderStatus) => ORDER_TRANSITIONS[from].includes(to)

/** Customers may cancel their own order only before it is booked. */
export const CUSTOMER_CANCELLABLE: readonly OrderStatus[] = ['PENDING']

/** Line prices can be corrected by an admin until the order is finished. */
export const BILL_EDITABLE: readonly OrderStatus[] = ['PENDING', 'BOOKED', 'IN_PROGRESS']

export const ADMIN_ROLES = ['SUPER_ADMIN', 'MANAGER', 'OPERATOR'] as const
export type AdminRole = (typeof ADMIN_ROLES)[number]

export const NOTIFICATION_TYPES = ['ORDER_CREATED', 'ORDER_STATUS', 'ORDER_BILL', 'ANNOUNCEMENT'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

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
