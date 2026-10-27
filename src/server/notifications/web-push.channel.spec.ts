import { pushMessage } from './web-push.channel'

const row = (type: 'ORDER_BILL' | 'OFFER' | 'ANNOUNCEMENT', data: object) => ({
  id: 'ntf_1',
  type,
  titleBn: 'শিরোনাম',
  titleEn: 'Title',
  bodyBn: 'বিবরণ',
  bodyEn: 'Body',
  data,
})

describe('push messages', () => {
  it("opens the order on the customer's site, in the browser's language", () => {
    const bn = pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'CUSTOMER', basePath: '', lang: 'bn' })
    expect(bn.payload).toEqual({ title: 'শিরোনাম', body: 'বিবরণ', url: '/orders/ord_1', tag: 'order-ord_1', area: 'customer', lang: 'bn' })
    expect(bn.options).toEqual({ TTL: 86_400, urgency: 'high' })

    const en = pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'CUSTOMER', basePath: '', lang: 'en' })
    expect(en.payload).toMatchObject({ title: 'Title', body: 'Body', url: '/orders/ord_1' })
  })

  it('sends offers to the offers page and staff to the admin panel', () => {
    const offer = pushMessage(row('OFFER', { offerId: 'off_1' }), { audience: 'CUSTOMER', basePath: '', lang: 'bn' })
    expect(offer.payload).toMatchObject({ url: '/offers', tag: 'offer-off_1' })
    expect(offer.options.urgency).toBe('normal')

    expect(pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'ADMIN', basePath: '/admin', lang: 'en' }).payload).toMatchObject({ url: '/admin/orders/ord_1', area: 'admin' })
    expect(pushMessage(row('ANNOUNCEMENT', {}), { audience: 'CUSTOMER', basePath: '', lang: 'bn' }).payload).toMatchObject({ url: '/notifications', tag: 'notification-ntf_1' })
  })
})
