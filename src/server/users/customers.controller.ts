import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { type AdminCustomerDto, can, type CustomerStatsDto, type PagedList } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import type { AdminPrincipal } from '../auth/auth.types'
import { AdminGuard, Can, CurrentAdmin } from '../auth/guards'
import { AppException } from '../common/app.exception'
import { CustomerStatsQueryDto, IdParamDto, ListCustomersQueryDto, UpdateCustomerDto } from '../common/dto'
import { UsersService } from './users.service'

@ApiTags('Admin: customers')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('customers.view')
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Numbered pages of customers: search by name, mobile or location; filter by status, ordered or not and joining day; sort' })
  list(@Query() query: ListCustomersQueryDto): Promise<PagedList<AdminCustomerDto>> {
    return this.users.listCustomers(query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'The customers the search matches, by status and by whether they have ordered, and how many joined in the period' })
  stats(@Query() query: CustomerStatsQueryDto): Promise<CustomerStatsDto> {
    return this.users.customerStats(query)
  }

  @Get(':id')
  get(@Param() { id }: IdParamDto): Promise<AdminCustomerDto> {
    return this.users.getCustomer(id)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Block/unblock a customer (customers.block) or set their points (customers.edit_points)' })
  update(@CurrentAdmin() admin: AdminPrincipal, @Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateCustomerDto): Promise<AdminCustomerDto> {
    if (body.isBlocked !== undefined && !can(admin, 'customers.block')) throw AppException.forbidden()
    if (body.points !== undefined && !can(admin, 'customers.edit_points')) throw AppException.forbidden()
    return this.users.updateCustomer(id, body, actor)
  }
}
