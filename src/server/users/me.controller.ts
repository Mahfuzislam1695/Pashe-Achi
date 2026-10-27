import { Body, Controller, Delete, HttpCode, Inject, Patch, Post, Put, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CustomerDto } from '@/shared'
import type { Response } from 'express'

import { Actor, type AuditActor } from '../audit/actor'
import type { CustomerPrincipal } from '../auth/auth.types'
import { clearAuthCookies } from '../auth/cookies'
import { CurrentCustomer, CustomerGuard } from '../auth/guards'
import { ChangePasswordDto, SetLocationDto, UpdateProfileDto } from '../common/dto'
import { ENV, type Env } from '../config/env'
import { UsersService } from './users.service'

@ApiTags('Customer profile')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('me')
export class MeController {
  constructor(
    private readonly users: UsersService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Patch()
  @ApiOperation({ summary: 'Update name, mobile and language' })
  update(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: UpdateProfileDto, @Actor() actor: AuditActor): Promise<CustomerDto> {
    return this.users.updateProfile(customer.id, body, actor)
  }

  @Put('location')
  @ApiOperation({ summary: 'Set my one location (picked on the map), replacing the old one' })
  setLocation(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: SetLocationDto, @Actor() actor: AuditActor): Promise<CustomerDto> {
    return this.users.updateLocation(customer.id, body, actor)
  }

  @Post('password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change password (logs out every session, including this one)' })
  async changePassword(
    @CurrentCustomer() customer: CustomerPrincipal,
    @Body() body: ChangePasswordDto,
    @Actor() actor: AuditActor,
    @Res({ passthrough: true }) response: Response,
  ) {
    await this.users.changePassword(customer.id, body, actor)
    clearAuthCookies(response, this.env, 'customer')
  }

  @Delete()
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete my account (refused while an order is running; ends every session)' })
  async deleteAccount(@CurrentCustomer() customer: CustomerPrincipal, @Actor() actor: AuditActor, @Res({ passthrough: true }) response: Response) {
    await this.users.deleteAccount(customer.id, actor)
    clearAuthCookies(response, this.env, 'customer')
  }
}
