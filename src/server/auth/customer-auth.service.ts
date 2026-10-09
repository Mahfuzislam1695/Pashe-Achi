import { Injectable } from '@nestjs/common'
import type { AuthResponse, CustomerDto, LoginInput, SignupInput } from '@/shared'

import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import { toCustomerDto } from '../users/user.mapper'
import { DUMMY_HASH, hashPassword, verifyPassword } from './password'
import { TokenService } from './token.service'

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async signup(input: SignupInput, userAgent?: string): Promise<AuthResponse<CustomerDto>> {
    const existing = await this.prisma.user.findUnique({ where: { mobile: input.mobile }, select: { id: true } })
    if (existing) throw AppException.conflict('mobile.taken')

    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        mobile: input.mobile,
        location: input.location ?? '',
        lang: input.lang ?? 'bn',
        passwordHash: await hashPassword(input.password),
      },
    })
    const { refreshId: _, ...tokens } = await this.tokens.issue('customer', user.id, { userAgent })
    return { user: toCustomerDto(user), tokens }
  }

  async login(input: LoginInput, userAgent?: string): Promise<AuthResponse<CustomerDto>> {
    const user = await this.prisma.user.findUnique({ where: { mobile: input.mobile } })
    const valid = await verifyPassword(input.password, user?.passwordHash ?? DUMMY_HASH)
    if (!user || !valid) throw AppException.unauthorized('auth.invalid')
    if (user.isBlocked) throw AppException.forbidden('auth.blocked')

    const { refreshId: _, ...tokens } = await this.tokens.issue('customer', user.id, { userAgent })
    return { user: toCustomerDto(user), tokens }
  }

  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<AuthResponse<CustomerDto>> {
    const { ownerId, tokens } = await this.tokens.rotate('customer', refreshToken, userAgent)
    const user = await this.prisma.user.findUnique({ where: { id: ownerId } })
    if (!user) throw AppException.unauthorized()
    if (user.isBlocked) {
      await this.tokens.revokeAll('customer', user.id)
      throw AppException.forbidden('auth.blocked')
    }
    return { user: toCustomerDto(user), tokens }
  }

  logout(refreshToken: string | undefined) {
    return this.tokens.revoke(refreshToken)
  }
}
