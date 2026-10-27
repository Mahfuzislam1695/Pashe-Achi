import { Module } from '@nestjs/common'

import { ENV, type Env } from '../config/env'
import { NOTIFICATION_CHANNELS, RealtimeChannel } from './channels'
import { FcmChannel } from './fcm.channel'
import { createFcmSender, FCM_SENDER } from './fcm.sender'
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
    { provide: FCM_SENDER, useFactory: (env: Env) => createFcmSender(env), inject: [ENV] },
    RealtimeChannel,
    WebPushChannel,
    FcmChannel,
    // Add new delivery channels (SMS) to this list.
    {
      provide: NOTIFICATION_CHANNELS,
      useFactory: (realtime: RealtimeChannel, webPush: WebPushChannel, fcm: FcmChannel) => [realtime, webPush, fcm],
      inject: [RealtimeChannel, WebPushChannel, FcmChannel],
    },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
