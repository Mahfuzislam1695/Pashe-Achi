import type { AdminRole, Lang, NotificationType, OrderStatus, ServiceId, Text } from './enums'
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
  location: string
  points: number
  lang: Lang
  createdAt: string
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

/** Everything a customer screen needs to price an order: GET /catalog. */
export interface CatalogDto {
  pricing: Pricing
  vehicles: VehicleDto[]
  support: SupportSettings
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
  vehicleId: string | null
  vehicleName: Text
  vehicleRate: number
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
  receiverMobile: string
}

export interface UploadDto {
  id: string
  originalName: string
  mime: string
  size: number
  createdAt: string
}

export type OrderEventActor = 'CUSTOMER' | 'ADMIN' | 'SYSTEM'

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
}

export interface NotificationData {
  orderId?: string
  orderCode?: string
  status?: OrderStatus
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

export interface HealthDto {
  status: 'ok'
  database: 'up' | 'down'
  uptime: number
  time: string
}
