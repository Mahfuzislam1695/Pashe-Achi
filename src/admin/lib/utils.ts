import { isApiError } from '@/api-client'
import { type AdminDto, can, type MessageCode, type Permission, pickIssueCode } from '@/shared'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

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
]

/** The first page this admin may open (the profile when their role allows none). */
export const homePath = (admin: AdminDto) => PAGES.find(([, permission]) => can(admin, permission))?.[0] ?? '/admin/profile'
