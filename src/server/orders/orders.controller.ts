import { Body, Controller, Get, HttpCode, Param, Patch, Post, Put, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuditLogDto, OrderDetail, OrderStatsDto, OrderSummary, PagedList, Paginated } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import type { CustomerPrincipal } from '../auth/auth.types'
import { AdminGuard, Can, CurrentCustomer, CustomerGuard } from '../auth/guards'
import {
  ConfirmOrderDto,
  CreateBazarOrderDto,
  CreateMedicineOrderDto,
  CreateParcelOrderDto,
  CreateShiftingOrderDto,
  IdParamDto,
  ListMyOrdersQueryDto,
  ListOrdersQueryDto,
  OrderStatsQueryDto,
  QuoteOrderDto,
  ShiftingQuoteDto,
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
  @ApiOperation({ summary: 'বাসা বদল: order a house shifting (staff send the vehicle rent by distance)' })
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
  @ApiOperation({ summary: 'Cancel your order before it is booked (also while deciding on a quote)' })
  cancel(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.cancelMine(customer.id, id, actor)
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @ApiOperation({ summary: "Accept the staff's prices for a bazar, medicine or shifting order (send the total and quoteVersion you saw); the order is booked" })
  confirm(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto, @Body() body: ConfirmOrderDto, @Actor() actor: AuditActor): Promise<OrderDetail> {
    return this.orders.confirmMine(customer.id, id, body, actor)
  }
}

@ApiTags('Admin: orders')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('orders.view')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Numbered pages, filtered by service, status, date range (placed or delivery day), customer or search text, and sorted' })
  list(@Query() query: ListOrdersQueryDto): Promise<PagedList<OrderSummary>> {
    return this.orders.list(query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'Counts per status and confirmed revenue for the orders the list filters match (status aside)' })
  stats(@Query() query: OrderStatsQueryDto): Promise<OrderStatsDto> {
    return this.orders.stats(query)
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
  @Can('orders.update_status')
  @ApiOperation({ summary: 'Move an order to its next status (the customer is notified)' })
  updateStatus(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateOrderStatusDto): Promise<OrderDetail> {
    return this.orders.updateStatus(actor, id, body)
  }

  @Put(':id/quote')
  @Can('orders.send_price')
  @ApiOperation({ summary: 'Price a bazar or medicine order (the whole list of lines); the customer is asked to confirm or cancel' })
  quote(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: QuoteOrderDto): Promise<OrderDetail> {
    return this.orders.quote(actor, id, body)
  }

  @Put(':id/shifting-quote')
  @Can('orders.send_price')
  @ApiOperation({ summary: "Price a shifting order's vehicle by distance; the customer is asked to confirm or cancel" })
  quoteShifting(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: ShiftingQuoteDto): Promise<OrderDetail> {
    return this.orders.quoteShifting(actor, id, body)
  }
}
