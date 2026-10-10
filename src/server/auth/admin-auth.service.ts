import { Injectable } from '@nestjs/common'
import type { AdminDto, AuthResponse, ChangePasswordInput, LoginInput } from '@/shared'

import { adminActor, type AuditActor, type ClientInfo } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app.exception'
import type { Admin } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { toAdminDto } from '../users/user.mapper'
import { DUMMY_HASH, hashPassword, verifyPassword } from './password'
import { TokenService } from './token.service'

const staffEntity = (admin: Pick<Admin, 'id' | 'name'>) => ({ type: 'STAFF' as const, id: admin.id, label: admin.name })

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  /** Every sign-in, and every failed attempt, goes into the history log (never the password typed). */
  async login(input: LoginInput, client: ClientInfo = {}): Promise<AuthResponse<AdminDto>> {
    const admin = await this.prisma.admin.findUnique({ where: { mobile: input.mobile } })
    const valid = await verifyPassword(input.password, admin?.passwordHash ?? DUMMY_HASH)
    if (!admin || !valid || !admin.isActive) {
      const reason = !admin ? 'unknown_mobile' : !valid ? 'wrong_password' : 'inactive'
      await this.audit.record({
        action: 'ADMIN_SIGN_IN_FAILED',
        // Without the right password we don't know who tried, only the mobile number they typed.
        actor: admin && valid ? adminActor(admin, client) : { type: 'ADMIN', id: null, name: input.mobile, ...client },
        entity: admin ? staffEntity(admin) : { type: 'STAFF', label: input.mobile },
        meta: { reason },
      })
      if (reason === 'inactive') throw AppException.forbidden('auth.blocked')
      throw AppException.unauthorized('auth.invalid')
    }

    const { refreshId: _, ...tokens } = await this.tokens.issue('admin', admin.id, { userAgent: client.userAgent })
    await this.audit.record({ action: 'ADMIN_SIGNED_IN', actor: adminActor(admin, client), entity: staffEntity(admin) })
    return { user: toAdminDto(admin), tokens }
  }

  async refresh(refreshToken: string | undefined, userAgent?: string): Promise<AuthResponse<AdminDto>> {
    const { ownerId, tokens } = await this.tokens.rotate('admin', refreshToken, userAgent)
    const admin = await this.prisma.admin.findUnique({ where: { id: ownerId } })
    if (!admin) throw AppException.unauthorized()
    if (!admin.isActive) {
      await this.tokens.revokeAll('admin', admin.id)
      throw AppException.forbidden('auth.blocked')
    }
    return { user: toAdminDto(admin), tokens }
  }

  async logout(refreshToken: string | undefined, client: ClientInfo = {}) {
    const owner = await this.tokens.revoke(refreshToken)
    if (!owner?.adminId) return
    const admin = await this.prisma.admin.findUnique({ where: { id: owner.adminId } })
    if (admin) await this.audit.record({ action: 'ADMIN_SIGNED_OUT', actor: adminActor(admin, client), entity: staffEntity(admin) })
  }

  async me(adminId: string): Promise<AdminDto> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } })
    if (!admin) throw AppException.unauthorized()
    return toAdminDto(admin)
  }

  /** Changes the password and logs out every other session. */
  async changePassword(adminId: string, input: ChangePasswordInput, actor: AuditActor) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } })
    if (!(await verifyPassword(input.currentPassword, admin.passwordHash))) throw AppException.badRequest('password.wrong')
    const passwordHash = await hashPassword(input.newPassword)
    await this.prisma.$transaction(async tx => {
      await tx.admin.update({ where: { id: admin.id }, data: { passwordHash } })
      await this.audit.record({ action: 'ADMIN_PASSWORD_CHANGED', actor, entity: staffEntity(admin) }, tx)
    })
    await this.tokens.revokeAll('admin', admin.id)
  }
}
