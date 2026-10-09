import { Injectable } from '@nestjs/common'
import type { AdminDto, AuthResponse, ChangePasswordInput, LoginInput } from '@/shared'

import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import { toAdminDto } from '../users/user.mapper'
import { DUMMY_HASH, hashPassword, verifyPassword } from './password'
import { TokenService } from './token.service'

@Injectable()
export class AdminAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async login(input: LoginInput, userAgent?: string): Promise<AuthResponse<AdminDto>> {
    const admin = await this.prisma.admin.findUnique({ where: { mobile: input.mobile } })
    const valid = await verifyPassword(input.password, admin?.passwordHash ?? DUMMY_HASH)
    if (!admin || !valid) throw AppException.unauthorized('auth.invalid')
    if (!admin.isActive) throw AppException.forbidden('auth.blocked')

    const { refreshId: _, ...tokens } = await this.tokens.issue('admin', admin.id, { userAgent })
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

  logout(refreshToken: string | undefined) {
    return this.tokens.revoke(refreshToken)
  }

  async me(adminId: string): Promise<AdminDto> {
    const admin = await this.prisma.admin.findUnique({ where: { id: adminId } })
    if (!admin) throw AppException.unauthorized()
    return toAdminDto(admin)
  }

  /** Changes the password and logs out every other session. */
  async changePassword(adminId: string, input: ChangePasswordInput) {
    const admin = await this.prisma.admin.findUniqueOrThrow({ where: { id: adminId } })
    if (!(await verifyPassword(input.currentPassword, admin.passwordHash))) throw AppException.badRequest('password.wrong')
    await this.prisma.admin.update({ where: { id: adminId }, data: { passwordHash: await hashPassword(input.newPassword) } })
    await this.tokens.revokeAll('admin', adminId)
  }
}
