import { Injectable } from '@nestjs/common'
import type { AuthResponse, CustomerDto, LoginInput, SignupInput } from '@/shared'

import { type ClientInfo, customerActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
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
    private readonly audit: AuditService,
  ) {}

  async signup(input: SignupInput, client: ClientInfo = {}): Promise<AuthResponse<CustomerDto>> {
    const existing = await this.prisma.user.findUnique({ where: { mobile: input.mobile }, select: { id: true } })
    if (existing) throw AppException.conflict('mobile.taken')

    const passwordHash = await hashPassword(input.password)
    const user = await this.prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: { name: input.name, mobile: input.mobile, location: input.location ?? '', lang: input.lang ?? 'bn', passwordHash },
      })
      await this.audit.record({
        action: 'CUSTOMER_SIGNED_UP',
        actor: customerActor(created, client),
        entity: { type: 'CUSTOMER', id: created.id, label: created.name },
      }, tx)
      return created
    })
    const { refreshId: _, ...tokens } = await this.tokens.issue('customer', user.id, { userAgent: client.userAgent })
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
