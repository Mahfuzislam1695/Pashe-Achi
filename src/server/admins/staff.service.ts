import { Injectable } from '@nestjs/common'
import { type AdminDto, can, type CreateAdminInput, type ListStaffQuery, type PagedList, type StaffStatsDto, type UpdateAdminInput } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import type { AdminPrincipal } from '../auth/auth.types'
import { hashPassword } from '../auth/password'
import { TokenService } from '../auth/token.service'
import { AppException } from '../common/app.exception'
import { offsetArgs, toPaged } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { roleName, withRole } from '../roles/role.mapper'
import { toAdminDto } from '../users/user.mapper'

type Db = PrismaService | Prisma.TransactionClient

/**
 * Admin panel accounts, for staff with the staff.* permissions. The Super admin role is guarded on
 * top: only a Super admin can give it, take it away or change a Super admin's account, and the last
 * active Super admin can be neither disabled nor moved to another role.
 */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Active accounts first, then oldest first. */
  async list(query: ListStaffQuery): Promise<PagedList<AdminDto>> {
    const where: Prisma.AdminWhereInput = {
      ...(query.q ? { OR: [{ name: { contains: query.q, mode: 'insensitive' } }, { mobile: { contains: query.q } }] } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(query.active ? { isActive: query.active === 'true' } : {}),
    }
    const [admins, total] = await this.prisma.$transaction([
      this.prisma.admin.findMany({ where, include: withRole, orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }], ...offsetArgs(query.page, query.limit) }),
      this.prisma.admin.count({ where }),
    ])
    return toPaged(admins, total, query, toAdminDto)
  }

  /** Every account, how many can sign in, and how many hold each role (every role listed, system role first). */
  async stats(): Promise<StaffStatsDto> {
    const [roles, total, active] = await this.prisma.$transaction([
      this.prisma.role.findMany({ include: { _count: { select: { admins: true } } }, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] }),
      this.prisma.admin.count(),
      this.prisma.admin.count({ where: { isActive: true } }),
    ])
    return { total, active, byRole: roles.map(role => ({ id: role.id, name: roleName(role), isSystem: role.isSystem, count: role._count.admins })) }
  }

  async create(input: CreateAdminInput, by: AdminPrincipal, actor: AuditActor): Promise<AdminDto> {
    const role = await this.role(input.roleId)
    if (role.isSystem && !by.role.isSystem) throw AppException.forbidden('admin.super_only')
    const taken = await this.prisma.admin.findUnique({ where: { mobile: input.mobile }, select: { id: true } })
    if (taken) throw AppException.conflict('mobile.taken')
    const passwordHash = await hashPassword(input.password)
    const admin = await this.prisma.$transaction(async tx => {
      const created = await tx.admin.create({ data: { name: input.name, mobile: input.mobile, roleId: role.id, passwordHash }, include: withRole })
      await this.audit.record(
        {
          action: 'STAFF_CREATED',
          actor,
          entity: { type: 'STAFF', id: created.id, label: created.name },
          // The role by its English name at the time; the panel shows the current name of a role that still has it.
          changes: diffChanges(null, { name: created.name, mobile: created.mobile, role: role.nameEn }, ['name', 'mobile', 'role']),
        },
        tx,
      )
      return created
    })
    return toAdminDto(admin)
  }

  /** Name, role and active need staff.edit; a new password needs staff.reset_password. */
  async update(by: AdminPrincipal, actor: AuditActor, id: string, input: UpdateAdminInput): Promise<AdminDto> {
    const editing = input.name !== undefined || input.roleId !== undefined || input.isActive !== undefined
    if (editing && !can(by, 'staff.edit')) throw AppException.forbidden()
    if (input.password && !can(by, 'staff.reset_password')) throw AppException.forbidden()

    const newRole = input.roleId ? await this.role(input.roleId) : null
    if (by.id === id && (input.isActive === false || (newRole && newRole.id !== by.role.id))) throw AppException.badRequest('admin.self')

    const passwordHash = input.password ? await hashPassword(input.password) : undefined
    const admin = await this.prisma.$transaction(async tx => {
      const before = await tx.admin.findUnique({ where: { id }, include: withRole })
      if (!before) throw AppException.notFound()
      // Only a Super admin touches a Super admin's account, or hands the role out.
      if ((before.role.isSystem || newRole?.isSystem) && !by.role.isSystem) throw AppException.forbidden('admin.super_only')
      const losesSuper = before.role.isSystem && before.isActive && (input.isActive === false || (newRole !== null && !newRole.isSystem))
      if (losesSuper && (await this.activeSuperAdmins(tx)) <= 1) throw AppException.badRequest('admin.last_super')

      const updated = await tx.admin.update({
        where: { id },
        data: { name: input.name, roleId: newRole?.id, isActive: input.isActive, ...(passwordHash ? { passwordHash } : {}) },
        include: withRole,
      })
      const entity = { type: 'STAFF' as const, id, label: updated.name }
      const changes = diffChanges(
        { name: before.name, role: before.role.nameEn, isActive: before.isActive },
        { name: input.name, role: newRole?.nameEn, isActive: input.isActive },
        ['name', 'role', 'isActive'],
      )
      if (changes.length) await this.audit.record({ action: 'STAFF_UPDATED', actor, entity, changes }, tx)
      if (passwordHash) await this.audit.record({ action: 'STAFF_PASSWORD_RESET', actor, entity }, tx)
      return updated
    })
    // A deactivated account or a reset password ends every session of that admin.
    if (input.isActive === false || input.password) await this.tokens.revokeAll('admin', id)
    return toAdminDto(admin)
  }

  private async role(id: string) {
    const role = await this.prisma.role.findUnique({ where: { id }, select: { id: true, nameEn: true, isSystem: true } })
    if (!role) throw AppException.badRequest('role.not_found')
    return role
  }

  private activeSuperAdmins(db: Db) {
    return db.admin.count({ where: { isActive: true, role: { isSystem: true } } })
  }
}
