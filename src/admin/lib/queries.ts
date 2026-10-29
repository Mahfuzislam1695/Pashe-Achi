'use client'

import type {
  AuditStatsQuery,
  CustomerStatsQuery,
  DashboardQuery,
  ListAdminNotificationsQuery,
  ListAuditQuery,
  ListCustomersQuery,
  ListOffersQuery,
  ListOrdersQuery,
  ListStaffQuery,
  NotificationStatsQuery,
  OfferStatsQuery,
  OrderStatsQuery,
} from '@/shared'
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from './api'

// Lists come in numbered pages (PagedList); each one's stats sit under the same prefix, so whatever
// refreshes a list (a change, a realtime event) refreshes its numbers too.

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  orders: ['orders'] as const,
  orderList: (filters: Partial<ListOrdersQuery>) => ['orders', 'list', filters] as const,
  orderStats: (filters: Partial<OrderStatsQuery>) => ['orders', 'stats', filters] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  /** Under 'orders', so everything that refreshes orders refreshes an order's history too. */
  orderHistory: (id: string) => ['orders', 'history', id] as const,
  audit: ['audit'] as const,
  auditList: (filters: Partial<ListAuditQuery>) => ['audit', 'list', filters] as const,
  auditStats: (filters: Partial<AuditStatsQuery>) => ['audit', 'stats', filters] as const,
  customers: ['customers'] as const,
  customerList: (filters: Partial<ListCustomersQuery>) => ['customers', 'list', filters] as const,
  customerStats: (filters: Partial<CustomerStatsQuery>) => ['customers', 'stats', filters] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  catalog: ['catalog'] as const,
  offers: ['offers'] as const,
  offerList: (filters: Partial<ListOffersQuery>) => ['offers', 'list', filters] as const,
  offerStats: (filters: Partial<OfferStatsQuery>) => ['offers', 'stats', filters] as const,
  staff: ['staff'] as const,
  roles: ['roles'] as const,
  system: ['system'] as const,
  staffList: (filters: Partial<ListStaffQuery>) => ['staff', 'list', filters] as const,
  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  notificationStatsAll: ['notifications', 'stats'] as const,
  notificationStats: (filters: Partial<NotificationStatsQuery>) => ['notifications', 'stats', filters] as const,
  unread: ['notifications', 'unread'] as const,
}

/** A page stays on screen while the next one loads, so the table never jumps to a spinner. */
const paged = { placeholderData: keepPreviousData }

export const useAdmin = () => useQuery({ queryKey: queryKeys.me, queryFn: api.auth.me, staleTime: 5 * 60 * 1000 })

/** The signed-in admin. Only call below the (panel) layout, which waits for it. */
export function useCurrentAdmin() {
  const { data } = useAdmin()
  if (!data) throw new Error('useCurrentAdmin() used outside the panel layout')
  return data
}

export const useDashboard = (range: Partial<DashboardQuery>) =>
  useQuery({ queryKey: [...queryKeys.dashboard, range], queryFn: () => api.dashboard.get(range), ...paged, refetchInterval: 60_000 })

/** Managers and up. Under 'dashboard' and refreshed with it. */
export const useStaffActivity = (range: Partial<DashboardQuery>, enabled = true) =>
  useQuery({ queryKey: [...queryKeys.dashboard, 'staff', range], queryFn: () => api.dashboard.staff(range), ...paged, enabled })

export const useOrderList = (filters: Partial<ListOrdersQuery>) => useQuery({ queryKey: queryKeys.orderList(filters), queryFn: () => api.orders.list(filters), ...paged })

export const useOrderStats = (filters: Partial<OrderStatsQuery>) => useQuery({ queryKey: queryKeys.orderStats(filters), queryFn: () => api.orders.stats(filters), ...paged })

export const useOrder = (id: string) => useQuery({ queryKey: queryKeys.order(id), queryFn: () => api.orders.get(id) })

// The history log is always refetched when shown, so a change made a moment ago is already there.

export const useOrderHistory = (id: string) => useQuery({ queryKey: queryKeys.orderHistory(id), queryFn: () => api.orders.history(id), staleTime: 0 })

/** The history log, newest first. Managers and super admins only. */
export const useAuditList = (filters: Partial<ListAuditQuery>) =>
  useQuery({ queryKey: queryKeys.auditList(filters), queryFn: () => api.audit.list(filters), ...paged, staleTime: 0 })

export const useAuditStats = (filters: Partial<AuditStatsQuery>) =>
  useQuery({ queryKey: queryKeys.auditStats(filters), queryFn: () => api.audit.stats(filters), ...paged, staleTime: 0 })

export const useCustomerList = (filters: Partial<ListCustomersQuery>) =>
  useQuery({ queryKey: queryKeys.customerList(filters), queryFn: () => api.customers.list(filters), ...paged })

export const useCustomerStats = (filters: Partial<CustomerStatsQuery>) =>
  useQuery({ queryKey: queryKeys.customerStats(filters), queryFn: () => api.customers.stats(filters), ...paged })

export const useCustomer = (id: string) => useQuery({ queryKey: queryKeys.customer(id), queryFn: () => api.customers.get(id) })

export const useCatalog = () => useQuery({ queryKey: queryKeys.catalog, queryFn: api.catalog.get })

/** Offers, latest end date first. */
export const useOffers = (filters: Partial<ListOffersQuery>) => useQuery({ queryKey: queryKeys.offerList(filters), queryFn: () => api.offers.list(filters), ...paged })

export const useOfferStats = (filters: Partial<OfferStatsQuery>) => useQuery({ queryKey: queryKeys.offerStats(filters), queryFn: () => api.offers.stats(filters), ...paged })

export const useStaff = (filters: Partial<ListStaffQuery>) => useQuery({ queryKey: queryKeys.staffList(filters), queryFn: () => api.staff.list(filters), ...paged })

/** Every role (any admin may read them: names, pickers). */
export const useRoles = () => useQuery({ queryKey: queryKeys.roles, queryFn: api.roles.list, staleTime: 60_000 })

export const useSystemStatus = () => useQuery({ queryKey: queryKeys.system, queryFn: api.system.status, staleTime: 0 })

export const useStaffStats = () => useQuery({ queryKey: [...queryKeys.staff, 'stats'], queryFn: api.staff.stats })

export const useNotifications = (filters: Partial<ListAdminNotificationsQuery>) =>
  useQuery({ queryKey: [...queryKeys.notificationList, filters], queryFn: () => api.notifications.list(filters), ...paged })

export const useNotificationStats = (filters: Partial<NotificationStatsQuery>) =>
  useQuery({ queryKey: queryKeys.notificationStats(filters), queryFn: () => api.notifications.stats(filters), ...paged })

/** Off for roles without notifications.view (the bell is hidden for them). */
export const useUnreadCount = (enabled = true) => useQuery({ queryKey: queryKeys.unread, queryFn: api.notifications.unreadCount, enabled })
