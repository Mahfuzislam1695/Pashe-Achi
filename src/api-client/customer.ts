import type {
  AuthResponse,
  CatalogDto,
  ChangePasswordInput,
  ConfirmOrderInput,
  CreateBazarOrderInput,
  CreateMedicineOrderInput,
  CreateParcelOrderInput,
  CreateShiftingOrderInput,
  CustomerDto,
  GeoPoint,
  Lang,
  ListMyOrdersQuery,
  ListNotificationsQuery,
  LoginInput,
  NotificationDto,
  OfferDto,
  OrderDetail,
  OrderSummary,
  Paginated,
  PushKeyDto,
  PushSubscriptionInput,
  ReverseGeocodeDto,
  SavedLocationDto,
  SavedLocationInput,
  SignupInput,
  UnreadCountDto,
  UpdateProfileInput,
  UpdateSavedLocationInput,
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
      locations: {
        list: () => http.get<SavedLocationDto[]>('/me/locations'),
        create: (body: SavedLocationInput) => http.post<SavedLocationDto>('/me/locations', body),
        update: (id: string, body: UpdateSavedLocationInput) => http.patch<SavedLocationDto>(`/me/locations/${encodeURIComponent(id)}`, body),
        remove: (id: string) => http.request<void>('DELETE', `/me/locations/${encodeURIComponent(id)}`),
      },
    },
    geo: {
      /** The address text for a map pin; `address` is null when nothing was found. */
      reverse: ({ lat, lng }: GeoPoint, lang: Lang, signal?: AbortSignal) => http.get<ReverseGeocodeDto>('/geo/reverse', { lat, lng, lang }, signal),
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
      /** Accept the staff's prices; `total` is the total the customer saw. */
      confirm: (id: string, body: ConfirmOrderInput) => http.post<OrderDetail>(`/orders/${encodeURIComponent(id)}/confirm`, body),
    },
    uploads: {
      prescription: (file: File) => {
        const form = new FormData()
        form.append('file', file)
        return http.request<UploadDto>('POST', '/uploads/prescription', { body: form })
      },
      url: (id: string) => http.url(`/uploads/${encodeURIComponent(id)}`),
    },
    offers: {
      /** আজকের অফার running today. Public: works signed out too (the landing page). */
      list: () => http.get<OfferDto[]>('/offers'),
    },
    notifications: {
      list: (query: Partial<ListNotificationsQuery> = {}) => http.get<Paginated<NotificationDto>>('/notifications', query),
      unreadCount: () => http.get<UnreadCountDto>('/notifications/unread-count'),
      markRead: (id: string) => http.patch<NotificationDto>(`/notifications/${encodeURIComponent(id)}/read`),
      markAllRead: () => http.post<UnreadCountDto>('/notifications/read-all'),
      /** Phone and desktop notifications (Web Push) for this browser. */
      push: {
        key: () => http.get<PushKeyDto>('/notifications/push'),
        subscribe: (body: PushSubscriptionInput) => http.put<void>('/notifications/push', body),
        remove: (endpoint: string) => http.request<void>('DELETE', '/notifications/push', { body: { endpoint } }),
      },
    },
  }
}

export type CustomerApi = ReturnType<typeof createCustomerApi>
