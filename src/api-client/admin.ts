import type {
  AdminCustomerDto,
  AdminDto,
  AdminOfferDto,
  ApkInfoDto,
  AuditLogDto,
  AuditStatsDto,
  AuditStatsQuery,
  AuthResponse,
  BroadcastInput,
  CatalogDto,
  CustomerAuthInput,
  CustomerAuthSettings,
  CustomerStatsDto,
  CustomerStatsQuery,
  DeliveryHours,
  DeliveryHoursInput,
  ChangePasswordInput,
  CreateAdminInput,
  DashboardDto,
  DashboardQuery,
  ListAdminNotificationsQuery,
  ListAuditQuery,
  ListCustomersQuery,
  ListOffersQuery,
  ListOrdersQuery,
  ListStaffQuery,
  NotificationDto,
  NotificationStatsDto,
  NotificationStatsQuery,
  OfferInput,
  OfferStatsDto,
  OfferStatsQuery,
  OrderDetail,
  OrderStatsDto,
  OrderStatsQuery,
  OrderSummary,
  PagedList,
  Pricing,
  PricingInput,
  PushKeyDto,
  PushSubscriptionInput,
  QuoteOrderInput,
  RoleDto,
  RoleInput,
  ShiftingQuoteInput,
  StaffActivityDto,
  StaffStatsDto,
  SupportSettings,
  StaffLoginInput,
  SupportSettingsInput,
  SystemStatusDto,
  UnreadCountDto,
  UpdateAdminInput,
  UpdateCustomerInput,
  UpdateOfferInput,
  UpdateRoleInput,
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
      login: (body: StaffLoginInput) => http.post<AuthResponse<AdminDto>>('/admin/auth/login', body),
      logout: () => http.post<void>('/admin/auth/logout', {}),
      me: () => http.get<AdminDto>('/admin/auth/me'),
      changePassword: (body: ChangePasswordInput) => http.post<void>('/admin/auth/password', body),
    },
    dashboard: {
      get: (query: Partial<DashboardQuery> = {}) => http.get<DashboardDto>('/admin/dashboard', query),
      staff: (query: Partial<DashboardQuery> = {}) => http.get<StaffActivityDto>('/admin/dashboard/staff', query),
    },
    orders: {
      list: (query: Partial<ListOrdersQuery> = {}) => http.get<PagedList<OrderSummary>>('/admin/orders', query),
      stats: (query: Partial<OrderStatsQuery> = {}) => http.get<OrderStatsDto>('/admin/orders/stats', query),
      get: (orderId: string) => http.get<OrderDetail>(`/admin/orders/${id(orderId)}`),
      history: (orderId: string) => http.get<AuditLogDto[]>(`/admin/orders/${id(orderId)}/history`),
      updateStatus: (orderId: string, body: UpdateOrderStatusInput) => http.patch<OrderDetail>(`/admin/orders/${id(orderId)}/status`, body),
      /** Price a bazar or medicine order (the whole list of lines); the customer is asked to confirm. */
      quote: (orderId: string, body: QuoteOrderInput) => http.put<OrderDetail>(`/admin/orders/${id(orderId)}/quote`, body),
      /** Price a shifting order's vehicle by distance; the customer is asked to confirm. */
      quoteShifting: (orderId: string, body: ShiftingQuoteInput) => http.put<OrderDetail>(`/admin/orders/${id(orderId)}/shifting-quote`, body),
    },
    customers: {
      list: (query: Partial<ListCustomersQuery> = {}) => http.get<PagedList<AdminCustomerDto>>('/admin/customers', query),
      stats: (query: Partial<CustomerStatsQuery> = {}) => http.get<CustomerStatsDto>('/admin/customers/stats', query),
      get: (customerId: string) => http.get<AdminCustomerDto>(`/admin/customers/${id(customerId)}`),
      update: (customerId: string, body: UpdateCustomerInput) => http.patch<AdminCustomerDto>(`/admin/customers/${id(customerId)}`, body),
    },
    catalog: {
      get: () => http.get<CatalogDto>('/admin/catalog'),
      updatePricing: (body: PricingInput) => http.put<Pricing>('/admin/catalog/pricing', body),
      updateSupport: (body: SupportSettingsInput) => http.put<SupportSettings>('/admin/catalog/support', body),
      updateCustomerAuth: (body: CustomerAuthInput) => http.put<CustomerAuthSettings>('/admin/catalog/customer-auth', body),
      updateDeliveryHours: (body: DeliveryHoursInput) => http.put<DeliveryHours>('/admin/catalog/delivery-hours', body),
      createVehicle: (body: VehicleInput) => http.post<VehicleDto>('/admin/catalog/vehicles', body),
      updateVehicle: (vehicleId: string, body: UpdateVehicleInput) => http.patch<VehicleDto>(`/admin/catalog/vehicles/${id(vehicleId)}`, body),
    },
    staff: {
      list: (query: Partial<ListStaffQuery> = {}) => http.get<PagedList<AdminDto>>('/admin/staff', query),
      stats: () => http.get<StaffStatsDto>('/admin/staff/stats'),
      create: (body: CreateAdminInput) => http.post<AdminDto>('/admin/staff', body),
      update: (adminId: string, body: UpdateAdminInput) => http.patch<AdminDto>(`/admin/staff/${id(adminId)}`, body),
    },
    roles: {
      list: () => http.get<RoleDto[]>('/admin/roles'),
      create: (body: RoleInput) => http.post<RoleDto>('/admin/roles', body),
      update: (roleId: string, body: UpdateRoleInput) => http.patch<RoleDto>(`/admin/roles/${id(roleId)}`, body),
      remove: (roleId: string) => http.request<void>('DELETE', `/admin/roles/${id(roleId)}`),
    },
    notifications: {
      list: (query: Partial<ListAdminNotificationsQuery> = {}) => http.get<PagedList<NotificationDto>>('/admin/notifications', query),
      stats: (query: Partial<NotificationStatsQuery> = {}) => http.get<NotificationStatsDto>('/admin/notifications/stats', query),
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
      list: (query: Partial<ListOffersQuery> = {}) => http.get<PagedList<AdminOfferDto>>('/admin/offers', query),
      stats: (query: Partial<OfferStatsQuery> = {}) => http.get<OfferStatsDto>('/admin/offers/stats', query),
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
      list: (query: Partial<ListAuditQuery> = {}) => http.get<PagedList<AuditLogDto>>('/admin/audit', query),
      stats: (query: Partial<AuditStatsQuery> = {}) => http.get<AuditStatsDto>('/admin/audit/stats', query),
    },
    uploads: {
      url: (uploadId: string) => http.url(`/admin/uploads/${id(uploadId)}`),
    },
    system: {
      status: () => http.get<SystemStatusDto>('/admin/system'),
      /** A full database backup (pg_dump custom format); the server makes it first, so this can take a while. */
      backup: () => http.download('/admin/system/backup'),
      uploadApk: (file: File, version: string) => {
        const form = new FormData()
        form.append('version', version)
        form.append('file', file)
        return http.request<ApkInfoDto>('PUT', '/admin/system/apk', { body: form })
      },
      removeApk: () => http.request<ApkInfoDto | null>('DELETE', '/admin/system/apk'),
    },
  }
}

export type AdminApi = ReturnType<typeof createAdminApi>
