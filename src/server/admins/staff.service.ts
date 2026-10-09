import { Injectable } from '@nestjs/common'
import type { AdminDto, CreateAdminInput, UpdateAdminInput } from '@/shared'

import { hashPassword } from '../auth/password'
import { TokenService } from '../auth/token.service'
import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import { toAdminDto } from '../users/user.mapper'

/** Admin panel accounts. Only super admins reach this service. */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async list(): Promise<AdminDto[]> {
    const admins = await this.prisma.admin.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }] })
    return admins.map(toAdminDto)
  }

  async create(input: CreateAdminInput): Promise<AdminDto> {
    const taken = await this.prisma.admin.findUnique({ where: { mobile: input.mobile }, select: { id: true } })
    if (taken) throw AppException.conflict('mobile.taken')
    const admin = await this.prisma.admin.create({
      data: { name: input.name, mobile: input.mobile, role: input.role, passwordHash: await hashPassword(input.password) },
    })
    return toAdminDto(admin)
  }

  async update(actorId: string, id: string, input: UpdateAdminInput): Promise<AdminDto> {
    const isSelf = actorId === id
    if (isSelf && (input.isActive === false || (input.role && input.role !== 'SUPER_ADMIN'))) throw AppException.badRequest('admin.self')

    const admin = await this.prisma.admin.update({
      where: { id },
      data: {
        name: input.name,
        role: input.role,
        isActive: input.isActive,
        ...(input.password ? { passwordHash: await hashPassword(input.password) } : {}),
      },
    })
    // A deactivated account or a reset password ends every session of that admin.
    if (input.isActive === false || input.password) await this.tokens.revokeAll('admin', id)
    return toAdminDto(admin)
  }
}
