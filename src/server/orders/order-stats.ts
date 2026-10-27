import { isRevenue, ORDER_STATUSES, type OrderSort, type OrderStatsDto, type OrderStatus } from '@/shared'

import type { Prisma } from '../generated/prisma/client'

/** One row of `order.groupBy({ by: ['status'], _count: { _all: true }, _sum: { total: true } })`. */
export interface StatusGroup {
  status: OrderStatus
  _count: { _all: number }
  _sum: { total: number | null }
}

/** The groupBy arguments every order total is built from. */
export const statusGroupArgs = (where: Prisma.OrderWhereInput) =>
  ({ by: ['status'], where, _count: { _all: true }, _sum: { total: true } }) satisfies Prisma.OrderGroupByArgs

/** Counts per status, and revenue from confirmed bills only (REVENUE_STATUSES), from a groupBy on status. */
export function orderTotals(groups: StatusGroup[]): OrderStatsDto {
  const byStatus = Object.fromEntries(ORDER_STATUSES.map(status => [status, 0])) as Record<OrderStatus, number>
  let revenue = 0
  let confirmed = 0
  let completedRevenue = 0
  for (const group of groups) {
    byStatus[group.status] = group._count._all
    if (!isRevenue(group.status)) continue
    revenue += group._sum.total ?? 0
    confirmed += group._count._all
    if (group.status === 'COMPLETED') completedRevenue = group._sum.total ?? 0
  }
  const orders = ORDER_STATUSES.reduce((sum, status) => sum + byStatus[status], 0)
  return {
    orders,
    byStatus,
    revenue,
    completedRevenue,
    averageBill: confirmed ? Math.round(revenue / confirmed) : 0,
    cancelledRate: orders ? byStatus.CANCELLED / orders : 0,
  }
}

/** The admin list's sort orders; `id` breaks ties so pages never overlap. */
export const ORDER_SORT_ORDER: Record<OrderSort, Prisma.OrderOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  total_desc: [{ total: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
  total_asc: [{ total: 'asc' }, { createdAt: 'desc' }, { id: 'desc' }],
  scheduled_asc: [{ scheduledDate: 'asc' }, { scheduledTime: 'asc' }, { id: 'asc' }],
}
