import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { ActorType, AdminRole } from '@/shared'
import type { Request } from 'express'

import type { AuthenticatedRequest } from '../auth/auth.types'
import { AppException } from '../common/app.exception'

/** Where a request came from, kept on history entries. */
export interface ClientInfo {
  ip?: string
  userAgent?: string
}

/** Who made a change, for the history log. */
export interface AuditActor extends ClientInfo {
  type: ActorType
  /** The admin's or customer's id; null for the system. */
  id: string | null
  /** The name at the time of the change. */
  name: string
  role?: AdminRole
}

export const SYSTEM_ACTOR: AuditActor = { type: 'SYSTEM', id: null, name: 'System' }

export const adminActor = (admin: { id: string; name: string; role: AdminRole }, client: ClientInfo = {}): AuditActor => ({
  type: 'ADMIN',
  id: admin.id,
  name: admin.name,
  role: admin.role,
  ...client,
})

export const customerActor = (user: { id: string; name: string }, client: ClientInfo = {}): AuditActor => ({ type: 'CUSTOMER', id: user.id, name: user.name, ...client })

export const clientInfo = (request: Request): ClientInfo => ({
  ip: request.ip?.replace(/^::ffff:/, '').slice(0, 64),
  userAgent: request.get('user-agent')?.slice(0, 300),
})

/** The request's IP address and user agent (for routes without a signed-in account, e.g. login). */
export const RequestClient = createParamDecorator((_: unknown, context: ExecutionContext): ClientInfo => clientInfo(context.switchToHttp().getRequest<Request>()))

/** The signed-in admin or customer making this request, with its IP address and user agent. Use after a guard. */
export const Actor = createParamDecorator((_: unknown, context: ExecutionContext): AuditActor => {
  const request = context.switchToHttp().getRequest<Request & AuthenticatedRequest>()
  if (request.admin) return adminActor(request.admin, clientInfo(request))
  if (request.customer) return customerActor(request.customer, clientInfo(request))
  throw AppException.unauthorized()
})
