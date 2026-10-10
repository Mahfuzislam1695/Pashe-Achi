import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CatalogDto, Pricing, SupportSettings, VehicleDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Roles } from '../auth/guards'
import { IdParamDto, PricingDto, SupportSettingsDto, UpdateVehicleDto, VehicleDto as VehicleBodyDto } from '../common/dto'
import { CatalogService } from './catalog.service'

@ApiTags('Catalog')
@Controller('catalog')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Fees, active vehicles and the support line (public)' })
  get(): Promise<CatalogDto> {
    return this.catalog.getCatalog()
  }
}

@ApiTags('Admin: catalog')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/catalog')
export class AdminCatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @ApiOperation({ summary: 'Catalog including inactive vehicles' })
  get(): Promise<CatalogDto> {
    return this.catalog.getCatalog(true)
  }

  @Put('pricing')
  @Roles('MANAGER')
  updatePricing(@Actor() actor: AuditActor, @Body() body: PricingDto): Promise<Pricing> {
    return this.catalog.updatePricing(body, actor)
  }

  @Put('support')
  @Roles('MANAGER')
  updateSupport(@Actor() actor: AuditActor, @Body() body: SupportSettingsDto): Promise<SupportSettings> {
    return this.catalog.updateSupport(body, actor)
  }

  @Post('vehicles')
  @Roles('MANAGER')
  createVehicle(@Actor() actor: AuditActor, @Body() body: VehicleBodyDto): Promise<VehicleDto> {
    return this.catalog.createVehicle(body, actor)
  }

  @Patch('vehicles/:id')
  @Roles('MANAGER')
  updateVehicle(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateVehicleDto): Promise<VehicleDto> {
    return this.catalog.updateVehicle(id, body, actor)
  }
}
