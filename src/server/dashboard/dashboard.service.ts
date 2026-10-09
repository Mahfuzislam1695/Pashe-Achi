import { Injectable } from '@nestjs/common'
import { type DashboardDto, isoDateInBd, SERVICE_IDS } from '@/shared'

import { bdDayStart } from '../common/pagination'
import { PrismaService } from '../prisma/prisma.service'
import { summaryInclude, toOrderSummary } from '../orders/order.mapper'

const DAY_MS = 24 * 60 * 60 * 1000

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /** Counts and revenue (non-cancelled orders) for today and the last `days` days, in Bangladesh time. */
  async get(days: number): Promise<DashboardDto> {
    const todayStart = bdDayStart(isoDateInBd())
    const periodStart = new Date(todayStart.getTime() - (days - 1) * DAY_MS)
    const notCancelled = { status: { not: 'CANCELLED' as const } }

    const [today, pending, active, customers, byService, daily, recent] = await Promise.all([
      this.prisma.order.aggregate({ where: { createdAt: { gte: todayStart }, ...notCancelled }, _count: { _all: true }, _sum: { total: true } }),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.prisma.order.count({ where: { status: { in: ['BOOKED', 'IN_PROGRESS'] } } }),
      this.prisma.user.count(),
      this.prisma.order.groupBy({ by: ['service'], where: { createdAt: { gte: periodStart }, ...notCancelled }, _count: { _all: true }, _sum: { total: true } }),
      // createdAt is stored as UTC without a time zone; convert it to a Dhaka calendar day.
      this.prisma.$queryRaw<{ day: string; orders: number; revenue: number }[]>`
        SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dhaka', 'YYYY-MM-DD') AS day,
               count(*)::int AS orders,
               coalesce(sum(total), 0)::int AS revenue
        FROM "Order"
        WHERE "createdAt" >= (${periodStart.toISOString()}::timestamptz AT TIME ZONE 'UTC') AND status <> 'CANCELLED'
        GROUP BY 1
        ORDER BY 1`,
      this.prisma.order.findMany({ include: summaryInclude, orderBy: { createdAt: 'desc' }, take: 8 }),
    ])

    const perDay = new Map(daily.map(row => [row.day, row]))
    return {
      days,
      today: { orders: today._count._all, revenue: today._sum.total ?? 0 },
      pending,
      active,
      customers,
      byService: SERVICE_IDS.map(service => {
        const row = byService.find(entry => entry.service === service)
        return { service, orders: row?._count._all ?? 0, revenue: row?._sum.total ?? 0 }
      }),
      daily: Array.from({ length: days }, (_, index) => {
        const date = isoDateInBd(new Date(periodStart.getTime() + index * DAY_MS + 60 * 60 * 1000))
        const row = perDay.get(date)
        return { date, orders: row?.orders ?? 0, revenue: row?.revenue ?? 0 }
      }),
      recent: recent.map(order => toOrderSummary(order, true)),
    }
  }
}
