import { Injectable } from '@nestjs/common'
import type { AdminDto, CreateAdminInput, UpdateAdminInput } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { hashPassword } from '../auth/password'
import { TokenService } from '../auth/token.service'
import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import { toAdminDto } from '../users/user.mapper'

/** Admin panel accounts. Only super admins reach this service. */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<AdminDto[]> {
    const admins = await this.prisma.admin.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] })
    return admins.map(toAdminDto)
  }

  async create(input: CreateAdminInput, actor: AuditActor): Promise<AdminDto> {
    const taken = await this.prisma.admin.findUnique({ where: { mobile: input.mobile }, select: { id: true } })
    if (taken) throw AppException.conflict('mobile.taken')
    const passwordHash = await hashPassword(input.password)
    const admin = await this.prisma.$transaction(async tx => {
      const created = await tx.admin.create({ data: { name: input.name, mobile: input.mobile, role: input.role, passwordHash } })
      await this.audit.record({
        action: 'STAFF_CREATED',
        actor,
        entity: { type: 'STAFF', id: created.id, label: created.name },
        changes: diffChanges(null, created, ['name', 'mobile', 'role']),
      }, tx)
      return created
    })
    return toAdminDto(admin)
  }

  async update(actor: AuditActor, id: string, input: UpdateAdminInput): Promise<AdminDto> {
    const isSelf = actor.id === id
    if (isSelf && (input.isActive === false || (input.role && input.role !== 'SUPER_ADMIN'))) throw AppException.badRequest('admin.self')

    const data = { name: input.name, role: input.role, isActive: input.isActive }
    const passwordHash = input.password ? await hashPassword(input.password) : undefined
    const admin = await this.prisma.$transaction(async tx => {
      const before = await tx.admin.findUnique({ where: { id } })
      if (!before) throw AppException.notFound()
      const updated = await tx.admin.update({ where: { id }, data: { ...data, ...(passwordHash ? { passwordHash } : {}) } })
      const entity = { type: 'STAFF' as const, id, label: updated.name }
      const changes = diffChanges(before, data, ['name', 'role', 'isActive'])
      if (changes.length) await this.audit.record({ action: 'STAFF_UPDATED', actor, entity, changes }, tx)
      if (passwordHash) await this.audit.record({ action: 'STAFF_PASSWORD_RESET', actor, entity }, tx)
      return updated
    })
    // A deactivated account or a reset password ends every session of that admin.
    if (input.isActive === false || input.password) await this.tokens.revokeAll('admin', id)
    return toAdminDto(admin)
  }
}
