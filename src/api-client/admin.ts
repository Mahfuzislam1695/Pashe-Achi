import type {
  AdminCustomerDto,
  AdminDto,
  AdminOfferDto,
  AuditLogDto,
  AuthResponse,
  BroadcastInput,
  CatalogDto,
  DeliveryHours,
  DeliveryHoursInput,
  ChangePasswordInput,
  CreateAdminInput,
  DashboardDto,
  ListAuditQuery,
  ListCustomersQuery,
  ListNotificationsQuery,
  ListOrdersQuery,
  LoginInput,
  NotificationDto,
  OfferInput,
  OrderDetail,
  OrderSummary,
  Paginated,
  Pricing,
  PricingInput,
  PushKeyDto,
  PushSubscriptionInput,
  QuoteOrderInput,
  SupportSettings,
  SupportSettingsInput,
  UnreadCountDto,
  UpdateAdminInput,
  UpdateCustomerInput,
  UpdateOfferInput,
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
      history: (orderId: string) => http.get<AuditLogDto[]>(`/admin/orders/${id(orderId)}/history`),
      updateStatus: (orderId: string, body: UpdateOrderStatusInput) => http.patch<OrderDetail>(`/admin/orders/${id(orderId)}/status`, body),
      /** Price a bazar or medicine order (the whole list of lines); the customer is asked to confirm. */
      quote: (orderId: string, body: QuoteOrderInput) => http.put<OrderDetail>(`/admin/orders/${id(orderId)}/quote`, body),
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
      updateDeliveryHours: (body: DeliveryHoursInput) => http.put<DeliveryHours>('/admin/catalog/delivery-hours', body),
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
      push: {
        key: () => http.get<PushKeyDto>('/admin/notifications/push'),
        subscribe: (body: PushSubscriptionInput) => http.put<void>('/admin/notifications/push', body),
        remove: (endpoint: string) => http.request<void>('DELETE', '/admin/notifications/push', { body: { endpoint } }),
      },
      broadcast: (body: BroadcastInput) => http.post<{ sent: number }>('/admin/notifications/broadcast', body),
    },
    offers: {
      list: () => http.get<AdminOfferDto[]>('/admin/offers'),
      create: (body: OfferInput) => http.post<AdminOfferDto>('/admin/offers', body),
      update: (offerId: string, body: UpdateOfferInput) => http.patch<AdminOfferDto>(`/admin/offers/${id(offerId)}`, body),
      remove: (offerId: string) => http.request<void>('DELETE', `/admin/offers/${id(offerId)}`),
      setImage: (offerId: string, file: File) => {
        const form = new FormData()
        form.append('file', file)
        return http.request<AdminOfferDto>('PUT', `/admin/offers/${id(offerId)}/image`, { body: form })
      },
      removeImage: (offerId: string) => http.request<AdminOfferDto>('DELETE', `/admin/offers/${id(offerId)}/image`),
      notify: (offerId: string) => http.post<{ sent: number }>(`/admin/offers/${id(offerId)}/notify`),
    },
    audit: {
      list: (query: Partial<ListAuditQuery> = {}) => http.get<Paginated<AuditLogDto>>('/admin/audit', query),
    },
    uploads: {
      url: (uploadId: string) => http.url(`/admin/uploads/${id(uploadId)}`),
    },
  }
}

export type AdminApi = ReturnType<typeof createAdminApi>
