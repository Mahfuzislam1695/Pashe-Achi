import { Module } from '@nestjs/common'

import { ENV } from '../config/env'
import { NOTIFICATION_CHANNELS, RealtimeChannel } from './channels'
import { AdminNotificationsController, NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsListener } from './notifications.listener'
import { NotificationsService } from './notifications.service'
import { createPushSender, PUSH_SENDER, PushService } from './push.service'
import { WebPushChannel } from './web-push.channel'

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationsListener,
    PushService,
    { provide: PUSH_SENDER, useFactory: createPushSender, inject: [ENV] },
    RealtimeChannel,
    WebPushChannel,
    // Add new delivery channels (FCM for the Flutter app, SMS) to this list.
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (realtime: RealtimeChannel, webPush: WebPushChannel) => [realtime, webPush],
      inject: [RealtimeChannel, WebPushChannel],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
