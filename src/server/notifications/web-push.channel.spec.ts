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
  it("opens the order in the customer's own version, in their language", () => {
    const web = pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'CUSTOMER', basePath: '', lang: 'bn' })
    expect(web.payload).toEqual({ title: 'শিরোনাম', body: 'বিবরণ', url: '/orders/ord_1', tag: 'order-ord_1', area: 'customer', lang: 'bn' })
    expect(web.options).toEqual({ TTL: 86_400, urgency: 'high' })

    const app = pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'CUSTOMER', basePath: '/app', lang: 'en' })
    expect(app.payload).toMatchObject({ title: 'Title', body: 'Body', url: '/app/orders/ord_1' })
  })

  it('sends offers to the offers page and staff to the admin panel', () => {
    const offer = pushMessage(row('OFFER', { offerId: 'off_1' }), { audience: 'CUSTOMER', basePath: '/app', lang: 'bn' })
    expect(offer.payload).toMatchObject({ url: '/app/offers', tag: 'offer-off_1' })
    expect(offer.options.urgency).toBe('normal')

    expect(pushMessage(row('ORDER_BILL', { orderId: 'ord_1' }), { audience: 'ADMIN', basePath: '/admin', lang: 'en' }).payload).toMatchObject({ url: '/admin/orders/ord_1', area: 'admin' })
    expect(pushMessage(row('ANNOUNCEMENT', {}), { audience: 'CUSTOMER', basePath: '', lang: 'bn' }).payload).toMatchObject({ url: '/notifications', tag: 'notification-ntf_1' })
  })
})
