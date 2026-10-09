import { Module } from '@nestjs/common'

import { CatalogModule } from '../catalog/catalog.module'
import { AdminOrdersController, OrdersController } from './orders.controller'
import { OrdersService } from './orders.service'

@Module({
  imports: [CatalogModule],
  controllers: [OrdersController, AdminOrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
