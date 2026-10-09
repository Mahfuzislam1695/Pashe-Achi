import { Body, Controller, HttpCode, Inject, Patch, Post, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { CustomerDto } from '@/shared'
import type { Response } from 'express'

import type { CustomerPrincipal } from '../auth/auth.types'
import { clearAuthCookies } from '../auth/cookies'
import { CurrentCustomer, CustomerGuard } from '../auth/guards'
import { ChangePasswordDto, UpdateProfileDto } from '../common/dto'
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
  @ApiOperation({ summary: 'Update name, mobile, location and language' })
  update(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: UpdateProfileDto): Promise<CustomerDto> {
    return this.users.updateProfile(customer.id, body)
  }

  @Post('password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Change password (logs out every session, including this one)' })
  async changePassword(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    await this.users.changePassword(customer.id, body)
    clearAuthCookies(response, this.env, 'customer')
  }
}
