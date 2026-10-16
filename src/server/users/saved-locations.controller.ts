import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { SavedLocationDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import type { CustomerPrincipal } from '../auth/auth.types'
import { CurrentCustomer, CustomerGuard } from '../auth/guards'
import { CreateSavedLocationDto, IdParamDto, UpdateSavedLocationDto } from '../common/dto'
import { SavedLocationsService } from './saved-locations.service'

@ApiTags('Customer profile')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('me/locations')
export class SavedLocationsController {
  constructor(private readonly locations: SavedLocationsService) {}

  @Get()
  @ApiOperation({ summary: 'My saved locations, the default first' })
  list(@CurrentCustomer() customer: CustomerPrincipal): Promise<SavedLocationDto[]> {
    return this.locations.list(customer.id)
  }

  @Post()
  @ApiOperation({ summary: 'Save a location (up to 10; the first one becomes the default)' })
  create(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: CreateSavedLocationDto, @Actor() actor: AuditActor): Promise<SavedLocationDto> {
    return this.locations.create(customer.id, body, actor)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, move or make a saved location the default' })
  update(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto, @Body() body: UpdateSavedLocationDto, @Actor() actor: AuditActor): Promise<SavedLocationDto> {
    return this.locations.update(customer.id, id, body, actor)
  }

  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a saved location' })
  async remove(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto, @Actor() actor: AuditActor) {
    await this.locations.remove(customer.id, id, actor)
  }
}
