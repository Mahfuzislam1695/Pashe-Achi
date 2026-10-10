import { diffChanges } from './diff'

describe('diffChanges', () => {
  const pricing = { bazarShoppingFee: 150, bazarDeliveryFee: 80, medicineDeliveryFee: 60 }

  it('lists only the fields whose value changed, in the given order', () => {
    expect(diffChanges(pricing, { ...pricing, bazarDeliveryFee: 90, bazarShoppingFee: 999 }, ['bazarShoppingFee', 'bazarDeliveryFee', 'medicineDeliveryFee'])).toEqual([
      { field: 'bazarShoppingFee', from: 150, to: 999 },
      { field: 'bazarDeliveryFee', from: 80, to: 90 },
    ])
  })

  it('treats fields left out of the update as unchanged', () => {
    expect(diffChanges<{ isBlocked: boolean; points: number }>({ isBlocked: false, points: 10 }, { points: 25 }, ['isBlocked', 'points'])).toEqual([
      { field: 'points', from: 10, to: 25 },
    ])
  })

  it('reports a new record as changing from null', () => {
    expect(diffChanges(null, { rate: 1200, isActive: true }, ['rate', 'isActive'])).toEqual([
      { field: 'rate', from: null, to: 1200 },
      { field: 'isActive', from: null, to: true },
    ])
  })

  it('returns nothing when the values are the same', () => {
    expect(diffChanges({ name: 'রহিম', location: '' }, { name: 'রহিম', location: '' }, ['name', 'location'])).toEqual([])
  })
})
