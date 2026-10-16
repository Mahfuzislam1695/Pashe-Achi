import { Module } from '@nestjs/common'

import { CustomersController } from './customers.controller'
import { MeController } from './me.controller'
import { SavedLocationsController } from './saved-locations.controller'
import { SavedLocationsService } from './saved-locations.service'
import { UsersService } from './users.service'

@Module({
  controllers: [MeController, SavedLocationsController, CustomersController],
  providers: [UsersService, SavedLocationsService],
})
export class UsersModule {}
