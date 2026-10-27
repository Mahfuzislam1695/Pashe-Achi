import { effectivePermissions, normalizePermissions, type Permission, type RoleDto, type RoleRef, type Text } from '@/shared'

import type { Admin, Prisma, Role } from '../generated/prisma/client'

/** What every admin query loads of the role: enough to check permissions and name it. */
export const roleSelect = { id: true, nameBn: true, nameEn: true, isSystem: true, permissions: true } satisfies Prisma.RoleSelect

export const withRole = { role: { select: roleSelect } } satisfies Prisma.AdminInclude

export type RoleSummary = Prisma.RoleGetPayload<{ select: typeof roleSelect }>
export type AdminWithRole = Admin & { role: RoleSummary }

/** The active admins whose role grants `permission` (the system role grants every one). */
export const adminsWhoCan = (permission: Permission): Prisma.AdminWhereInput => ({
  isActive: true,
  role: { OR: [{ isSystem: true }, { permissions: { has: permission } }] },
})

export const roleName = (role: Pick<Role, 'nameBn' | 'nameEn'>): Text => ({ bn: role.nameBn, en: role.nameEn })

export const toRoleRef = (role: RoleSummary): RoleRef => ({ id: role.id, name: roleName(role), isSystem: role.isSystem })

/** The permissions an admin with this role has: every one for the system role. */
export const permissionsOf = (role: Pick<RoleSummary, 'isSystem' | 'permissions'>) => effectivePermissions(role)

export const toRoleDto = (role: Role & { _count: { admins: number } }): RoleDto => ({
  ...toRoleRef(role),
  key: role.key,
  description: role.descriptionBn || role.descriptionEn ? { bn: role.descriptionBn || role.descriptionEn || '', en: role.descriptionEn || role.descriptionBn || '' } : null,
  permissions: role.isSystem ? effectivePermissions(role) : normalizePermissions(role.permissions),
  staffCount: role._count.admins,
  createdAt: role.createdAt.toISOString(),
  updatedAt: role.updatedAt.toISOString(),
})
