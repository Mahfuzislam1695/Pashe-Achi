import { orderTotals } from './order-stats'

const group = (status: Parameters<typeof orderTotals>[0][number]['status'], count: number, total: number) => ({ status, _count: { _all: count }, _sum: { total } })

describe('orderTotals', () => {
  it('counts revenue only from confirmed bills (booked, in progress, completed)', () => {
    const totals = orderTotals([group('PENDING', 4, 400), group('QUOTED', 2, 900), group('BOOKED', 1, 1000), group('IN_PROGRESS', 1, 500), group('COMPLETED', 2, 1500), group('CANCELLED', 2, 700)])
    expect(totals.orders).toBe(12)
    expect(totals.revenue).toBe(3000)
    expect(totals.completedRevenue).toBe(1500)
    // 3000 over the 4 confirmed orders.
    expect(totals.averageBill).toBe(750)
    expect(totals.cancelledRate).toBeCloseTo(2 / 12)
    expect(totals.byStatus).toEqual({ PENDING: 4, QUOTED: 2, BOOKED: 1, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: 2 })
  })

  it('reports zeros, not NaN, when there is nothing', () => {
    expect(orderTotals([])).toEqual({
      orders: 0,
      revenue: 0,
      completedRevenue: 0,
      averageBill: 0,
      cancelledRate: 0,
      byStatus: { PENDING: 0, QUOTED: 0, BOOKED: 0, IN_PROGRESS: 0, COMPLETED: 0, CANCELLED: 0 },
    })
  })
})
