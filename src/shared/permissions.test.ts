import { describe, expect, it } from 'vitest'

import { ALL_PERMISSIONS, BUILT_IN_ROLES, can, effectivePermissions, MANAGER_PERMISSIONS, normalizePermissions, OPERATOR_PERMISSIONS, type Permission } from './permissions'
import { PERMISSION_LABELS } from './labels'

describe('normalizePermissions', () => {
  it("adds each module's view, drops unknown values and repeats, and keeps matrix order", () => {
    expect(normalizePermissions(['orders.send_price', 'bogus.view', 'orders.send_price', 'dashboard.view'])).toEqual(['dashboard.view', 'orders.view', 'orders.send_price'])
    expect(normalizePermissions(['roles.edit'])).toEqual(['roles.view', 'roles.edit'])
  })
})

describe('can', () => {
  const role = (permissions: Permission[], isSystem = false) => ({ role: { isSystem }, permissions })

  it('allows only what the role lists', () => {
    expect(can(role(['orders.view']), 'orders.view')).toBe(true)
    expect(can(role(['orders.view']), 'orders.send_price')).toBe(false)
  })

  it('allows everything for the system role, whatever its list holds', () => {
    expect(ALL_PERMISSIONS.every(permission => can(role([], true), permission))).toBe(true)
    expect(effectivePermissions({ isSystem: true, permissions: [] })).toEqual(ALL_PERMISSIONS)
  })
})

describe('built-in roles', () => {
  // What Manager and Operator could do before roles became editable (the routes' old @Roles checks).
  const before: Record<'manager' | 'operator', Permission[]> = {
    manager: ['catalog.edit', 'offers.create', 'offers.notify', 'notifications.broadcast', 'customers.block', 'customers.edit_points', 'history.view', 'dashboard.staff_activity'],
    operator: ['orders.view', 'orders.update_status', 'orders.send_price', 'customers.view', 'catalog.view', 'offers.view', 'notifications.view', 'dashboard.view'],
  }

  it('keep what each role could do, and nothing a Super admin alone could', () => {
    for (const permission of before.manager) expect(MANAGER_PERMISSIONS).toContain(permission)
    for (const permission of before.operator) expect(OPERATOR_PERMISSIONS).toContain(permission)
    for (const permission of ['staff.view', 'staff.edit', 'catalog.customer_signin'] as Permission[]) expect(MANAGER_PERMISSIONS).not.toContain(permission)
    expect(OPERATOR_PERMISSIONS).not.toContain('history.view')
    expect(BUILT_IN_ROLES.filter(role => role.isSystem).map(role => role.key)).toEqual(['super_admin'])
  })

  it('have unique ids, keys and names, and store their lists as the panel would save them', () => {
    for (const field of ['id', 'key', 'nameBn', 'nameEn'] as const) expect(new Set(BUILT_IN_ROLES.map(role => role[field])).size).toBe(BUILT_IN_ROLES.length)
    for (const role of BUILT_IN_ROLES) {
      expect(role.permissions).toEqual(normalizePermissions(role.permissions))
      expect(role.descriptionBn && role.descriptionEn).toBeTruthy()
    }
  })

  it('leave staff, roles and the customer sign-in switch to the roles meant for them', () => {
    for (const role of BUILT_IN_ROLES) {
      if (role.key !== 'staff_admin') expect(role.permissions.filter(permission => permission.startsWith('staff.'))).toEqual([])
      // Managing roles is given only by ticking it on /admin/roles.
      expect(role.permissions.filter(permission => permission.startsWith('roles.'))).toEqual([])
      expect(role.permissions).not.toContain('catalog.customer_signin')
    }
  })

  it('label every permission', () => {
    for (const permission of ALL_PERMISSIONS) expect(PERMISSION_LABELS[permission].label.en).toBeTruthy()
  })
})
