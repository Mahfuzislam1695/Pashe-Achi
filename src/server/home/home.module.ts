import { Module } from '@nestjs/common'

import { UploadsModule } from '../uploads/uploads.module'
import { AdminHomeController, HomeController } from './home.controller'
import { HomeService } from './home.service'

@Module({
  imports: [UploadsModule],
  controllers: [HomeController, AdminHomeController],
  providers: [HomeService],
})
export class HomeModule {}
