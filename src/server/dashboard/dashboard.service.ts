import { Injectable } from '@nestjs/common'
import {
  addDays,
  dashboardRange,
  type DashboardDto,
  type DashboardQuery,
  type DashboardTotals,
  type DayRange,
  dayCount,
  isoDateInBd,
  isRevenue,
  type OrderStatus,
  previousRange,
  REVENUE_STATUSES,
  SERVICE_IDS,
  type StaffActivityDto,
} from '@/shared'

import { bdDayEnd, bdDayStart } from '../common/pagination'
import { Prisma } from '../generated/prisma/client'
import { summaryInclude, toOrderSummary } from '../orders/order.mapper'
import { orderTotals, statusGroupArgs } from '../orders/order-stats'
import { PrismaService } from '../prisma/prisma.service'
import { roleName } from '../roles/role.mapper'

/** Longer periods are charted by the week, so a column stays readable. */
const DAILY_MAX_DAYS = 92

const createdIn = (range: DayRange) => ({ createdAt: { gte: bdDayStart(range.from), lt: bdDayEnd(range.to) } })

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The period's totals beside the period of the same length before it, the live queue, and the
   * period by status, by service, over time and by customer. Days are Bangladesh days; revenue
   * counts only confirmed bills (REVENUE_STATUSES), by the day the order was placed.
   */
  async get(query: DashboardQuery): Promise<DashboardDto> {
    const range = dashboardRange(query)
    const previous = previousRange(range)
    const today = isoDateInBd()
    const bucket = dayCount(range.from, range.to) > DAILY_MAX_DAYS ? 'week' : 'day'

    const [current, before, todayGroups, live, byServiceGroups, series, top, recent] = await Promise.all([
      this.totals(range),
      this.totals(previous),
      this.prisma.order.groupBy(statusGroupArgs(createdIn({ from: today, to: today }))),
      this.prisma.$transaction([
        this.prisma.order.count({ where: { status: 'PENDING' } }),
        this.prisma.order.count({ where: { status: 'QUOTED' } }),
        this.prisma.order.count({ where: { status: { in: ['BOOKED', 'IN_PROGRESS'] } } }),
        this.prisma.user.count(),
      ]),
      this.prisma.order.groupBy({ by: ['service', 'status'], where: createdIn(range), _count: { _all: true }, _sum: { total: true } }),
      this.series(range, bucket),
      this.prisma.order.groupBy({
        by: ['userId'],
        where: { ...createdIn(range), status: { in: [...REVENUE_STATUSES] } },
        _count: { _all: true },
        _sum: { total: true },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      }),
      this.prisma.order.findMany({ include: summaryInclude, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 8 }),
    ])

    const users = await this.prisma.user.findMany({ where: { id: { in: top.map(row => row.userId) } }, select: { id: true, name: true, mobile: true } })
    const todayTotals = orderTotals(todayGroups)
    const [needsAction, awaitingCustomer, active, customers] = live
    // Each period's split by status goes out once, for the current period only.
    const { byStatus, ...currentTotals } = current
    const { byStatus: _previousByStatus, ...beforeTotals } = before

    return {
      ...range,
      previous,
      live: { needsAction, awaitingCustomer, active, customers, todayOrders: todayTotals.orders, todayRevenue: todayTotals.revenue },
      current: currentTotals,
      before: beforeTotals,
      byStatus,
      byService: SERVICE_IDS.map(service => {
        const rows = byServiceGroups.filter(row => row.service === service)
        const confirmed = rows.filter(row => isRevenue(row.status))
        const revenue = confirmed.reduce((sum, row) => sum + (row._sum.total ?? 0), 0)
        const confirmedCount = confirmed.reduce((sum, row) => sum + row._count._all, 0)
        return {
          service,
          orders: rows.reduce((sum, row) => sum + row._count._all, 0),
          revenue,
          averageBill: confirmedCount ? Math.round(revenue / confirmedCount) : 0,
        }
      }),
      bucket,
      series,
      topCustomers: top.flatMap(row => {
        const user = users.find(entry => entry.id === row.userId)
        return user ? [{ ...user, orders: row._count._all, revenue: row._sum.total ?? 0 }] : []
      }),
      recent: recent.map(order => toOrderSummary(order, true)),
    }
  }

  /**
   * What each staff member did to orders in the period: status changes and prices sent (from the
   * history log) and orders they marked completed. Busiest first, at most 10.
   */
  async staff(query: DashboardQuery): Promise<StaffActivityDto> {
    const range = dashboardRange(query)
    const [actions, completions] = await Promise.all([
      this.prisma.auditLog.groupBy({
        by: ['adminId', 'action'],
        where: { ...createdIn(range), entityType: 'ORDER', adminId: { not: null }, action: { in: ['ORDER_STATUS_CHANGED', 'ORDER_BILL_UPDATED'] } },
        _count: { _all: true },
      }),
      this.prisma.orderStatusEvent.groupBy({ by: ['adminId'], where: { ...createdIn(range), to: 'COMPLETED', adminId: { not: null } }, _count: { _all: true } }),
    ])
    const ids = [...new Set([...actions, ...completions].map(row => row.adminId).filter((id): id is string => !!id))]
    const admins = await this.prisma.admin.findMany({ where: { id: { in: ids } }, select: { id: true, name: true, role: { select: { nameBn: true, nameEn: true } } } })
    const rows = admins.map(admin => {
      const count = (action: string) => actions.find(row => row.adminId === admin.id && row.action === action)?._count._all ?? 0
      const statusChanges = count('ORDER_STATUS_CHANGED')
      const quotes = count('ORDER_BILL_UPDATED')
      return { id: admin.id, name: admin.name, role: roleName(admin.role), statusChanges, quotes, completed: completions.find(row => row.adminId === admin.id)?._count._all ?? 0, total: statusChanges + quotes }
    })
    rows.sort((a, b) => b.total - a.total || b.completed - a.completed || a.name.localeCompare(b.name))
    return { ...range, rows: rows.slice(0, 10) }
  }

  private async totals(range: DayRange): Promise<DashboardTotals & { byStatus: Record<OrderStatus, number> }> {
    const [groups, newCustomers] = await Promise.all([this.prisma.order.groupBy(statusGroupArgs(createdIn(range))), this.prisma.user.count({ where: createdIn(range) })])
    return { ...orderTotals(groups), newCustomers }
  }

  /** Orders and confirmed revenue per day (or per week from Monday), with empty days and weeks filled in. */
  private async series(range: DayRange, bucket: 'day' | 'week'): Promise<DashboardDto['series']> {
    // createdAt is stored as UTC without a time zone; convert it to a Dhaka calendar day first.
    const rows = await this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
      SELECT to_char(date_trunc(${bucket}, ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka'), 'YYYY-MM-DD') AS day,
             count(*)::int AS orders,
             coalesce(sum(total) FILTER (WHERE status::text IN (${Prisma.join([...REVENUE_STATUSES])})), 0)::int AS revenue
      FROM "Order"
      WHERE "createdAt" >= (${bdDayStart(range.from).toISOString()}::timestamptz AT TIME ZONE 'UTC')
        AND "createdAt" < (${bdDayEnd(range.to).toISOString()}::timestamptz AT TIME ZONE 'UTC')
      GROUP BY 1
      ORDER BY 1`
    const byDay = new Map(rows.map(row => [row.day, row]))
    // Weeks start on Monday, as date_trunc('week') does.
    const first = bucket === 'week' ? addDays(range.from, -((new Date(`${range.from}T00:00:00Z`).getUTCDay() + 6) % 7)) : range.from
    const step = bucket === 'week' ? 7 : 1
    const points: DashboardDto['series'] = []
    for (let date = first; date <= range.to; date = addDays(date, step)) {
      const row = byDay.get(date)
      points.push({ date, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 })
    }
    return points
  }
}
