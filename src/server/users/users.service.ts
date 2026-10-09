import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type {
  AdminCustomerDto,
  ChangePasswordInput,
  CustomerDto,
  ListCustomersQuery,
  Paginated,
  UpdateCustomerInput,
  UpdateProfileInput,
} from '@/shared'

import { verifyPassword, hashPassword } from '../auth/password'
import { TokenService } from '../auth/token.service'
import { AppException } from '../common/app.exception'
import { DOMAIN_EVENTS } from '../common/domain-events'
import { pageArgs, toPage } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { toAdminCustomerDto, toCustomerDto } from './user.mapper'

const withStats = {
  _count: { select: { orders: true } },
  orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserInclude

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly events: EventEmitter2,
  ) {}

  async updateProfile(userId: string, input: UpdateProfileInput): Promise<CustomerDto> {
    const taken = await this.prisma.user.findFirst({ where: { mobile: input.mobile, NOT: { id: userId } }, select: { id: true } })
    if (taken) throw AppException.conflict('mobile.taken')
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { name: input.name, mobile: input.mobile, location: input.location ?? '', ...(input.lang ? { lang: input.lang } : {}) },
    })
    return toCustomerDto(user)
  }

  async changePassword(userId: string, input: ChangePasswordInput) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw AppException.badRequest('password.wrong')
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(input.newPassword) } })
    await this.tokens.revokeAll('customer', userId)
  }

  async listCustomers(query: ListCustomersQuery): Promise<Paginated<AdminCustomerDto>> {
    const where: Prisma.UserWhereInput = {
      ...(query.blocked ? { isBlocked: query.blocked === 'true' } : {}),
      ...(query.q
        ? {
            OR: [
              { name: { contains: query.q, mode: 'insensitive' } },
              { mobile: { contains: query.q } },
              { location: { contains: query.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    }
    const rows = await this.prisma.user.findMany({ where, include: withStats, ...pageArgs(query.cursor, query.limit) })
    return toPage(rows, query.limit, toAdminCustomerDto)
  }

  async getCustomer(id: string): Promise<AdminCustomerDto> {
    const user = await this.prisma.user.findUnique({ where: { id }, include: withStats })
    if (!user) throw AppException.notFound()
    return toAdminCustomerDto(user)
  }

  /** Block/unblock or set reward points. Blocking logs the customer out everywhere at once. */
  async updateCustomer(id: string, input: UpdateCustomerInput): Promise<AdminCustomerDto> {
    const user = await this.prisma.user.update({ where: { id }, data: input, include: withStats })
    if (input.isBlocked) {
      await this.tokens.revokeAll('customer', id)
      this.events.emit(DOMAIN_EVENTS.customerBlocked, { userId: id })
    }
    return toAdminCustomerDto(user)
  }
}
