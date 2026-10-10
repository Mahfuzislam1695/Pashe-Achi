import type { AuditAction, AuditChange, AuditEntity, AuditLogDto, AuditValue } from '@/shared'

import type { AuditLog, Prisma } from '../generated/prisma/client'
import type { AuditActor } from './actor'

/** One history log entry to write. */
export interface AuditEntry {
  action: AuditAction
  actor: AuditActor
  entity: { type: AuditEntity; id?: string | null; label?: string | null }
  /** Only the fields that changed. Never passwords or hashes. */
  changes?: AuditChange[]
  note?: string | null
  meta?: Record<string, AuditValue>
  /** When it happened; defaults to now (the demo seed passes past times). */
  at?: Date
}

/** The database row for an entry. Plain function, so the seed can use it with createMany. */
export const toAuditRow = ({ action, actor, entity, changes = [], note, meta = {}, at }: AuditEntry): Prisma.AuditLogCreateManyInput => ({
  action,
  actorType: actor.type,
  adminId: actor.type === 'ADMIN' ? actor.id : null,
  userId: actor.type === 'CUSTOMER' ? actor.id : null,
  actorName: actor.name.slice(0, 120),
  actorRole: actor.role ?? null,
  entityType: entity.type,
  entityId: entity.id ?? null,
  entityLabel: entity.label?.slice(0, 200) ?? null,
  changes: changes as object[],
  note: note?.trim() || null,
  meta,
  ip: actor.ip ?? null,
  userAgent: actor.userAgent ?? null,
  ...(at ? { createdAt: at } : {}),
})

export const toAuditLogDto = (row: AuditLog): AuditLogDto => ({
  id: row.id,
  action: row.action,
  actor: { type: row.actorType, id: row.adminId ?? row.userId, name: row.actorName, role: row.actorRole },
  entity: { type: row.entityType, id: row.entityId, label: row.entityLabel },
  changes: (Array.isArray(row.changes) ? row.changes : []) as unknown as AuditChange[],
  note: row.note,
  meta: (row.meta && typeof row.meta === 'object' && !Array.isArray(row.meta) ? row.meta : {}) as Record<string, AuditValue>,
  ip: row.ip,
  userAgent: row.userAgent,
  createdAt: row.createdAt.toISOString(),
})
