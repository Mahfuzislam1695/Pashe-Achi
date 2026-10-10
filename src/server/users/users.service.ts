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

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
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
    private readonly audit: AuditService,
  ) {}

  async updateProfile(userId: string, input: UpdateProfileInput, actor: AuditActor): Promise<CustomerDto> {
    const taken = await this.prisma.user.findFirst({ where: { mobile: input.mobile, NOT: { id: userId } }, select: { id: true } })
    if (taken) throw AppException.conflict('mobile.taken')
    const data = { name: input.name, mobile: input.mobile, location: input.location ?? '', ...(input.lang ? { lang: input.lang } : {}) }
    const user = await this.prisma.$transaction(async tx => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      const updated = await tx.user.update({ where: { id: userId }, data })
      const changes = diffChanges(before, data, ['name', 'mobile', 'location', 'lang'])
      if (changes.length) {
        await this.audit.record({ action: 'CUSTOMER_PROFILE_UPDATED', actor, entity: { type: 'CUSTOMER', id: userId, label: updated.name }, changes }, tx)
      }
      return updated
    })
    return toCustomerDto(user)
  }

  async changePassword(userId: string, input: ChangePasswordInput, actor: AuditActor) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } })
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) throw AppException.badRequest('password.wrong')
    const passwordHash = await hashPassword(input.newPassword)
    await this.prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { passwordHash } })
      await this.audit.record({ action: 'CUSTOMER_PASSWORD_CHANGED', actor, entity: { type: 'CUSTOMER', id: userId, label: user.name } }, tx)
    })
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
  async updateCustomer(id: string, input: UpdateCustomerInput, actor: AuditActor): Promise<AdminCustomerDto> {
    const user = await this.prisma.$transaction(async tx => {
      const before = await tx.user.findUnique({ where: { id }, select: { isBlocked: true, points: true } })
      if (!before) throw AppException.notFound()
      const updated = await tx.user.update({ where: { id }, data: input, include: withStats })
      const entity = { type: 'CUSTOMER' as const, id, label: updated.name }
      for (const change of diffChanges(before, input, ['isBlocked', 'points'])) {
        const action = change.field === 'points' ? 'CUSTOMER_POINTS_CHANGED' : change.to ? 'CUSTOMER_BLOCKED' : 'CUSTOMER_UNBLOCKED'
        await this.audit.record({ action, actor, entity, changes: [change] }, tx)
      }
      return updated
    })
    if (input.isBlocked) {
      await this.tokens.revokeAll('customer', id)
      this.events.emit(DOMAIN_EVENTS.customerBlocked, { userId: id })
    }
    return toAdminCustomerDto(user)
  }
}
