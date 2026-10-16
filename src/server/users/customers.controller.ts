import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminCustomerDto, Paginated, SavedLocationDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Roles } from '../auth/guards'
import { IdParamDto, ListCustomersQueryDto, UpdateCustomerDto } from '../common/dto'
import { SavedLocationsService } from './saved-locations.service'
import { UsersService } from './users.service'

@ApiTags('Admin: customers')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/customers')
export class CustomersController {
  constructor(
    private readonly users: UsersService,
    private readonly locations: SavedLocationsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Search customers by name, mobile or location' })
  list(@Query() query: ListCustomersQueryDto): Promise<Paginated<AdminCustomerDto>> {
    return this.users.listCustomers(query)
  }

  @Get(':id')
  get(@Param() { id }: IdParamDto): Promise<AdminCustomerDto> {
    return this.users.getCustomer(id)
  }

  @Get(':id/locations')
  @ApiOperation({ summary: "The customer's saved locations, the default first" })
  async locationsOf(@Param() { id }: IdParamDto): Promise<SavedLocationDto[]> {
    await this.users.getCustomer(id)
    return this.locations.list(id)
  }

  @Patch(':id')
  @Roles('MANAGER')
  @ApiOperation({ summary: 'Block/unblock a customer or set their points' })
  update(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateCustomerDto): Promise<AdminCustomerDto> {
    return this.users.updateCustomer(id, body, actor)
  }
}
