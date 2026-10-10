import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import type { AdminDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AdminGuard, Roles } from '../auth/guards'
import { CreateAdminDto, IdParamDto, UpdateAdminDto } from '../common/dto'
import { StaffService } from './staff.service'

@ApiTags('Admin: staff')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Roles('SUPER_ADMIN')
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(): Promise<AdminDto[]> {
    return this.staff.list()
  }

  @Post()
  create(@Actor() actor: AuditActor, @Body() body: CreateAdminDto): Promise<AdminDto> {
    return this.staff.create(body, actor)
  }

  @Patch(':id')
  update(@Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateAdminDto): Promise<AdminDto> {
    return this.staff.update(actor, id, body)
  }
}
