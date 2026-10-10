import { Injectable } from '@nestjs/common'
import { type AuditEntity, type AuditLogDto, type ListAuditQuery, orderCode, type Paginated } from '@/shared'

import { bdDayEnd, bdDayStart, pageArgs, toPage } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { type AuditEntry, toAuditLogDto, toAuditRow } from './audit.mapper'

export type AuditDb = PrismaService | Prisma.TransactionClient

const RECORD_HISTORY_LIMIT = 200

/** Writes and reads the history log. Entries are never edited or deleted. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes one entry. Inside a transaction, pass its client so the entry commits or rolls back with the change. */
  async record(entry: AuditEntry, db: AuditDb = this.prisma) {
    await db.auditLog.create({ data: toAuditRow(entry) })
  }

  /** The whole log, newest first, filtered. */
  async list(query: ListAuditQuery): Promise<Paginated<AuditLogDto>> {
    const rows = await this.prisma.auditLog.findMany({ where: this.where(query), ...pageArgs(query.cursor, query.limit) })
    return toPage(rows, query.limit, toAuditLogDto)
  }

  /** One record's history, oldest first (e.g. an order, from placing it to completing it). */
  async forEntity(type: AuditEntity, id: string): Promise<AuditLogDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType: type, entityId: id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: RECORD_HISTORY_LIMIT,
    })
    return rows.map(toAuditLogDto)
  }

  private where(query: ListAuditQuery): Prisma.AuditLogWhereInput {
    const and: Prisma.AuditLogWhereInput[] = []
    if (query.action) and.push({ action: query.action })
    if (query.entityType) and.push({ entityType: query.entityType })
    if (query.entityId) and.push({ entityId: query.entityId })
    if (query.actorType) and.push({ actorType: query.actorType })
    if (query.adminId) and.push({ adminId: query.adminId })
    if (query.customerId) and.push({ OR: [{ userId: query.customerId }, { entityType: 'CUSTOMER', entityId: query.customerId }] })
    if (query.from || query.to) {
      and.push({ createdAt: { ...(query.from ? { gte: bdDayStart(query.from) } : {}), ...(query.to ? { lt: bdDayEnd(query.to) } : {}) } })
    }
    if (query.q) {
      const code = /^(?:pa-?)?(\d{1,9})$/i.exec(query.q)
      and.push({
        OR: [
          ...(code ? [{ entityLabel: orderCode(Number(code[1])) }] : []),
          { actorName: { contains: query.q, mode: 'insensitive' } },
          { entityLabel: { contains: query.q, mode: 'insensitive' } },
          { note: { contains: query.q, mode: 'insensitive' } },
        ],
      })
    }
    return and.length ? { AND: and } : {}
  }
}
