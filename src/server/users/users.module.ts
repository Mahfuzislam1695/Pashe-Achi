import { Module } from '@nestjs/common'

import { UploadsModule } from '../uploads/uploads.module'
import { CustomersController } from './customers.controller'
import { MeController } from './me.controller'
import { UsersService } from './users.service'

@Module({
  // StorageService: deleting an account deletes its prescriptions.
  imports: [UploadsModule],
  controllers: [MeController, CustomersController],
  providers: [UsersService],
})
export class UsersModule {}
