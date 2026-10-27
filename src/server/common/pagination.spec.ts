import { offsetArgs, toPaged } from './pagination'

describe('numbered pages', () => {
  it('skips the pages before the one asked for', () => {
    expect(offsetArgs(1, 25)).toEqual({ skip: 0, take: 25 })
    expect(offsetArgs(3, 10)).toEqual({ skip: 20, take: 10 })
  })

  it('reports the total and how many pages it fills', () => {
    expect(toPaged([{ id: 'a' }], 51, { page: 3, limit: 25 }, row => row.id)).toEqual({ items: ['a'], total: 51, page: 3, limit: 25, pageCount: 3 })
    expect(toPaged([], 0, { page: 1, limit: 25 }, row => row)).toMatchObject({ items: [], total: 0, pageCount: 0 })
  })
})
