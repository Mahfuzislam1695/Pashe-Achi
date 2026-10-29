import type { ActorType, AuditAction, AuditEntity, Lang, NotificationType, OfferStatus, OrderStatus, ServiceId, Text } from './enums'
import type { DeliveryHours } from './delivery-hours'
import type { GeoPoint } from './geo'
import type { Permission } from './permissions'
import type { Pricing } from './pricing'

// Response bodies of the API. Dates are ISO 8601 strings; amounts are whole taka.

export interface Paginated<T> {
  items: T[]
  /** Pass as `cursor` to get the next page; null on the last page. */
  nextCursor: string | null
}

/** A numbered page of an admin list: `total` rows match the filters, split into `pageCount` pages of `limit`. */
export interface PagedList<T> {
  items: T[]
  total: number
  page: number
  limit: number
  pageCount: number
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
  /** The customer deleted their account: the row stays (their past orders point to it) without personal details. */
  deleted: boolean
  orderCount: number
  lastOrderAt: string | null
}

/** A staff member's role as other records show it. */
export interface RoleRef {
  id: string
  name: Text
  /** The Super admin role: every permission, never edited. */
  isSystem: boolean
}

export interface AdminDto {
  id: string
  name: string
  mobile: string
  role: RoleRef
  /** What this admin may do: the role's permissions (every permission for the system role). */
  permissions: Permission[]
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

/** Totals for a set of orders. Revenue counts only confirmed bills (REVENUE_STATUSES). */
export interface OrderTotals {
  /** Every order, cancelled ones included. */
  orders: number
  /** Sum of confirmed bills: BOOKED, IN_PROGRESS and COMPLETED. */
  revenue: number
  completedRevenue: number
  /** revenue ÷ confirmed orders, rounded; 0 when there are none. */
  averageBill: number
  /** Cancelled ÷ every order, 0 to 1. */
  cancelledRate: number
}

/** GET /admin/orders/stats: the orders the list's filters match (status aside, so every tab has its count). */
export interface OrderStatsDto extends OrderTotals {
  byStatus: Record<OrderStatus, number>
}

/** GET /admin/customers/stats. `newInRange` counts sign-ups in the joined filter (or the last 30 days). */
export interface CustomerStatsDto {
  total: number
  active: number
  blocked: number
  ordered: number
  neverOrdered: number
  newInRange: number
  /** Reward points held by the matching customers. */
  points: number
}

/** GET /admin/audit/stats. */
export interface AuditStatsDto {
  total: number
  byActorType: Record<ActorType, number>
}

/** GET /admin/notifications/stats: the signed-in admin's inbox. */
export interface NotificationStatsDto {
  total: number
  unread: number
  today: number
}

/** GET /admin/staff/stats. */
export interface StaffStatsDto {
  total: number
  active: number
  /** Every role, with how many accounts hold it. */
  byRole: { id: string; name: Text; isSystem: boolean; count: number }[]
}

/** GET /admin/offers/stats. */
export interface OfferStatsDto {
  total: number
  byStatus: Record<OfferStatus, number>
}

export interface DashboardTotals extends OrderTotals {
  newCustomers: number
}

/** GET /admin/dashboard. Days are YYYY-MM-DD in Bangladesh time, inclusive. */
export interface DashboardDto {
  from: string
  to: string
  /** The period of the same length just before, for the change shown on each tile. */
  previous: { from: string; to: string }
  /** Right now, whatever the period. */
  live: { needsAction: number; awaitingCustomer: number; active: number; customers: number; todayOrders: number; todayRevenue: number }
  current: DashboardTotals
  before: DashboardTotals
  byStatus: Record<OrderStatus, number>
  byService: { service: ServiceId; orders: number; revenue: number; averageBill: number }[]
  /** Each point is a day, or for periods longer than 92 days a week (starting Monday). */
  bucket: 'day' | 'week'
  series: { date: string; orders: number; revenue: number }[]
  /** By confirmed spend in the period. */
  topCustomers: { id: string; name: string; mobile: string; orders: number; revenue: number }[]
  recent: OrderSummary[]
}

/** GET /admin/dashboard/staff: what each staff member did to orders in the period (managers and up). */
export interface StaffActivityDto {
  from: string
  to: string
  rows: { id: string; name: string; role: Text; statusChanges: number; quotes: number; completed: number; total: number }[]
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
    /** The admin's role name as it was at the time. */
    role: Text | null
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

/** A role as /admin/roles shows it. */
export interface RoleDto extends RoleRef {
  /** Built-in roles: super_admin, manager, operator. Null for roles made in the panel. */
  key: string | null
  description: Text | null
  /** As stored (the system role's list is ignored: it has every permission). */
  permissions: Permission[]
  staffCount: number
  createdAt: string
  updatedAt: string
}

/** The APK /app-download serves: uploaded on the System page, or the one in public/downloads/. */
export interface ApkInfoDto {
  source: 'uploaded' | 'bundled'
  /** As typed at upload (1.0.3); null for the bundled file or when left blank. */
  version: string | null
  size: number
  /** When it was uploaded, or the bundled file's modified time. */
  updatedAt: string
  /** The staff member who uploaded it. */
  uploadedBy: string | null
  /** The public download link. */
  url: string
}

/** GET /admin/system: what the System page shows. */
export interface SystemStatusDto {
  database: {
    name: string
    /** Bytes, from pg_database_size. */
    size: number
    /** The PostgreSQL server's version (17.2). */
    serverVersion: string
    /** pg_dump's version, or null when the server can't run it. */
    pgDumpVersion: string | null
  }
  /** Null when there is no APK at all. */
  apk: ApkInfoDto | null
}
