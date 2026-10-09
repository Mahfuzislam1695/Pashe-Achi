import { Body, Controller, Get, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuthResponse, CustomerDto } from '@/shared'
import type { Request, Response } from 'express'

import { AppException } from '../common/app.exception'
import { LoginDto, RefreshDto, SignupDto } from '../common/dto'
import { ENV, type Env } from '../config/env'
import { PrismaService } from '../prisma/prisma.service'
import { toCustomerDto } from '../users/user.mapper'
import type { CustomerPrincipal } from './auth.types'
import { clearAuthCookies, readRefreshToken, setAuthCookies } from './cookies'
import { CustomerAuthService } from './customer-auth.service'
import { CurrentCustomer, CustomerGuard } from './guards'
import { AuthThrottle } from './throttle'

/**
 * Customer sign up / login. Browsers get httpOnly cookies; mobile apps use the tokens in the
 * response body (Authorization: Bearer <accessToken>, and refreshToken in the refresh body).
 */
@ApiTags('Customer auth')
@Controller('auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly prisma: PrismaService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  @Post('signup')
  @AuthThrottle()
  @ApiOperation({ summary: 'Create a customer account and log in' })
  async signup(@Body() body: SignupDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse<CustomerDto>> {
    const result = await this.auth.signup(body, request.get('user-agent'))
    setAuthCookies(response, this.env, 'customer', result.tokens)
    return result
  }

  @Post('login')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Log in with mobile number and password' })
  async login(@Body() body: LoginDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse<CustomerDto>> {
    const result = await this.auth.login(body, request.get('user-agent'))
    setAuthCookies(response, this.env, 'customer', result.tokens)
    return result
  }

  @Post('refresh')
  @HttpCode(200)
  @AuthThrottle()
  @ApiOperation({ summary: 'Exchange a refresh token (cookie or body) for a new token pair' })
  async refresh(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response): Promise<AuthResponse<CustomerDto>> {
    try {
      const result = await this.auth.refresh(readRefreshToken(request, 'customer', body.refreshToken), request.get('user-agent'))
      setAuthCookies(response, this.env, 'customer', result.tokens)
      return result
    } catch (error) {
      clearAuthCookies(response, this.env, 'customer')
      throw error
    }
  }

  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke the refresh token and clear the cookies' })
  async logout(@Body() body: RefreshDto, @Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.auth.logout(readRefreshToken(request, 'customer', body.refreshToken))
    clearAuthCookies(response, this.env, 'customer')
  }

  @Get('me')
  @UseGuards(CustomerGuard)
  @ApiBearerAuth()
  @ApiCookieAuth('pa_at')
  @ApiOperation({ summary: 'The logged-in customer' })
  async me(@CurrentCustomer() customer: CustomerPrincipal): Promise<CustomerDto> {
    const user = await this.prisma.user.findUnique({ where: { id: customer.id } })
    if (!user) throw AppException.unauthorized()
    return toCustomerDto(user)
  }
}
