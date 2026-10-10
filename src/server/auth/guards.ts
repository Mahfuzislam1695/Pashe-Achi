import { type CanActivate, createParamDecorator, type ExecutionContext, Injectable, SetMetadata } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { AdminRole } from '@/shared'
import type { Request } from 'express'

import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import type { AdminPrincipal, AuthenticatedRequest, CustomerPrincipal } from './auth.types'
import { readAccessToken } from './cookies'
import { TokenService } from './token.service'

type AuthRequest = Request & AuthenticatedRequest

/**
 * Requires a customer access token (Bearer or pa_at cookie). The account is re-checked on every
 * request, so blocking a customer takes effect immediately.
 */
@Injectable()
export class CustomerGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>()
    const token = readAccessToken(request, 'customer')
    const payload = token ? await this.tokens.verifyAccessToken('customer', token) : null
    if (!payload) throw AppException.unauthorized()

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, isBlocked: true } })
    if (!user) throw AppException.unauthorized()
    if (user.isBlocked) throw AppException.forbidden('auth.blocked')
    request.customer = { kind: 'customer', id: user.id, name: user.name }
    return true
  }
}

const ROLES_KEY = 'admin-roles'

/** Limits an admin route to these roles. SUPER_ADMIN always passes. Without it, any active admin may call the route. */
export const Roles = (...roles: AdminRole[]) => SetMetadata(ROLES_KEY, roles)

/** Requires an admin access token (Bearer or pa_admin_at cookie) from an active admin with an allowed role. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthRequest>()
    const token = readAccessToken(request, 'admin')
    const payload = token ? await this.tokens.verifyAccessToken('admin', token) : null
    if (!payload) throw AppException.unauthorized()

    const admin = await this.prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, role: true, isActive: true } })
    if (!admin) throw AppException.unauthorized()
    if (!admin.isActive) throw AppException.forbidden('auth.blocked')

    const roles = this.reflector.getAllAndOverride<AdminRole[] | undefined>(ROLES_KEY, [context.getHandler(), context.getClass()])
    if (roles?.length && admin.role !== 'SUPER_ADMIN' && !roles.includes(admin.role)) throw AppException.forbidden()

    request.admin = { kind: 'admin', id: admin.id, name: admin.name, role: admin.role }
    return true
  }
}

export const CurrentCustomer = createParamDecorator((_: unknown, context: ExecutionContext): CustomerPrincipal => {
  const principal = context.switchToHttp().getRequest<AuthRequest>().customer
  if (!principal) throw AppException.unauthorized()
  return principal
})

export const CurrentAdmin = createParamDecorator((_: unknown, context: ExecutionContext): AdminPrincipal => {
  const principal = context.switchToHttp().getRequest<AuthRequest>().admin
  if (!principal) throw AppException.unauthorized()
  return principal
})
