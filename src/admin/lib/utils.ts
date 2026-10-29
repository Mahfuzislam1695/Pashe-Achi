import { isApiError } from '@/api-client'
import { type AdminDto, can, type MessageCode, type Permission, pickIssueCode } from '@/shared'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/** A file size for people: 845 KB, 21.8 MB, 1.2 GB. */
export function fileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

/** The message code to show for a failed request. */
export function errorCode(error: unknown, priority: readonly MessageCode[] = []): MessageCode {
  if (typeof error === 'string') return error as MessageCode
  if (!isApiError(error)) return 'server'
  return error.issueCodes.length ? pickIssueCode(error.issueCodes, priority) : error.code
}

// The panel hides what the signed-in admin's role can't do with can(admin, 'orders.send_price')
// from @/shared, the same check the API's @Can() makes (and still enforces).

/** The Super admin role: every permission, and the only one that manages roles. */
export const isSystemRole = (admin: Pick<AdminDto, 'role'>) => admin.role.isSystem

/** Each page of the panel and the permission that opens it, in menu order. */
const PAGES: [string, Permission][] = [
  ['/admin', 'dashboard.view'],
  ['/admin/orders', 'orders.view'],
  ['/admin/customers', 'customers.view'],
  ['/admin/catalog', 'catalog.view'],
  ['/admin/offers', 'offers.view'],
  ['/admin/notifications', 'notifications.view'],
  ['/admin/history', 'history.view'],
  ['/admin/staff', 'staff.view'],
  ['/admin/roles', 'roles.view'],
  ['/admin/system', 'system.view'],
]

/** The first page this admin may open (the profile when their role allows none). */
export const homePath = (admin: AdminDto) => PAGES.find(([, permission]) => can(admin, permission))?.[0] ?? '/admin/profile'
