import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminCustomerDto, Paginated } from '@/shared'

import { AdminGuard, Roles } from '../auth/guards'
import { IdParamDto, ListCustomersQueryDto, UpdateCustomerDto } from '../common/dto'
import { UsersService } from './users.service'

@ApiTags('Admin: customers')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/customers')
export class CustomersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Search customers by name, mobile or location' })
  list(@Query() query: ListCustomersQueryDto): Promise<Paginated<AdminCustomerDto>> {
    return this.users.listCustomers(query)
  }

  @Get(':id')
  get(@Param() { id }: IdParamDto): Promise<AdminCustomerDto> {
    return this.users.getCustomer(id)
  }

  @Patch(':id')
  @Roles('MANAGER')
  @ApiOperation({ summary: 'Block/unblock a customer or set their points' })
  update(@Param() { id }: IdParamDto, @Body() body: UpdateCustomerDto): Promise<AdminCustomerDto> {
    return this.users.updateCustomer(id, body)
  }
}
