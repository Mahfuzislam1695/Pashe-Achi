import { fcmMessage } from './fcm.channel'

const row = (type: 'ORDER_BILL' | 'ORDER_STATUS' | 'OFFER' | 'ANNOUNCEMENT', data: object) => ({
  id: 'ntf_1',
  type,
  titleBn: 'শিরোনাম',
  titleEn: 'Title',
  bodyBn: 'বিবরণ',
  bodyEn: 'Body',
  data,
})

describe('FCM messages', () => {
  it("writes in the phone's language and pops up on the orders channel for order news", () => {
    const bn = fcmMessage(row('ORDER_BILL', { orderId: 'ord_1', orderCode: 'PA-1001', status: 'QUOTED' }), { token: 'tok', lang: 'bn' })
    expect(bn).toEqual({
      token: 'tok',
      notification: { title: 'শিরোনাম', body: 'বিবরণ' },
      data: { notificationId: 'ntf_1', type: 'ORDER_BILL', orderId: 'ord_1' },
      android: {
        priority: 'HIGH',
        ttl: '86400s',
        notification: { channel_id: 'orders', tag: 'order-ord_1', icon: 'ic_stat_notify', color: '#1265d8', sound: 'default', default_vibrate_timings: true },
      },
      apns: { headers: { 'apns-priority': '10', 'apns-collapse-id': 'order-ord_1' }, payload: { aps: { sound: 'default', 'thread-id': 'order-ord_1' } } },
    })
    expect(fcmMessage(row('ORDER_STATUS', { orderId: 'ord_1' }), { token: 'tok', lang: 'en' }).notification).toEqual({ title: 'Title', body: 'Body' })
  })

  it('sends offers and announcements on the news channel, each with its own tag', () => {
    const offer = fcmMessage(row('OFFER', { offerId: 'off_1' }), { token: 'tok', lang: 'bn' })
    expect(offer.data).toEqual({ notificationId: 'ntf_1', type: 'OFFER', offerId: 'off_1' })
    expect(offer.android).toMatchObject({ priority: 'NORMAL', notification: { channel_id: 'news', tag: 'offer-off_1' } })

    const announcement = fcmMessage(row('ANNOUNCEMENT', {}), { token: 'tok', lang: 'bn' })
    expect(announcement.data).toEqual({ notificationId: 'ntf_1', type: 'ANNOUNCEMENT' })
    expect(announcement.android.notification.tag).toBe('notification-ntf_1')
  })

  it('keeps every data value a string, as FCM requires', () => {
    const message = fcmMessage(row('ORDER_BILL', { orderId: 'ord_1', orderCode: 'PA-1001' }), { token: 'tok', lang: 'bn' })
    expect(Object.values(message.data).every(value => typeof value === 'string')).toBe(true)
  })
})
