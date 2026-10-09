import type {
  AuthResponse,
  CatalogDto,
  ChangePasswordInput,
  CreateBazarOrderInput,
  CreateMedicineOrderInput,
  CreateParcelOrderInput,
  CreateShiftingOrderInput,
  CustomerDto,
  ListMyOrdersQuery,
  ListNotificationsQuery,
  LoginInput,
  NotificationDto,
  OrderDetail,
  OrderSummary,
  Paginated,
  SignupInput,
  UnreadCountDto,
  UpdateProfileInput,
  UploadDto,
} from '@/shared'

import { createHttpClient, type HttpClient, type HttpClientOptions } from './http'

/** Every endpoint the customer app (and later the Flutter app) uses. */
export function createCustomerApi(options: Omit<HttpClientOptions, 'audience'>) {
  const http: HttpClient = createHttpClient({ ...options, audience: 'customer' })
  return {
    http,
    auth: {
      signup: (body: SignupInput) => http.post<AuthResponse<CustomerDto>>('/auth/signup', body),
      login: (body: LoginInput) => http.post<AuthResponse<CustomerDto>>('/auth/login', body),
      logout: () => http.post<void>('/auth/logout', {}),
      me: () => http.get<CustomerDto>('/auth/me'),
    },
    me: {
      update: (body: UpdateProfileInput) => http.patch<CustomerDto>('/me', body),
      changePassword: (body: ChangePasswordInput) => http.post<void>('/me/password', body),
    },
    catalog: {
      get: () => http.get<CatalogDto>('/catalog'),
    },
    orders: {
      createBazar: (body: CreateBazarOrderInput) => http.post<OrderDetail>('/orders/bazar', body),
      createShifting: (body: CreateShiftingOrderInput) => http.post<OrderDetail>('/orders/shifting', body),
      createMedicine: (body: CreateMedicineOrderInput) => http.post<OrderDetail>('/orders/medicine', body),
      createParcel: (body: CreateParcelOrderInput) => http.post<OrderDetail>('/orders/parcel', body),
      list: (query: Partial<ListMyOrdersQuery> = {}) => http.get<Paginated<OrderSummary>>('/orders', query),
      get: (id: string) => http.get<OrderDetail>(`/orders/${encodeURIComponent(id)}`),
      cancel: (id: string) => http.post<OrderDetail>(`/orders/${encodeURIComponent(id)}/cancel`),
    },
    uploads: {
      prescription: (file: File) => {
        const form = new FormData()
        form.append('file', file)
        return http.request<UploadDto>('POST', '/uploads/prescription', { body: form })
      },
      url: (id: string) => http.url(`/uploads/${encodeURIComponent(id)}`),
    },
    notifications: {
      list: (query: Partial<ListNotificationsQuery> = {}) => http.get<Paginated<NotificationDto>>('/notifications', query),
      unreadCount: () => http.get<UnreadCountDto>('/notifications/unread-count'),
      markRead: (id: string) => http.patch<NotificationDto>(`/notifications/${encodeURIComponent(id)}/read`),
      markAllRead: () => http.post<UnreadCountDto>('/notifications/read-all'),
    },
  }
}

export type CustomerApi = ReturnType<typeof createCustomerApi>
