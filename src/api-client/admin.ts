import type {
  AdminCustomerDto,
  AdminDto,
  AuthResponse,
  BroadcastInput,
  CatalogDto,
  ChangePasswordInput,
  CreateAdminInput,
  DashboardDto,
  ListCustomersQuery,
  ListNotificationsQuery,
  ListOrdersQuery,
  LoginInput,
  NotificationDto,
  OrderDetail,
  OrderSummary,
  Paginated,
  Pricing,
  PricingInput,
  SupportSettings,
  SupportSettingsInput,
  UnreadCountDto,
  UpdateAdminInput,
  UpdateCustomerInput,
  UpdateOrderItemsInput,
  UpdateOrderStatusInput,
  UpdateVehicleInput,
  VehicleDto,
  VehicleInput,
} from '@/shared'

import { createHttpClient, type HttpClient, type HttpClientOptions } from './http'

const id = (value: string) => encodeURIComponent(value)

/** Every endpoint the admin panel uses. */
export function createAdminApi(options: Omit<HttpClientOptions, 'audience'>) {
  const http: HttpClient = createHttpClient({ ...options, audience: 'admin' })
  return {
    http,
    auth: {
      login: (body: LoginInput) => http.post<AuthResponse<AdminDto>>('/admin/auth/login', body),
      logout: () => http.post<void>('/admin/auth/logout', {}),
      me: () => http.get<AdminDto>('/admin/auth/me'),
      changePassword: (body: ChangePasswordInput) => http.post<void>('/admin/auth/password', body),
    },
    dashboard: {
      get: (days = 7) => http.get<DashboardDto>('/admin/dashboard', { days }),
    },
    orders: {
      list: (query: Partial<ListOrdersQuery> = {}) => http.get<Paginated<OrderSummary>>('/admin/orders', query),
      get: (orderId: string) => http.get<OrderDetail>(`/admin/orders/${id(orderId)}`),
      updateStatus: (orderId: string, body: UpdateOrderStatusInput) => http.patch<OrderDetail>(`/admin/orders/${id(orderId)}/status`, body),
      updateItems: (orderId: string, body: UpdateOrderItemsInput) => http.patch<OrderDetail>(`/admin/orders/${id(orderId)}/items`, body),
    },
    customers: {
      list: (query: Partial<ListCustomersQuery> = {}) => http.get<Paginated<AdminCustomerDto>>('/admin/customers', query),
      get: (customerId: string) => http.get<AdminCustomerDto>(`/admin/customers/${id(customerId)}`),
      update: (customerId: string, body: UpdateCustomerInput) => http.patch<AdminCustomerDto>(`/admin/customers/${id(customerId)}`, body),
    },
    catalog: {
      get: () => http.get<CatalogDto>('/admin/catalog'),
      updatePricing: (body: PricingInput) => http.put<Pricing>('/admin/catalog/pricing', body),
      updateSupport: (body: SupportSettingsInput) => http.put<SupportSettings>('/admin/catalog/support', body),
      createVehicle: (body: VehicleInput) => http.post<VehicleDto>('/admin/catalog/vehicles', body),
      updateVehicle: (vehicleId: string, body: UpdateVehicleInput) => http.patch<VehicleDto>(`/admin/catalog/vehicles/${id(vehicleId)}`, body),
    },
    staff: {
      list: () => http.get<AdminDto[]>('/admin/staff'),
      create: (body: CreateAdminInput) => http.post<AdminDto>('/admin/staff', body),
      update: (adminId: string, body: UpdateAdminInput) => http.patch<AdminDto>(`/admin/staff/${id(adminId)}`, body),
    },
    notifications: {
      list: (query: Partial<ListNotificationsQuery> = {}) => http.get<Paginated<NotificationDto>>('/admin/notifications', query),
      unreadCount: () => http.get<UnreadCountDto>('/admin/notifications/unread-count'),
      markRead: (notificationId: string) => http.patch<NotificationDto>(`/admin/notifications/${id(notificationId)}/read`),
      markAllRead: () => http.post<UnreadCountDto>('/admin/notifications/read-all'),
      broadcast: (body: BroadcastInput) => http.post<{ sent: number }>('/admin/notifications/broadcast', body),
    },
    uploads: {
      url: (uploadId: string) => http.url(`/admin/uploads/${id(uploadId)}`),
    },
  }
}

export type AdminApi = ReturnType<typeof createAdminApi>
