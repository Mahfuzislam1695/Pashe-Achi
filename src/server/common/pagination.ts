import type { PagedList, Paginated } from '@/shared'

/** Prisma arguments for keyset pagination on `id` with newest first. Fetches one extra row to detect a next page. */
export const pageArgs = (cursor: string | undefined, limit: number) => ({
  take: limit + 1,
  ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
})

export function toPage<TRow extends { id: string }, TDto>(rows: TRow[], limit: number, map: (row: TRow) => TDto): Paginated<TDto> {
  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows
  return { items: page.map(map), nextCursor: hasMore ? page[page.length - 1]!.id : null }
}

/** Start of the given YYYY-MM-DD day in Bangladesh time (UTC+6, no DST). */
export const bdDayStart = (isoDate: string) => new Date(`${isoDate}T00:00:00+06:00`)

/** Start of the day after the given YYYY-MM-DD day in Bangladesh time. */
export const bdDayEnd = (isoDate: string) => new Date(bdDayStart(isoDate).getTime() + 24 * 60 * 60 * 1000)

/** Prisma arguments for one numbered page (admin lists). */
export const offsetArgs = (page: number, limit: number) => ({ skip: (page - 1) * limit, take: limit })

/** A numbered page from its rows and the count of every row the filters match. */
export function toPaged<TRow, TDto>(rows: TRow[], total: number, query: { page: number; limit: number }, map: (row: TRow) => TDto): PagedList<TDto> {
  return { items: rows.map(map), total, page: query.page, limit: query.limit, pageCount: Math.ceil(total / query.limit) }
}

/** A createdAt filter for YYYY-MM-DD days in Bangladesh time, inclusive; undefined when neither is given. */
export const bdDayRange = (from: string | undefined, to: string | undefined) =>
  from || to ? { ...(from ? { gte: bdDayStart(from) } : {}), ...(to ? { lt: bdDayEnd(to) } : {}) } : undefined
