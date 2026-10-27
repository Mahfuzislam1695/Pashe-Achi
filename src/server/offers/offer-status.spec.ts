import { OFFER_STATUSES } from '@/shared'

import { offerStatus, statusWhere } from './offers.service'

type Row = { isActive: boolean; startsOn: Date; endsOn: Date }
type Bound = { gt?: Date; gte?: Date; lt?: Date; lte?: Date }

// Just enough of Prisma's filter semantics to run statusWhere() against plain rows.
const matches = (row: Row, where: Record<string, unknown>) =>
  Object.entries(where).every(([field, condition]) => {
    const value = row[field as keyof Row]
    if (typeof condition !== 'object' || condition === null) return value === condition
    const bound = condition as Bound
    const time = (value as Date).getTime()
    return (
      (!bound.gt || time > bound.gt.getTime()) &&
      (!bound.gte || time >= bound.gte.getTime()) &&
      (!bound.lt || time < bound.lt.getTime()) &&
      (!bound.lte || time <= bound.lte.getTime())
    )
  })

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('statusWhere', () => {
  const today = '2026-10-27'
  const rows: Row[] = [
    { isActive: true, startsOn: day('2026-10-27'), endsOn: day('2026-10-27') },
    { isActive: true, startsOn: day('2026-10-20'), endsOn: day('2026-10-30') },
    { isActive: true, startsOn: day('2026-10-28'), endsOn: day('2026-11-05') },
    { isActive: true, startsOn: day('2026-10-01'), endsOn: day('2026-10-26') },
    { isActive: false, startsOn: day('2026-10-20'), endsOn: day('2026-10-30') },
    { isActive: false, startsOn: day('2026-09-01'), endsOn: day('2026-09-02') },
  ]

  it('finds exactly the offers offerStatus() gives each status, so every offer is in one tab', () => {
    for (const row of rows) {
      const found = OFFER_STATUSES.filter(status => matches(row, statusWhere(status, today) as Record<string, unknown>))
      expect(found).toEqual([offerStatus(row, today)])
    }
  })
})
