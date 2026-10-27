import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  addDays,
  type AdminCustomerDto,
  type ChangePasswordInput,
  type CustomerDto,
  type CustomerLocationInput,
  type CustomerSort,
  type CustomerStatsDto,
  type CustomerStatsQuery,
  isoDateInBd,
  type ListCustomersQuery,
  type PagedList,
  type UpdateCustomerInput,
  type UpdateProfileInput,
} from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { verifyPassword, hashPassword } from '../auth/password'
import { TokenService } from '../auth/token.service'
import { AppException } from '../common/app.exception'
import { DOMAIN_EVENTS } from '../common/domain-events'
import { bdDayRange, offsetArgs, toPaged } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { LOCATION_FIELDS, locationColumns, toAdminCustomerDto, toCustomerDto } from './user.mapper'

const withStats = {
  _count: { select: { orders: true } },
  orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserInclude

/** Name, mobile or location. */
const searchWhere = (q: string | undefined): Prisma.UserWhereInput =>
  q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}

/** The admin list's sort orders; `id` breaks ties so pages never overlap. */
const CUSTOMER_SORT_ORDER: Record<CustomerSort, Prisma.UserOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'desc' }],
  oldest: [{ createdAt: 'asc' }, { id: 'asc' }],
  name: [{ name: 'asc' }, { id: 'asc' }],
  orders_desc: [{ orders: { _count: 'desc' } }, { createdAt: 'desc' }, { id: 'desc' }],
  points_desc: [{ points: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
}

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
    const data = { name: input.name, mobile: input.mobile, ...(input.lang ? { lang: input.lang } : {}) }
    const user = await this.prisma.$transaction(async tx => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      const updated = await tx.user.update({ where: { id: userId }, data })
      const changes = diffChanges(before, data, ['name', 'mobile', 'lang'])
      if (changes.length) {
        await this.audit.record({ action: 'CUSTOMER_PROFILE_UPDATED', actor, entity: { type: 'CUSTOMER', id: userId, label: updated.name }, changes }, tx)
      }
      return updated
    })
    return toCustomerDto(user)
  }

  /** আমার লোকেশন: the customer has one location, picked on the map. Setting it replaces the old one. */
  async updateLocation(userId: string, input: CustomerLocationInput, actor: AuditActor): Promise<CustomerDto> {
    const data = locationColumns(input)
    const user = await this.prisma.$transaction(async tx => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId } })
      const updated = await tx.user.update({ where: { id: userId }, data })
      const changes = diffChanges<typeof before>(before, data, LOCATION_FIELDS)
      if (changes.length) {
        await this.audit.record({ action: 'CUSTOMER_LOCATION_UPDATED', actor, entity: { type: 'CUSTOMER', id: userId, label: updated.name }, changes }, tx)
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

  async listCustomers(query: ListCustomersQuery): Promise<PagedList<AdminCustomerDto>> {
    const where: Prisma.UserWhereInput = {
      ...searchWhere(query.q),
      ...(query.blocked ? { isBlocked: query.blocked === 'true' } : {}),
      ...(query.ordered ? { orders: query.ordered === 'true' ? { some: {} } : { none: {} } } : {}),
    }
    const createdAt = bdDayRange(query.from, query.to)
    if (createdAt) where.createdAt = createdAt
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({ where, include: withStats, orderBy: CUSTOMER_SORT_ORDER[query.sort ?? 'newest'], ...offsetArgs(query.page, query.limit) }),
      this.prisma.user.count({ where }),
    ])
    return toPaged(rows, total, query, toAdminCustomerDto)
  }

  /** The customers the search matches, by status and by whether they have ordered, and how many joined in from–to (default: the last 30 days). */
  async customerStats(query: CustomerStatsQuery): Promise<CustomerStatsDto> {
    const where = searchWhere(query.q)
    const today = isoDateInBd()
    const joined = bdDayRange(query.from ?? (query.to ? undefined : addDays(today, -29)), query.to)
    const [total, blocked, ordered, newInRange, points] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.count({ where: { ...where, isBlocked: true } }),
      this.prisma.user.count({ where: { ...where, orders: { some: {} } } }),
      this.prisma.user.count({ where: { ...where, ...(joined ? { createdAt: joined } : {}) } }),
      this.prisma.user.aggregate({ where, _sum: { points: true } }),
    ])
    return { total, active: total - blocked, blocked, ordered, neverOrdered: total - ordered, newInRange, points: points._sum.points ?? 0 }
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
