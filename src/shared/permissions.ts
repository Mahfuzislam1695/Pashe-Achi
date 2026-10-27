// What staff may do, as module × action. Roles are rows in the database (made and edited on
// /admin/roles by staff holding roles.*), each holding a list of these permissions; the list itself lives
// here because the API enforces every one of them. Add a permission here, check it with @Can() on
// its route and can() in the panel, and give it labels in labels.ts.

/** Every module of the admin panel and what can be done in it. `view` comes first: any other action needs it. */
export const PERMISSION_MODULES = {
  dashboard: ['view', 'staff_activity'],
  orders: ['view', 'update_status', 'send_price'],
  customers: ['view', 'block', 'edit_points'],
  catalog: ['view', 'edit', 'customer_signin'],
  offers: ['view', 'create', 'edit', 'delete', 'notify'],
  notifications: ['view', 'broadcast'],
  history: ['view'],
  staff: ['view', 'create', 'edit', 'reset_password'],
  roles: ['view', 'create', 'edit', 'delete'],
} as const

export type PermissionModule = keyof typeof PERMISSION_MODULES
export type PermissionAction<M extends PermissionModule = PermissionModule> = (typeof PERMISSION_MODULES)[M][number]
export type Permission = { [M in PermissionModule]: `${M}.${(typeof PERMISSION_MODULES)[M][number]}` }[PermissionModule]

export const PERMISSION_MODULE_IDS = Object.keys(PERMISSION_MODULES) as PermissionModule[]

/** Every permission, in matrix order (module by module, view first). */
export const ALL_PERMISSIONS = PERMISSION_MODULE_IDS.flatMap(module => PERMISSION_MODULES[module].map(action => `${module}.${action}` as Permission)) as [Permission, ...Permission[]]

export const isPermission = (value: unknown): value is Permission => typeof value === 'string' && (ALL_PERMISSIONS as readonly string[]).includes(value)

/** The module a permission belongs to. */
export const permissionModule = (permission: Permission) => permission.slice(0, permission.indexOf('.')) as PermissionModule

/** Known permissions only, each once, in matrix order, and every module with an action also gets its view. */
export function normalizePermissions(list: readonly string[]): Permission[] {
  const chosen = new Set(list.filter(isPermission))
  for (const permission of [...chosen]) chosen.add(`${permissionModule(permission)}.view` as Permission)
  return ALL_PERMISSIONS.filter(permission => chosen.has(permission))
}

/** Whoever holds the system role (Super admin) may do everything, including permissions added later. */
export interface PermissionHolder {
  role: { isSystem: boolean }
  permissions: readonly string[]
}

export const can = (holder: PermissionHolder, permission: Permission) => holder.role.isSystem || holder.permissions.includes(permission)

/** A holder's permissions as the API reports them: every permission for the system role. */
export const effectivePermissions = (role: { isSystem: boolean; permissions: readonly string[] }): Permission[] => (role.isSystem ? [...ALL_PERMISSIONS] : normalizePermissions(role.permissions))

/** The built-in roles the seed creates (the first three also by the roles migration). Only super_admin is the system role. */
export const SYSTEM_ROLE_KEYS = {
  superAdmin: 'super_admin',
  manager: 'manager',
  operator: 'operator',
  support: 'support',
  pricing: 'pricing',
  dispatch: 'dispatch',
  marketing: 'marketing',
  accounts: 'accounts',
  staffAdmin: 'staff_admin',
} as const

/** The starting permissions of the built-in Manager role: what managers could do before roles were editable (never staff or roles). */
export const MANAGER_PERMISSIONS: Permission[] = ALL_PERMISSIONS.filter(permission => !permission.startsWith('staff.') && !permission.startsWith('roles.') && permission !== 'catalog.customer_signin')

/** The starting permissions of the built-in Operator role: handling orders, and seeing the rest. */
export const OPERATOR_PERMISSIONS: Permission[] = normalizePermissions(['dashboard.view', 'orders.view', 'orders.update_status', 'orders.send_price', 'customers.view', 'catalog.view', 'offers.view', 'notifications.view'])

/**
 * The roles every install starts with, ready to assign (the seed creates any that are missing, with these ids).
 * All but Super admin can then be edited or deleted like any other role.
 */
export const BUILT_IN_ROLES = [
  {
    id: 'role_super_admin',
    key: SYSTEM_ROLE_KEYS.superAdmin,
    nameBn: 'সুপার অ্যাডমিন',
    nameEn: 'Super admin',
    descriptionBn: 'সব অনুমতি আছে; রোল আর স্টাফ পরিচালনা করেন।',
    descriptionEn: 'Has every permission, and manages roles and staff.',
    isSystem: true,
    permissions: [] as Permission[],
  },
  {
    id: 'role_manager',
    key: SYSTEM_ROLE_KEYS.manager,
    nameBn: 'ম্যানেজার',
    nameEn: 'Manager',
    descriptionBn: 'অর্ডার, দাম, ক্যাটালগ, অফার আর কাস্টমার দেখাশোনা করেন; স্টাফ ছাড়া সব।',
    descriptionEn: 'Runs the day: orders, prices, catalog, offers and customers. Everything but staff.',
    isSystem: false,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    id: 'role_operator',
    key: SYSTEM_ROLE_KEYS.operator,
    nameBn: 'অপারেটর',
    nameEn: 'Operator',
    descriptionBn: 'অর্ডার সামলান: দাম পাঠান আর স্ট্যাটাস বদলান।',
    descriptionEn: 'Handles orders: sends prices and moves statuses.',
    isSystem: false,
    permissions: OPERATOR_PERMISSIONS,
  },
  {
    id: 'role_support',
    key: SYSTEM_ROLE_KEYS.support,
    nameBn: 'কাস্টমার সাপোর্ট',
    nameEn: 'Customer support',
    descriptionBn: 'কাস্টমারের প্রশ্নের উত্তর দেন: অর্ডার আর একাউন্ট দেখেন, পয়েন্ট ঠিক করেন।',
    descriptionEn: 'Answers customers: sees their orders and accounts, and can adjust points.',
    isSystem: false,
    permissions: normalizePermissions(['dashboard.view', 'orders.view', 'customers.view', 'customers.edit_points', 'catalog.view', 'offers.view', 'notifications.view']),
  },
  {
    id: 'role_pricing',
    key: SYSTEM_ROLE_KEYS.pricing,
    nameBn: 'দাম নির্ধারণ',
    nameEn: 'Pricing desk',
    descriptionBn: 'বাজার, ঔষুধ আর বাসা বদলের অর্ডারে দাম পাঠান।',
    descriptionEn: 'Prices bazar, medicine and house shifting orders.',
    isSystem: false,
    permissions: normalizePermissions(['dashboard.view', 'orders.view', 'orders.send_price', 'catalog.view']),
  },
  {
    id: 'role_dispatch',
    key: SYSTEM_ROLE_KEYS.dispatch,
    nameBn: 'ডেলিভারি সমন্বয়ক',
    nameEn: 'Dispatcher',
    descriptionBn: 'ডেলিভারি চালান: অর্ডারের স্ট্যাটাস বদলান।',
    descriptionEn: 'Runs deliveries: moves orders through their statuses.',
    isSystem: false,
    permissions: normalizePermissions(['dashboard.view', 'orders.view', 'orders.update_status', 'customers.view']),
  },
  {
    id: 'role_marketing',
    key: SYSTEM_ROLE_KEYS.marketing,
    nameBn: 'মার্কেটিং',
    nameEn: 'Marketing',
    descriptionBn: 'আজকের অফার বানান আর কাস্টমারদের নোটিফিকেশন পাঠান।',
    descriptionEn: "Makes today's offers and sends notifications to customers.",
    isSystem: false,
    permissions: normalizePermissions(['dashboard.view', 'customers.view', 'offers.create', 'offers.edit', 'offers.delete', 'offers.notify', 'notifications.broadcast']),
  },
  {
    id: 'role_accounts',
    key: SYSTEM_ROLE_KEYS.accounts,
    nameBn: 'হিসাব',
    nameEn: 'Accounts',
    descriptionBn: 'শুধু দেখেন: ড্যাশবোর্ড, স্টাফের কাজ, অর্ডার, কাস্টমার আর ইতিহাস।',
    descriptionEn: 'View only: the dashboard, staff activity, orders, customers and history.',
    isSystem: false,
    permissions: normalizePermissions(['dashboard.staff_activity', 'orders.view', 'customers.view', 'catalog.view', 'history.view']),
  },
  {
    id: 'role_staff_admin',
    key: SYSTEM_ROLE_KEYS.staffAdmin,
    nameBn: 'স্টাফ অ্যাডমিন',
    nameEn: 'Staff admin',
    descriptionBn: 'স্টাফ যোগ করেন, রোল দেন আর পাসওয়ার্ড বদলান (সুপার অ্যাডমিনের নয়)।',
    descriptionEn: "Adds staff, assigns roles and resets passwords (never a Super admin's).",
    isSystem: false,
    permissions: normalizePermissions(['dashboard.view', 'staff.create', 'staff.edit', 'staff.reset_password']),
  },
] as const
