import { Injectable } from '@nestjs/common'
import { SOCKET_EVENTS } from '@/shared'

import type { Notification } from '../generated/prisma/client'
import { toNotificationDto } from './notification.mapper'
import { NotificationsGateway } from './notifications.gateway'

/**
 * A way of delivering a stored notification. In-app realtime is the only channel today. Push
 * (FCM, for the Flutter app) or SMS can be added as another class in NOTIFICATION_CHANNELS
 * without changing anything that sends notifications.
 */
export interface NotificationChannel {
  readonly name: string
  deliver(notifications: Notification[]): Promise<void> | void
}

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS')

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
