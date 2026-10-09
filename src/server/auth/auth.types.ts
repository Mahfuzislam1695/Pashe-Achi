import type { AdminRole } from '@/shared'

/** Customers (web/Flutter app) and staff (admin panel) have separate tokens, secrets and cookies. */
export type Audience = 'customer' | 'admin'

export interface CustomerPrincipal {
  kind: 'customer'
  id: string
}

export interface AdminPrincipal {
  kind: 'admin'
  id: string
  name: string
  role: AdminRole
}

export interface AccessTokenPayload {
  sub: string
}

/** Set on the Express request by the guards. */
export interface AuthenticatedRequest {
  customer?: CustomerPrincipal
  admin?: AdminPrincipal
}
