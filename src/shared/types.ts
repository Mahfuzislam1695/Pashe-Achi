import type { ActorType, AdminRole, AuditAction, AuditEntity, Lang, NotificationType, OrderStatus, ServiceId, Text } from './enums'
import type { DeliveryHours } from './delivery-hours'
import type { GeoPoint } from './geo'
import type { Pricing } from './pricing'

// Response bodies of the API. Dates are ISO 8601 strings; amounts are whole taka.

export interface Paginated<T> {
  items: T[]
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor: string | null
}

export interface CustomerDto {
  id: string
  name: string
  mobile: string
  /** আমার লোকেশন, picked on the map. Null until the customer pins it (accounts from before pins). */
  location: CustomerLocationDto | null
  points: number
  lang: Lang
  createdAt: string
}

/** The customer's one location: the address the map gave, the house/flat/road they added, and the pin. */
export interface CustomerLocationDto extends GeoPoint {
  address: string
  details: string
}

/** GET /geo/reverse: the address for a pin, or null when the lookup found nothing or failed. */
export interface ReverseGeocodeDto {
  address: string | null
}

export interface AdminCustomerDto extends CustomerDto {
  isBlocked: boolean
  orderCount: number
  lastOrderAt: string | null
}

export interface AdminDto {
  id: string
  name: string
  mobile: string
  role: AdminRole
  isActive: boolean
  createdAt: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  /** When the access token expires; refresh before this. */
  accessTokenExpiresAt: string
}

/** Login/signup/refresh response. Browsers also get the tokens as httpOnly cookies. */
export interface AuthResponse<TUser> {
  user: TUser
  tokens: AuthTokens
}

export interface VehicleDto {
  id: string
  slug: string
  name: Text
  rate: number
  isActive: boolean
  sortOrder: number
}

export interface SupportSettings {
  phone: string
  whatsapp: string
}

/** Whether customers sign up and log in with a password. Off: the mobile number alone (the super admin's switch). */
export interface CustomerAuthSettings {
  password: boolean
}

/** Everything a customer screen needs to price an order: GET /catalog. */
export interface CatalogDto {
  pricing: Pricing
  vehicles: VehicleDto[]
  support: SupportSettings
  /** The ডেলিভারি টাইম windows per service; an empty list means any time. */
  deliveryHours: DeliveryHours
  /** Whether the customer sign-in screens show the password box. */
  customerAuth: CustomerAuthSettings
}

export interface OrderCustomerRef {
  id: string
  name: string
  mobile: string
}

export interface OrderSummary {
  id: string
  number: number
  /** PA-<number> */
  code: string
  service: ServiceId
  status: OrderStatus
  /** One line for lists and notifications, e.g. "Rice, potatoes" or "Mirpur 10 → Uttara". */
  summary: string
  total: number
  scheduledDate: string
  scheduledTime: string
  createdAt: string
  /** Present in admin responses. */
  customer?: OrderCustomerRef
}

export interface OrderItemDto {
  id: string
  position: number
  name: string
  quantity: string
  variety: string | null
  company: string | null
  category: string | null
  price: number | null
}

export interface ShiftingDetailDto {
  loadingArea: string
  unloadingArea: string
  loadingPin: GeoPoint | null
  unloadingPin: GeoPoint | null
  vehicleId: string | null
  vehicleName: Text
  /** The vehicle rent staff set by distance; null until they send the price. */
  vehicleRate: number | null
  labourers: number
  wagePerLabourer: number
  loadingFloor: number
  loadingRatePerFloor: number
  unloadingFloor: number
  unloadingRatePerFloor: number
}

export interface ParcelDetailDto {
  product: string
  weight: string | null
  pickupAddress: string
  dropoffAddress: string
  pickupPin: GeoPoint | null
  dropoffPin: GeoPoint | null
  receiverMobile: string
}

export interface UploadDto {
  id: string
  originalName: string
  mime: string
  size: number
  createdAt: string
}

export type OrderEventActor = ActorType

export interface OrderEventDto {
  id: string
  from: OrderStatus | null
  to: OrderStatus
  note: string | null
  actor: OrderEventActor
  adminName: string | null
  createdAt: string
}

export interface OrderDetail extends OrderSummary {
  contactMobile: string
  address: string | null
  /** The map pin for `address`, if the customer set one. */
  addressPin: GeoPoint | null
  note: string | null
  itemsTotal: number
  serviceFee: number
  deliveryFee: number
  items: OrderItemDto[]
  shifting: ShiftingDetailDto | null
  parcel: ParcelDetailDto | null
  prescription: UploadDto | null
  events: OrderEventDto[]
  canCancel: boolean
  /** Staff sent the prices (QUOTED): the customer can confirm them (or cancel). */
  canConfirm: boolean
  /** How many quotes staff have sent (0 before the first). A confirm names the one the customer saw. */
  quoteVersion: number
}

export interface NotificationData {
  orderId?: string
  orderCode?: string
  status?: OrderStatus
  /** OFFER notifications: open আজকের অফার. */
  offerId?: string
}

/** আজকের অফার as customers (and the public landing page) see it: GET /offers. */
export interface OfferDto {
  id: string
  /** English falls back to the Bangla when staff left it blank. */
  title: Text
  body: Text | null
  service: ServiceId | null
  /** Same-origin path to the picture (versioned, so a new picture is never served from cache). */
  imageUrl: string | null
  /** YYYY-MM-DD, Bangladesh days, inclusive. */
  startsOn: string
  endsOn: string
}

/** running: customers see it now; upcoming: starts later; ended: past its last day; off: switched off by staff. */
export type OfferStatus = 'running' | 'upcoming' | 'ended' | 'off'

/** An offer in the admin panel: GET /admin/offers. */
export interface AdminOfferDto extends OfferDto {
  titleBn: string
  titleEn: string | null
  bodyBn: string | null
  bodyEn: string | null
  isActive: boolean
  status: OfferStatus
  createdAt: string
  updatedAt: string
}

export interface NotificationDto {
  id: string
  type: NotificationType
  title: Text
  body: Text
  data: NotificationData
  readAt: string | null
  createdAt: string
}

export interface UnreadCountDto {
  count: number
}

/** GET …/notifications/push: the key browsers subscribe with, or null when push is not set up on the server. */
export interface PushKeyDto {
  publicKey: string | null
}

export interface DashboardDto {
  days: number
  today: { orders: number; revenue: number }
  pending: number
  active: number
  customers: number
  /** Non-cancelled orders in the period. */
  byService: { service: ServiceId; orders: number; revenue: number }[]
  daily: { date: string; orders: number; revenue: number }[]
  recent: OrderSummary[]
}

export type AuditValue = string | number | boolean | null

/**
 * One changed field in a history log entry. `field` is a key of AUDIT_FIELD_LABELS (e.g. "points",
 * "status", "item.price"); `label` names the thing when the field alone isn't enough (an item's name).
 */
export interface AuditChange {
  field: string
  label?: string
  from: AuditValue
  to: AuditValue
}

/** A history log entry: GET /admin/audit and GET /admin/orders/:id/history. */
export interface AuditLogDto {
  id: string
  action: AuditAction
  actor: {
    type: ActorType
    /** The admin's or customer's id; null for the system or a failed sign-in with an unknown mobile. */
    id: string | null
    /** As it was at the time. */
    name: string
    role: AdminRole | null
  }
  entity: {
    type: AuditEntity
    id: string | null
    /** As it was at the time: "PA-1042", a customer, staff member or vehicle name. */
    label: string | null
  }
  changes: AuditChange[]
  note: string | null
  /** Extra facts for some actions: { service, total } (order placed), { sent } (announcement), { reason } (failed sign-in). */
  meta: Record<string, AuditValue>
  ip: string | null
  userAgent: string | null
  createdAt: string
}

export interface HealthDto {
  status: 'ok'
  database: 'up' | 'down'
  uptime: number
  time: string
}
