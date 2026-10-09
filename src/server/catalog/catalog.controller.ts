import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CatalogDto, Pricing, SupportSettings, VehicleDto } from '@/shared'

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
  updatePricing(@Body() body: PricingDto): Promise<Pricing> {
    return this.catalog.updatePricing(body)
  }

  @Put('support')
  @Roles('MANAGER')
  updateSupport(@Body() body: SupportSettingsDto): Promise<SupportSettings> {
    return this.catalog.updateSupport(body)
  }

  @Post('vehicles')
  @Roles('MANAGER')
  createVehicle(@Body() body: VehicleBodyDto): Promise<VehicleDto> {
    return this.catalog.createVehicle(body)
  }

  @Patch('vehicles/:id')
  @Roles('MANAGER')
  updateVehicle(@Param() { id }: IdParamDto, @Body() body: UpdateVehicleDto): Promise<VehicleDto> {
    return this.catalog.updateVehicle(id, body)
  }
}
