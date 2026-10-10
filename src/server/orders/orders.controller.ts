import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuditLogDto, OrderDetail, OrderSummary, Paginated } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import type { CustomerPrincipal } from '../auth/auth.types'
import { AdminGuard, CurrentCustomer, CustomerGuard } from '../auth/guards'
import {
  CreateBazarOrderDto,
  CreateMedicineOrderDto,
  CreateParcelOrderDto,
  CreateShiftingOrderDto,
  IdParamDto,
  ListMyOrdersQueryDto,
  ListOrdersQueryDto,
  UpdateOrderItemsDto,
  UpdateOrderStatusDto,
} from '../common/dto'
import { OrdersService } from './orders.service'

@ApiTags('Orders')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post('bazar')
  @ApiOperation({ summary: 'কাঁচা বাজার: place a fresh market order' })
  bazar(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: CreateBazarOrderDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.createBazar(customer.id, body, actor)
  }

  @Post('shifting')
  @ApiOperation({ summary: 'বাসা বদল: book a house shifting' })
  shifting(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: CreateShiftingOrderDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.createShifting(customer.id, body, actor)
  }

  @Post('medicine')
  @ApiOperation({ summary: 'জরুরী ঔষুধ: order medicine (upload the prescription first)' })
  medicine(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: CreateMedicineOrderDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.createMedicine(customer.id, body, actor)
  }

  @Post('parcel')
  @ApiOperation({ summary: 'পণ্য আদান প্রদান: send a parcel' })
  parcel(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: CreateParcelOrderDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.createParcel(customer.id, body, actor)
  }

  @Get()
  @ApiOperation({ summary: 'Your order history, newest first' })
  list(@CurrentCustomer() customer: CustomerPrincipal, @Query() query: ListMyOrdersQueryDto): Promise<Paginated<OrderSummary>> {
    return this.orders.listMine(customer.id, query)
  }

  @Get(':id')
  get(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto): Promise<OrderDetail> {
    return this.orders.getMine(customer.id, id)
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: 'Cancel your order while it is still pending' })
  cancel(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.cancelMine(customer.id, id, actor)
  }
}

@ApiTags('Admin: orders')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Filter by service, status, date range, customer or search text' })
  list(@Query() query: ListOrdersQueryDto): Promise<Paginated<OrderSummary>> {
    return this.orders.list(query)
  }

  @Get(':id')
  get(@Param() { id }: IdParamDto): Promise<OrderDetail> {
    return this.orders.get(id)
  }

  @Get(':id/history')
  @ApiOperation({ summary: "The order's history, oldest first: placed, every status change and bill correction, and who did each" })
  history(@Param() { id }: IdParamDto): Promise<AuditLogDto[]> {
    return this.audit.forEntity('ORDER', id)
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Move an order to its next status (the customer is notified)' })
  updateStatus(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateOrderStatusDto): Promise<OrderDetail> {
    return this.orders.updateStatus(actor, id, body)
  }

  @Patch(':id/items')
  @ApiOperation({ summary: 'Correct bazar/medicine line prices; the total is recomputed and the customer notified' })
  updateItems(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateOrderItemsDto): Promise<OrderDetail> {
    return this.orders.updateItems(actor, id, body)
  }
}
