import { Module } from '@nestjs/common'

import { LocalDiskStorage, StorageService } from './storage.service'
import { AdminUploadsController, UploadsController } from './uploads.controller'
import { UploadsService } from './uploads.service'

@Module({
  controllers: [UploadsController, AdminUploadsController],
  providers: [UploadsService, { provide: StorageService, useClass: LocalDiskStorage }],
  // StorageService is shared with offers (their pictures live next to the prescriptions).
  exports: [UploadsService, StorageService],
})
export class UploadsModule {}
