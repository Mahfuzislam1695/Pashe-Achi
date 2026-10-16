import { Module } from '@nestjs/common'

import { NotificationsModule } from '../notifications/notifications.module'
import { UploadsModule } from '../uploads/uploads.module'
import { AdminOffersController, OffersController } from './offers.controller'
import { OffersService } from './offers.service'

@Module({
  imports: [UploadsModule, NotificationsModule],
  controllers: [OffersController, AdminOffersController],
  providers: [OffersService],
})
export class OffersModule {}
