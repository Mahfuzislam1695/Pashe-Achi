import { Injectable } from '@nestjs/common'
import { SOCKET_EVENTS } from '@/shared'

import type { Notification } from '../generated/prisma/client'
import { toNotificationDto } from './notification.mapper'
import { NotificationsGateway } from './notifications.gateway'

/**
 * A way of delivering a stored notification: in-app realtime (below), Web Push to browsers
 * (web-push.channel.ts) and push to the Kingfisher app's phones (fcm.channel.ts). SMS could be
 * another class in NOTIFICATION_CHANNELS without changing anything that sends notifications.
 */
export interface NotificationChannel {
  readonly name: string
  deliver(notifications: Notification[]): Promise<void> | void
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS')

/** Runs `work` over `items`, at most `limit` at a time. */
export async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  let next = 0
  const worker = async () => {
    while (next < items.length) await work(items[next++]!)
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

@Injectable()
export class RealtimeChannel implements NotificationChannel {
  readonly name = 'realtime'

  constructor(private readonly gateway: NotificationsGateway) {}

  deliver(notifications: Notification[]) {
    for (const row of notifications) {
      const dto = toNotificationDto(row)
      if (row.userId) this.gateway.toUser(row.userId, SOCKET_EVENTS.notificationNew, dto)
      if (row.adminId) this.gateway.toAdmin(row.adminId, SOCKET_EVENTS.notificationNew, dto)
    }
  }
}
