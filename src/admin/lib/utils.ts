import { isApiError } from '@/api-client'
import { type AdminRole, type MessageCode, pickIssueCode } from '@/shared'
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs))

/** The message code to show for a failed request. */
export function errorCode(error: unknown, priority: readonly MessageCode[] = []): MessageCode {
  if (typeof error === 'string') return error as MessageCode
  if (!isApiError(error)) return 'server'
  return error.issueCodes.length ? pickIssueCode(error.issueCodes, priority) : error.code
}

// Mirrors the API's @Roles() checks so the UI hides what a role can't do (the API still enforces it).
export const canManage = (role: AdminRole) => role === 'SUPER_ADMIN' || role === 'MANAGER'
export const isSuperAdmin = (role: AdminRole) => role === 'SUPER_ADMIN'
