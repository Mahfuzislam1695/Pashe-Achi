import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminDto, AuthResponse } from '@/shared'
import type { Request, Response } from 'express'

import { ChangePasswordDto, LoginDto, RefreshDto } from '../common/dto'
import { ENV, type Env } from '../config/env'
import { AdminAuthService } from './admin-auth.service'
import type { AdminPrincipal } from './auth.types'
import { clearAuthCookies, readRefreshToken, setAuthCookies } from './cookies'
import { AdminGuard, CurrentAdmin } from './guards'
import { AuthThrottle } from './throttle'

@ApiTags('Admin auth')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly auth: AdminAuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('login')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Admin login with mobile number and password' })
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse<AdminDto>> {
    const result = await this.auth.login(body, request.get('user-agent'))
    setAuthCookies(response, this.env, 'admin', result.tokens)
    return result
  }

  @Post('refresh')
  @HttpCode(200)
  @AuthThrottle()
  async refresh(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse<AdminDto>> {
    try {
      const result = await this.auth.refresh(readRefreshToken(request, 'admin', body.refreshToken), request.get('user-agent'))
      setAuthCookies(response, this.env, 'admin', result.tokens)
      return result
    } catch (error) {
      clearAuthCookies(response, this.env, 'admin')
      throw error
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readRefreshToken(request, 'admin', body.refreshToken))
    clearAuthCookies(response, this.env, 'admin')
  }

  @Get('me')
  @UseGuards(AdminGuard)
  @ApiCookieAuth('pa_admin_at')
  me(@CurrentAdmin() admin: AdminPrincipal): Promise<AdminDto> {
    return this.auth.me(admin.id)
  }

  @Post('password')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @ApiOperation({ summary: 'Change your own password (logs out other sessions)' })
  async changePassword(@CurrentAdmin() admin: AdminPrincipal, @Body() body: ChangePasswordDto, @Res({ passthrough: true }) response: Response) {
    await this.auth.changePassword(admin.id, body)
    clearAuthCookies(response, this.env, 'admin')
  }
}
