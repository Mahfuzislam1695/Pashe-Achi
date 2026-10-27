import { randomBytes } from 'node:crypto'

import { Injectable, Logger } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  ACTIVE_ORDER_STATUSES,
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
import { StorageService } from '../uploads/storage.service'
import { DELETED_CUSTOMER_NAME, LOCATION_FIELDS, locationColumns, toAdminCustomerDto, toCustomerDto } from './user.mapper'

const withStats = {
  _count: { select: { orders: true } },
  orders: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
} satisfies Prisma.UserInclude

/** Name, mobile or location, among the accounts that still exist (deleted ones stay only for their orders). */
const searchWhere = (q: string | undefined): Prisma.UserWhereInput => ({
  deletedAt: null,
  ...(q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { mobile: { contains: q } },
          { location: { contains: q, mode: 'insensitive' } },
        ],
      }
    : {}),
})

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
  private readonly logger = new Logger(UsersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
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

  /**
   * The customer deletes their account (a Play Store and App Store rule). Refused while an order is
   * still in motion. The row stays so past bills still add up, but without the person: the name and
   * mobile are replaced (the number can sign up again), and the location, sessions, browsers, phones,
   * notifications and prescriptions are deleted. Their orders stay as sales records (number, service,
   * lines, bill, timeline) with the addresses, pins, phone numbers and notes cleared.
   */
  async deleteAccount(userId: string, actor: AuditActor) {
    const unusableHash = await hashPassword(randomBytes(32).toString('base64url'))
    const files = await this.prisma.$transaction(async tx => {
      if (await tx.order.count({ where: { userId, status: { in: [...ACTIVE_ORDER_STATUSES] } } })) throw AppException.conflict('account.active_orders')
      const uploads = await tx.upload.findMany({ where: { ownerId: userId }, select: { storageKey: true } })

      await tx.user.update({
        where: { id: userId },
        data: {
          name: DELETED_CUSTOMER_NAME,
          mobile: `deleted-${userId}`,
          location: '',
          locationDetails: '',
          locationLat: null,
          locationLng: null,
          passwordHash: unusableHash,
          points: 0,
          deletedAt: new Date(),
        },
      })
      await tx.refreshToken.deleteMany({ where: { userId } })
      await tx.pushSubscription.deleteMany({ where: { userId } })
      await tx.deviceToken.deleteMany({ where: { userId } })
      await tx.notification.deleteMany({ where: { userId } })
      await tx.upload.deleteMany({ where: { ownerId: userId } })

      await tx.order.updateMany({ where: { userId }, data: { address: null, addressLat: null, addressLng: null, contactMobile: '', note: null } })
      // A shifting or parcel order's one-line summary names its two addresses.
      await tx.order.updateMany({ where: { userId, service: { in: ['shifting', 'parcel'] } }, data: { summary: '—' } })
      await tx.shiftingDetail.updateMany({
        where: { order: { userId } },
        data: { loadingArea: '', unloadingArea: '', loadingLat: null, loadingLng: null, unloadingLat: null, unloadingLng: null },
      })
      await tx.parcelDetail.updateMany({
        where: { order: { userId } },
        data: { pickupAddress: '', dropoffAddress: '', pickupLat: null, pickupLng: null, dropoffLat: null, dropoffLng: null, receiverMobile: '' },
      })

      await this.audit.record({ action: 'CUSTOMER_DELETED', actor, entity: { type: 'CUSTOMER', id: userId, label: DELETED_CUSTOMER_NAME } }, tx)
      return uploads.map(upload => upload.storageKey)
    })

    for (const key of files) {
      await this.storage.remove(key).catch(error => this.logger.warn(`Could not delete ${key}: ${String(error)}`))
    }
    this.events.emit(DOMAIN_EVENTS.customerDeleted, { userId })
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
      const before = await tx.user.findUnique({ where: { id }, select: { isBlocked: true, points: true, deletedAt: true } })
      if (!before || before.deletedAt) throw AppException.notFound()
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
