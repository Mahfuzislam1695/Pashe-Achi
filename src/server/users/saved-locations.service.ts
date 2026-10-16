import { Injectable } from '@nestjs/common'
import { MAX_SAVED_LOCATIONS, type SavedLocationDto, type SavedLocationInput, type UpdateSavedLocationInput } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { AppException } from '../common/app.exception'
import type { Prisma, SavedLocation } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const toSavedLocationDto = (row: SavedLocation): SavedLocationDto => ({
  id: row.id,
  label: row.label,
  address: row.address,
  lat: row.lat,
  lng: row.lng,
  isDefault: row.isDefault,
  createdAt: row.createdAt.toISOString(),
})

/** The default first, then the newest. */
const LIST_ORDER = [{ isDefault: 'desc' }, { createdAt: 'desc' }] satisfies Prisma.SavedLocationOrderByWithRelationInput[]

const FIELDS = ['label', 'address', 'lat', 'lng', 'isDefault'] as const

/**
 * আমার লোকেশন: a customer's saved places. One of them is the default (the first one saved, or the
 * one the customer picks). Writes lock the customer's row, so the limit and the single default
 * hold even when two requests arrive at once.
 */
@Injectable()
export class SavedLocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(userId: string): Promise<SavedLocationDto[]> {
    const rows = await this.prisma.savedLocation.findMany({ where: { userId }, orderBy: LIST_ORDER })
    return rows.map(toSavedLocationDto)
  }

  async create(userId: string, input: SavedLocationInput, actor: AuditActor): Promise<SavedLocationDto> {
    const row = await this.prisma.$transaction(async tx => {
      await lockCustomer(tx, userId)
      const count = await tx.savedLocation.count({ where: { userId } })
      if (count >= MAX_SAVED_LOCATIONS) throw AppException.badRequest('location.limit')
      const isDefault = count === 0 || input.isDefault === true
      if (isDefault) await tx.savedLocation.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
      const created = await tx.savedLocation.create({ data: { userId, label: input.label, address: input.address, lat: input.lat, lng: input.lng, isDefault } })
      await this.audit.record({ action: 'CUSTOMER_LOCATION_ADDED', actor, entity: customerEntity(userId, actor), changes: diffChanges(null, created, ['label', 'address']) }, tx)
      return created
    })
    return toSavedLocationDto(row)
  }

  /** `isDefault: true` makes this the default; `false` is ignored (pick another location instead). */
  async update(userId: string, id: string, input: UpdateSavedLocationInput, actor: AuditActor): Promise<SavedLocationDto> {
    const { isDefault, ...fields } = input
    const data = { ...fields, ...(isDefault ? { isDefault: true } : {}) }
    const row = await this.prisma.$transaction(async tx => {
      await lockCustomer(tx, userId)
      const before = await tx.savedLocation.findFirst({ where: { id, userId } })
      if (!before) throw AppException.notFound()
      if (data.isDefault && !before.isDefault) await tx.savedLocation.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } })
      const updated = await tx.savedLocation.update({ where: { id }, data })
      const changes = diffChanges(before, data, FIELDS)
      if (changes.length) {
        await this.audit.record({ action: 'CUSTOMER_LOCATION_UPDATED', actor, entity: customerEntity(userId, actor), changes, note: updated.label }, tx)
      }
      return updated
    })
    return toSavedLocationDto(row)
  }

  /** Deleting the default makes the newest remaining location the default. */
  async remove(userId: string, id: string, actor: AuditActor) {
    await this.prisma.$transaction(async tx => {
      await lockCustomer(tx, userId)
      const row = await tx.savedLocation.findFirst({ where: { id, userId } })
      if (!row) throw AppException.notFound()
      await tx.savedLocation.delete({ where: { id } })
      if (row.isDefault) {
        const next = await tx.savedLocation.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } })
        if (next) await tx.savedLocation.update({ where: { id: next.id }, data: { isDefault: true } })
      }
      await this.audit.record({ action: 'CUSTOMER_LOCATION_DELETED', actor, entity: customerEntity(userId, actor), note: `${row.label}: ${row.address}` }, tx)
    })
  }
}

/** Serialises one customer's location writes until the transaction ends. */
async function lockCustomer(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`
}

/** History entries go on the customer (the actor is the customer), so they show on the admin's customer page. */
const customerEntity = (userId: string, actor: AuditActor) => ({ type: 'CUSTOMER' as const, id: userId, label: actor.name })
