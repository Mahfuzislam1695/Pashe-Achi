import { describe, expect, it } from 'vitest'

import { calcBazar, calcMedicine, calcParcel, calcShifting, DEFAULT_PRICING } from './pricing'

// Totals from the paper sketches.
describe('pricing', () => {
  it('bazar: items + shopping fee + delivery (sketch total 760)', () => {
    expect(calcBazar(DEFAULT_PRICING, [300, 150, undefined, '80'])).toEqual({ itemsTotal: 530, serviceFee: 150, deliveryFee: 80, total: 760 })
  })

  it('bazar: blank, negative and invalid prices count as 0', () => {
    expect(calcBazar(DEFAULT_PRICING, ['', '-20', 'abc', null]).itemsTotal).toBe(0)
  })

  it('medicine: items + delivery (sketch total 160)', () => {
    expect(calcMedicine(DEFAULT_PRICING, [100])).toEqual({ itemsTotal: 100, serviceFee: 0, deliveryFee: 60, total: 160 })
  })

  it('shifting: vehicle + labour + floors (sketch total 1420)', () => {
    expect(calcShifting(DEFAULT_PRICING, { vehicleRate: 1200, labourers: 1, loadingFloor: 1, unloadingFloor: 1 })).toEqual({
      itemsTotal: 1200,
      serviceFee: 220,
      deliveryFee: 0,
      total: 1420,
    })
  })

  it('shifting: scales with labourers and floors', () => {
    expect(calcShifting(DEFAULT_PRICING, { vehicleRate: 1200, labourers: 3, loadingFloor: 5, unloadingFloor: 2 }).total).toBe(1200 + 450 + 250 + 40)
  })

  it('parcel: delivery only', () => {
    expect(calcParcel(DEFAULT_PRICING).total).toBe(60)
  })
})
