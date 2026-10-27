import { Inject, Injectable, Logger, type OnApplicationShutdown } from '@nestjs/common'
import type { NotificationData } from '@/shared'

import type { DeviceToken, Notification } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { inBatches, type NotificationChannel } from './channels'
import { FCM_SENDER, type FcmMessage, type FcmSender } from './fcm.sender'

const CONCURRENCY = 8

/**
 * The message for one phone, in the language the app registered with. The Android channel ids
 * (orders, news) and the icon are the ones the app creates (mobile/lib/core/notifications). The tag
 * matches Web Push's, so a newer message about the same order or offer replaces the older one.
 */
export function fcmMessage(
  row: Pick<Notification, 'id' | 'type' | 'titleBn' | 'titleEn' | 'bodyBn' | 'bodyEn' | 'data'>,
  device: Pick<DeviceToken, 'token' | 'lang'>,
): FcmMessage {
  const data = (row.data ?? {}) as NotificationData
  const en = device.lang === 'en'
  // Order news is time-critical (a price waiting for a confirm); offers and announcements are not.
  const isOrder = row.type.startsWith('ORDER_')
  const tag = data.orderId ? `order-${data.orderId}` : data.offerId ? `offer-${data.offerId}` : `notification-${row.id}`
  return {
    token: device.token,
    notification: { title: en ? row.titleEn : row.titleBn, body: en ? row.bodyEn : row.bodyBn },
    data: {
      notificationId: row.id,
      type: row.type,
      ...(data.orderId ? { orderId: data.orderId } : {}),
      ...(data.offerId ? { offerId: data.offerId } : {}),
    },
    android: {
      priority: isOrder ? 'HIGH' : 'NORMAL',
      ttl: '86400s',
      notification: { channel_id: isOrder ? 'orders' : 'news', tag, icon: 'ic_stat_notify', color: '#1265d8', sound: 'default', default_vibrate_timings: true },
    },
    apns: { headers: { 'apns-priority': '10', 'apns-collapse-id': tag }, payload: { aps: { sound: 'default', 'thread-id': tag } } },
  }
}

/**
 * Push to the Kingfisher app (Android and iPhone) through Firebase Cloud Messaging, for every
 * customer notification, on every phone the customer is signed in on. Like Web Push it sends in the
 * background; a phone whose app was uninstalled (UNREGISTERED) is forgotten.
 */
@Injectable()
export class FcmChannel implements NotificationChannel, OnApplicationShutdown {
  readonly name = 'fcm'
  private readonly logger = new Logger(FcmChannel.name)
  private readonly inFlight = new Set<Promise<void>>()

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FCM_SENDER) private readonly sender: FcmSender | null,
  ) {}

  deliver(notifications: Notification[]) {
    const rows = notifications.filter(row => row.userId)
    if (!this.sender || !rows.length) return
    const job = this.send(rows)
      .catch(error => this.logger.error(`FCM delivery failed: ${error instanceof Error ? error.stack : String(error)}`))
      .finally(() => this.inFlight.delete(job))
    this.inFlight.add(job)
  }

  /** Lets messages already being sent finish before the database connection closes. */
  async onApplicationShutdown() {
    await Promise.allSettled([...this.inFlight])
  }

  private async send(rows: Notification[]) {
    const userIds = [...new Set(rows.map(row => row.userId!))]
    const devices = await this.prisma.deviceToken.findMany({ where: { userId: { in: userIds } } })
    if (!devices.length) return

    const byUser = new Map<string, DeviceToken[]>()
    for (const device of devices) byUser.set(device.userId, [...(byUser.get(device.userId) ?? []), device])
    const jobs = rows.flatMap(row => (byUser.get(row.userId!) ?? []).map(device => ({ row, device })))
    await inBatches(jobs, CONCURRENCY, ({ row, device }) => this.push(row, device))
  }

  private async push(row: Notification, device: DeviceToken) {
    try {
      await this.sender!(fcmMessage(row, device))
    } catch (error) {
      const { statusCode, errorCode } = error as { statusCode?: number; errorCode?: string }
      if (errorCode === 'UNREGISTERED' || statusCode === 404) {
        await this.prisma.deviceToken.deleteMany({ where: { id: device.id } })
        return
      }
      this.logger.warn(`FCM send failed: ${statusCode ?? ''} ${errorCode ?? (error instanceof Error ? error.message : String(error))}`.trim())
    }
  }
}
