import { Module } from '@nestjs/common'

import { UploadsModule } from '../uploads/uploads.module'
import { ApkService } from './apk.service'
import { BackupService } from './backup.service'
import { AdminSystemController, AppDownloadController } from './system.controller'

/** The System page: database backups and the app's APK. */
@Module({
  imports: [UploadsModule],
  controllers: [AppDownloadController, AdminSystemController],
  providers: [BackupService, ApkService],
})
export class SystemModule {}
