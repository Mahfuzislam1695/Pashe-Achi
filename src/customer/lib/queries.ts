'use client'

import { isApiError } from '@/api-client'
import type { CatalogDto, CustomerDto, MessageCode, OrderDetail } from '@/shared'
import { pickIssueCode } from '@/shared'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'

import { api } from './api'
import { usePaths } from './paths'

export const queryKeys = {
  me: ['me'] as const,
  catalog: ['catalog'] as const,
  orders: ['orders'] as const,
  orderList: ['orders', 'list'] as const,
  order: (id: string) => ['orders', 'detail', id] as const,
  notifications: ['notifications'] as const,
  notificationList: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
}

const FIVE_MINUTES = 5 * 60 * 1000

export const useMe = () => useQuery({ queryKey: queryKeys.me, queryFn: api.auth.me, staleTime: FIVE_MINUTES })

export const useCatalog = () => useQuery({ queryKey: queryKeys.catalog, queryFn: api.catalog.get, staleTime: FIVE_MINUTES })

/**
 * The signed-in customer and the catalog. Only call this below the (main) layout, which renders
 * nothing until both have loaded.
 */
export function useSession(): { user: CustomerDto; catalog: CatalogDto } {
  const { data: user } = useMe()
  const { data: catalog } = useCatalog()
  if (!user || !catalog) throw new Error('useSession() used outside the signed-in layout')
  return { user, catalog }
}

export const useOrders = () =>
  useInfiniteQuery({
    queryKey: queryKeys.orderList,
    queryFn: ({ pageParam }) => api.orders.list({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  })

export const useOrder = (id: string) => useQuery({ queryKey: queryKeys.order(id), queryFn: () => api.orders.get(id) })

export const useNotifications = () =>
  useInfiniteQuery({
    queryKey: queryKeys.notificationList,
    queryFn: ({ pageParam }) => api.notifications.list({ cursor: pageParam, limit: 20 }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.nextCursor ?? undefined,
  })

export const useUnreadCount = () => useQuery({ queryKey: queryKeys.unread, queryFn: api.notifications.unreadCount })

/** Places an order, refreshes the history and opens it (the original screens switched to Order history). */
export function usePlaceOrder<TInput>(send: (input: TInput) => Promise<OrderDetail>) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const paths = usePaths()
  return useMutation({
    mutationFn: send,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.orders })
      router.push(paths.orders)
    },
  })
}

/** The message code to show for a failed request: the form's own wording when the API reports field issues. */
export function errorCode(error: unknown, priority: readonly MessageCode[] = []): MessageCode {
  if (!isApiError(error)) return 'server'
  return error.issueCodes.length ? pickIssueCode(error.issueCodes, priority) : error.code
}
