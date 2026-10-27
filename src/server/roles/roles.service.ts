import { Injectable } from '@nestjs/common'
import { type AuditChange, can, normalizePermissions, type Permission, type RoleDto, type RoleInput, type UpdateRoleInput } from '@/shared'

import type { AuditActor } from '../audit/actor'
import type { AdminPrincipal } from '../auth/auth.types'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { AppException } from '../common/app.exception'
import { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { toRoleDto } from './role.mapper'

const withCount = { _count: { select: { admins: true } } } satisfies Prisma.RoleInclude
const TEXT_FIELDS = ['nameBn', 'nameEn', 'descriptionBn', 'descriptionEn'] as const
const blankToNull = (value: string | undefined) => (value === undefined ? undefined : value.trim() || null)

/** The permissions a change gives and takes away. */
function permissionDiff(before: readonly string[], after: readonly Permission[]) {
  const had = normalizePermissions(before)
  return { added: after.filter(permission => !had.includes(permission)), removed: had.filter(permission => !after.includes(permission)) }
}

/** One history change per permission given or taken away. */
function permissionChanges({ added, removed }: ReturnType<typeof permissionDiff>): AuditChange[] {
  return [
    ...added.map(permission => ({ field: 'permission.added', from: null, to: permission })),
    ...removed.map(permission => ({ field: 'permission.removed', from: null, to: permission })),
  ]
}

/** Staff other than the Super admin give or take away only permissions they hold themselves, so nobody grants more than they have. */
function assertHeld(by: AdminPrincipal, permissions: readonly Permission[]) {
  if (!permissions.every(permission => can(by, permission))) throw AppException.forbidden('role.beyond_own')
}

/**
 * Roles and the permissions they grant, managed by staff holding roles.* (the Super admin always).
 * The system role (Super admin) is never edited or deleted, nobody but the Super admin changes their
 * own role, and a role is deleted only once no staff member holds it.
 */
@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The system role first, then the rest in the order they were made. */
  async list(): Promise<RoleDto[]> {
    const roles = await this.prisma.role.findMany({ include: withCount, orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }] })
    return roles.map(toRoleDto)
  }

  async create(by: AdminPrincipal, actor: AuditActor, input: RoleInput): Promise<RoleDto> {
    assertHeld(by, input.permissions)
    const data = { nameBn: input.nameBn, nameEn: input.nameEn, descriptionBn: blankToNull(input.descriptionBn), descriptionEn: blankToNull(input.descriptionEn) }
    const role = await this.unique(() =>
      this.prisma.$transaction(async tx => {
        const created = await tx.role.create({ data: { ...data, permissions: input.permissions }, include: withCount })
        await this.audit.record(
          {
            action: 'ROLE_CREATED',
            actor,
            entity: { type: 'ROLE', id: created.id, label: created.nameEn },
            changes: [...diffChanges(null, data, TEXT_FIELDS), ...permissionChanges(permissionDiff([], input.permissions))],
          },
          tx,
        )
        return created
      }),
    )
    return toRoleDto(role)
  }

  async update(by: AdminPrincipal, actor: AuditActor, id: string, input: UpdateRoleInput): Promise<RoleDto> {
    const data = {
      nameBn: input.nameBn,
      nameEn: input.nameEn,
      descriptionBn: blankToNull(input.descriptionBn),
      descriptionEn: blankToNull(input.descriptionEn),
    }
    const role = await this.unique(() =>
      this.prisma.$transaction(async tx => {
        const before = await tx.role.findUnique({ where: { id } })
        if (!before) throw AppException.notFound()
        if (before.isSystem) throw AppException.badRequest('role.locked')
        // Your own role would let you raise yourself (the Super admin's own role is the locked one above).
        if (before.id === by.role.id) throw AppException.forbidden('role.own')
        const diff = input.permissions ? permissionDiff(before.permissions, input.permissions) : { added: [], removed: [] }
        assertHeld(by, [...diff.added, ...diff.removed])
        const changes = [...diffChanges(before, data, TEXT_FIELDS), ...permissionChanges(diff)]
        const updated = await tx.role.update({ where: { id }, data: { ...data, ...(input.permissions ? { permissions: input.permissions } : {}) }, include: withCount })
        if (changes.length) await this.audit.record({ action: 'ROLE_UPDATED', actor, entity: { type: 'ROLE', id, label: updated.nameEn }, changes }, tx)
        return updated
      }),
    )
    return toRoleDto(role)
  }

  async remove(id: string, actor: AuditActor): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const role = await tx.role.findUnique({ where: { id }, include: withCount })
      if (!role) throw AppException.notFound()
      if (role.isSystem) throw AppException.badRequest('role.locked')
      if (role._count.admins > 0) throw AppException.conflict('role.in_use')
      await tx.role.delete({ where: { id } })
      await this.audit.record({ action: 'ROLE_DELETED', actor, entity: { type: 'ROLE', id, label: role.nameEn } }, tx)
    })
  }

  /** A second role with the same English name is refused with its own message, not the generic conflict. */
  private async unique<T>(write: () => Promise<T>): Promise<T> {
    try {
      return await write()
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw AppException.conflict('role.name_taken')
      throw error
    }
  }
}
