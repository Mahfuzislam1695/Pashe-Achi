'use client'

import type { ListCustomersQuery, ListOrdersQuery } from '@/shared'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'

import { api } from './api'

export const queryKeys = {
  me: ['me'] as const,
  dashboard: ['dashboard'] as const,
  orders: ['orders'] as const,
  orderList: (filters: Partial<ListOrdersQuery>) => ['orders', 'list', filters] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  customers: ['customers'] as const,
  customerList: (filters: Partial<ListCustomersQuery>) => ['customers', 'list', filters] as const,
  customer: (id: string) => ['customers', 'detail', id] as const,
  catalog: ['catalog'] as const,
  staff: ['staff'] as const,
  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
}

export const useAdmin = () => useQuery({ queryKey: queryKeys.me, queryFn: api.auth.me, staleTime: 5 * 60 * 1000 })

/** The signed-in admin. Only call below the (panel) layout, which waits for it. */
export function useCurrentAdmin() {
  const { data } = useAdmin()
  if (!data) throw new Error('useCurrentAdmin() used outside the panel layout')
  return data
}

export const useDashboard = (days: number) =>
  useQuery({ queryKey: [...queryKeys.dashboard, days], queryFn: () => api.dashboard.get(days), placeholderData: keepPreviousData, refetchInterval: 60_000 })

export const useOrderList = (filters: Partial<ListOrdersQuery>) =>
  useInfiniteQuery({
    queryKey: queryKeys.orderList(filters),
    queryFn: ({ pageParam }) => api.orders.list({ ...filters, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })

export const useOrder = (id: string) => useQuery({ queryKey: queryKeys.order(id), queryFn: () => api.orders.get(id) })

export const useCustomerList = (filters: Partial<ListCustomersQuery>) =>
  useInfiniteQuery({
    queryKey: queryKeys.customerList(filters),
    queryFn: ({ pageParam }) => api.customers.list({ ...filters, cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  })

export const useCustomer = (id: string) => useQuery({ queryKey: queryKeys.customer(id), queryFn: () => api.customers.get(id) })

export const useCatalog = () => useQuery({ queryKey: queryKeys.catalog, queryFn: api.catalog.get })

export const useStaff = () => useQuery({ queryKey: queryKeys.staff, queryFn: api.staff.list })

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notificationList,
    queryFn: ({ pageParam }) => api.notifications.list({ cursor: pageParam, limit: 25 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  })

export const useUnreadCount = () => useQuery({ queryKey: queryKeys.unread, queryFn: api.notifications.unreadCount })
