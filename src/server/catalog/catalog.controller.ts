import { Body, Controller, Get, Param, Patch, Post, Put, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CatalogDto, CustomerAuthSettings, DeliveryHours, Pricing, SupportSettings, VehicleDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Can } from '../auth/guards'
import { CustomerAuthDto, DeliveryHoursDto, IdParamDto, PricingDto, SupportSettingsDto, UpdateVehicleDto, VehicleDto as VehicleBodyDto } from '../common/dto'
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
  // Any admin: the order page needs the vehicles, and the fees are public anyway (GET /catalog).
  @ApiOperation({ summary: 'Catalog including inactive vehicles' })
  get(): Promise<CatalogDto> {
    return this.catalog.getCatalog(true)
  }

  @Put('pricing')
  @Can('catalog.edit')
  updatePricing(@Actor() actor: AuditActor, @Body() body: PricingDto): Promise<Pricing> {
    return this.catalog.updatePricing(body, actor)
  }

  @Put('support')
  @Can('catalog.edit')
  updateSupport(@Actor() actor: AuditActor, @Body() body: SupportSettingsDto): Promise<SupportSettings> {
    return this.catalog.updateSupport(body, actor)
  }

  @Put('customer-auth')
  @Can('catalog.customer_signin')
  @ApiOperation({ summary: 'Whether customers sign up and log in with a password' })
  updateCustomerAuth(@Actor() actor: AuditActor, @Body() body: CustomerAuthDto): Promise<CustomerAuthSettings> {
    return this.catalog.updateCustomerAuth(body, actor)
  }

  @Put('delivery-hours')
  @Can('catalog.edit')
  @ApiOperation({ summary: 'The ডেলিভারি টাইম windows per service (empty list: any time)' })
  updateDeliveryHours(@Actor() actor: AuditActor, @Body() body: DeliveryHoursDto): Promise<DeliveryHours> {
    return this.catalog.updateDeliveryHours(body, actor)
  }

  @Post('vehicles')
  @Can('catalog.edit')
  createVehicle(@Actor() actor: AuditActor, @Body() body: VehicleBodyDto): Promise<VehicleDto> {
    return this.catalog.createVehicle(body, actor)
  }

  @Patch('vehicles/:id')
  @Can('catalog.edit')
  updateVehicle(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateVehicleDto): Promise<VehicleDto> {
    return this.catalog.updateVehicle(id, body, actor)
  }
}
