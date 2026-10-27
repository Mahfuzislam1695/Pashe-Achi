import { describe, expect, it } from 'vitest'

import { addDays, dayCount, pageWindow } from './format'
import { dashboardQuerySchema, dashboardRange, previousRange } from './schemas/admin'
import { listOrdersQuerySchema } from './schemas/orders'

describe('day arithmetic', () => {
  it('moves across month and year ends', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })

  it('counts both ends of a range', () => {
    expect(dayCount('2026-10-27', '2026-10-27')).toBe(1)
    expect(dayCount('2026-10-01', '2026-10-31')).toBe(31)
  })
})

describe('pageWindow', () => {
  it('lists every page when there are few', () => {
    expect(pageWindow(1, 1)).toEqual([1])
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('keeps the first and last page and marks each gap with null', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, null, 20])
    expect(pageWindow(10, 20)).toEqual([1, null, 9, 10, 11, null, 20])
    expect(pageWindow(20, 20)).toEqual([1, null, 16, 17, 18, 19, 20])
  })

  it('always shows the same number of buttons, so the bar does not jump', () => {
    for (let page = 1; page <= 30; page++) expect(pageWindow(page, 30, 2)).toHaveLength(9)
  })
})

describe('dashboard period', () => {
  it('defaults to the last 7 days up to today', () => {
    expect(dashboardRange({}, '2026-10-27')).toEqual({ from: '2026-10-21', to: '2026-10-27' })
    expect(dashboardRange({ days: 30 }, '2026-10-27')).toEqual({ from: '2026-09-28', to: '2026-10-27' })
  })

  it('compares with the period of the same length just before', () => {
    expect(previousRange({ from: '2026-10-21', to: '2026-10-27' })).toEqual({ from: '2026-10-14', to: '2026-10-20' })
    expect(previousRange({ from: '2026-10-27', to: '2026-10-27' })).toEqual({ from: '2026-10-26', to: '2026-10-26' })
  })

  it('refuses a reversed range, one that ends in the future, or one over a year', () => {
    const code = (query: object) => {
      const result = dashboardQuerySchema.safeParse(query)
      return result.success ? null : result.error.issues[0]?.message
    }
    expect(code({ from: '2026-01-10', to: '2026-01-01' })).toBe('range.invalid')
    expect(code({ to: '2999-01-01' })).toBe('range.invalid')
    expect(code({ from: '2020-01-01', to: '2022-01-01' })).toBe('range.invalid')
    expect(code({ from: '2026-01-01', to: '2026-01-31' })).toBeNull()
  })
})

describe('admin list query', () => {
  it('reads page and limit from the query string, with defaults', () => {
    expect(listOrdersQuerySchema.parse({})).toMatchObject({ page: 1, limit: 25 })
    expect(listOrdersQuerySchema.parse({ page: '3', limit: '50' })).toMatchObject({ page: 3, limit: 50 })
    expect(listOrdersQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(listOrdersQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
  })

  it('refuses a date filter that ends before it starts', () => {
    const result = listOrdersQuerySchema.safeParse({ from: '2026-10-10', to: '2026-10-01' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('range.invalid')
  })
})
