import { Module } from '@nestjs/common'

import { CustomersController } from './customers.controller'
import { MeController } from './me.controller'
import { UsersService } from './users.service'

@Module({
  controllers: [MeController, CustomersController],
  providers: [UsersService],
})
export class UsersModule {}
