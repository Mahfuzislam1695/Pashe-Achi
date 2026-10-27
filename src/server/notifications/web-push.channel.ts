import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common'
import type { Lang, NotificationData } from '@/shared'

import type { Notification, PushSubscription } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { inBatches, type NotificationChannel } from './channels'
import { PUSH_SENDER, type PushOptions, type PushSender } from './push.service'

const CONCURRENCY = 8
const ONE_DAY = 24 * 60 * 60

/** What the service worker (public/sw.js) shows, in the language the browser subscribed with. */
export interface PushPayload {
  title: string
  body: string
  /** Same-origin path a tap opens. */
  url: string
  /** A newer message with the same tag replaces the older one (one per order or offer). */
  tag: string
  /** Which side of the site it is for, so a focused tab of that side can skip it (it shows the toast). */
  area: 'customer' | 'admin'
  lang: Lang
}

/** The message for one browser. Customer paths match src/customer/lib/paths.tsx; admin paths are under /admin. */
export function pushMessage(
  row: Pick<Notification, 'id' | 'type' | 'titleBn' | 'titleEn' | 'bodyBn' | 'bodyEn' | 'data'>,
  subscription: Pick<PushSubscription, 'audience' | 'basePath' | 'lang'>,
): { payload: PushPayload; options: PushOptions } {
  const data = (row.data ?? {}) as NotificationData
  const admin = subscription.audience === 'ADMIN'
  const base = subscription.basePath
  const url = data.orderId ? `${base}/orders/${encodeURIComponent(data.orderId)}` : data.offerId && !admin ? `${base}/offers` : `${base}/notifications`
  const en = subscription.lang === 'en'
  return {
    payload: {
      title: en ? row.titleEn : row.titleBn,
      body: en ? row.bodyEn : row.bodyBn,
      url,
      tag: data.orderId ? `order-${data.orderId}` : data.offerId ? `offer-${data.offerId}` : `notification-${row.id}`,
      area: admin ? 'admin' : 'customer',
      lang: subscription.lang,
    },
    // Order news is time-critical (a price waiting for a confirm); offers and announcements are not.
    options: { TTL: ONE_DAY, urgency: row.type.startsWith('ORDER_') ? 'high' : 'normal' },
  }
}

/**
 * Phone and desktop notifications (Web Push) for every stored notification whose customer or admin
 * turned them on. Sending happens in the background, so a broadcast to every customer doesn't hold
 * up the request; a browser that unsubscribed (404/410 from its push service) is forgotten.
 */
@Injectable()
export class WebPushChannel implements NotificationChannel, OnApplicationShutdown {
  readonly name = 'web-push'
  private readonly logger = new Logger(WebPushChannel.name)
  private readonly inFlight = new Set<Promise<void>>()

  constructor(
    private readonly prisma: PrismaService,
    @Inject(PUSH_SENDER) private readonly sender: PushSender | null,
  ) {}

  deliver(notifications: Notification[]) {
    if (!this.sender || !notifications.length) return
    const job = this.send(notifications)
      .catch(error => this.logger.error(`Push delivery failed: ${error instanceof Error ? error.stack : String(error)}`))
      .finally(() => this.inFlight.delete(job))
    this.inFlight.add(job)
  }

  /** Lets messages already being sent finish before the database connection closes. */
  async onApplicationShutdown() {
    await Promise.allSettled([...this.inFlight])
  }

  private async send(rows: Notification[]) {
    const userIds = [...new Set(rows.flatMap(row => (row.userId ? [row.userId] : [])))]
    const adminIds = [...new Set(rows.flatMap(row => (row.adminId ? [row.adminId] : [])))]
    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: {
        OR: [
          ...(userIds.length ? [{ audience: 'CUSTOMER' as const, userId: { in: userIds } }] : []),
          ...(adminIds.length ? [{ audience: 'ADMIN' as const, adminId: { in: adminIds } }] : []),
        ],
      },
    })
    if (!subscriptions.length) return

    const byOwner = new Map<string, PushSubscription[]>()
    for (const subscription of subscriptions) {
      const owner = subscription.userId ? `u:${subscription.userId}` : `a:${subscription.adminId}`
      byOwner.set(owner, [...(byOwner.get(owner) ?? []), subscription])
    }
    const jobs = rows.flatMap(row => (byOwner.get(row.userId ? `u:${row.userId}` : `a:${row.adminId}`) ?? []).map(subscription => ({ row, subscription })))
    await inBatches(jobs, CONCURRENCY, ({ row, subscription }) => this.push(row, subscription))
  }

  private async push(row: Notification, subscription: PushSubscription) {
    const { payload, options } = pushMessage(row, subscription)
    try {
      await this.sender!({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(payload), options)
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 404 || status === 410) {
        await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } })
        return
      }
      this.logger.warn(`Push to ${new URL(subscription.endpoint).host} failed: ${status ?? (error instanceof Error ? error.message : String(error))}`)
    }
  }
}
