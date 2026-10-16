import { billBreakdown, customerConfirmedContent, feeChanges, quotedContent } from './notification.content'

const order = {
  id: 'ord_1',
  number: 1042,
  service: 'bazar' as const,
  itemsTotal: 610,
  serviceFee: 150,
  deliveryFee: 120,
  total: 880,
  scheduledDate: new Date('2026-10-18T00:00:00.000Z'),
  scheduledTime: '08:30',
  user: { name: 'Rahim' },
}
const placed = { serviceFee: 150, deliveryFee: 80, total: 230 }

describe('quote notifications', () => {
  it('spells out the bill, leaving out a fee of 0', () => {
    expect(billBreakdown(order)).toEqual({
      bn: 'বাজার 610 + মজুরী 150 + ডেলিভারী 120 = মোট 880 টাকা',
      en: 'Bazar Tk 610 + shopping fee Tk 150 + delivery Tk 120 = Tk 880',
    })
    expect(billBreakdown({ service: 'medicine', itemsTotal: 300, serviceFee: 0, deliveryFee: 60, total: 360 }).en).toBe('Medicines Tk 300 + delivery Tk 60 = Tk 360')
  })

  it('names only the charges staff changed', () => {
    expect(feeChanges(placed, order)).toEqual([{ bn: 'ডেলিভারী খরচ 80 → 120 টাকা', en: 'Delivery charge Tk 80 → Tk 120' }])
    expect(feeChanges({ ...placed, deliveryFee: 120 }, order)).toEqual([])
  })

  it('first price: the bill, the changed charge, the note, then what to do', () => {
    const content = quotedContent(order, { previous: placed, note: 'দূরত্ব বেশি', requote: false })
    expect(content.type).toBe('ORDER_BILL')
    expect(content.title.en).toBe('Order PA-1042: price ready')
    expect(content.body.bn).toBe('বাজার 610 + মজুরী 150 + ডেলিভারী 120 = মোট 880 টাকা। ডেলিভারী খরচ 80 → 120 টাকা। দূরত্ব বেশি। দেখে কনফার্ম বা বাতিল করুন।')
    expect(content.body.en).toBe('Bazar Tk 610 + shopping fee Tk 150 + delivery Tk 120 = Tk 880. Delivery charge Tk 80 → Tk 120. দূরত্ব বেশি. Please confirm or cancel.')
    expect(content.data).toEqual({ orderId: 'ord_1', orderCode: 'PA-1042', status: 'QUOTED' })
  })

  it('new price: says how the total moved and keeps the staff note', () => {
    const content = quotedContent(order, { previous: { serviceFee: 150, deliveryFee: 120, total: 840 }, note: 'Diamond potatoes instead.', requote: true })
    expect(content.title.en).toBe('Order PA-1042: new price')
    expect(content.body.en).toBe('Total changed from Tk 840 to Tk 880. Bazar Tk 610 + shopping fee Tk 150 + delivery Tk 120 = Tk 880. Diamond potatoes instead. Please confirm or cancel.')
  })

  it('tells staff when to deliver once the customer confirms', () => {
    expect(customerConfirmedContent(order, 'BOOKED').body.en).toBe('Rahim confirmed the price · Tk 880 · delivery 2026-10-18, 08:30.')
  })
})
