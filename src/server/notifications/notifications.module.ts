import { Module } from '@nestjs/common'

import { NOTIFICATION_CHANNELS, RealtimeChannel } from './channels'
import { AdminNotificationsController, NotificationsController } from './notifications.controller'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsListener } from './notifications.listener'
import { NotificationsService } from './notifications.service'

@Module({
  controllers: [NotificationsController, AdminNotificationsController],
  providers: [
    NotificationsGateway,
    NotificationsService,
    NotificationsListener,
    RealtimeChannel,
    // Add new delivery channels (FCM push, SMS) to this list.
    { provide: NOTIFICATION_CHANNELS, useFactory: (realtime: RealtimeChannel) => [realtime], inject: [RealtimeChannel] },
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
