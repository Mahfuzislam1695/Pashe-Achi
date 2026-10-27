import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AdminDto, PagedList, StaffStatsDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import type { AdminPrincipal } from '../auth/auth.types'
import { AdminGuard, Can, CurrentAdmin } from '../auth/guards'
import { CreateAdminDto, IdParamDto, ListStaffQueryDto, UpdateAdminDto } from '../common/dto'
import { StaffService } from './staff.service'

@ApiTags('Admin: staff')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('staff.view')
@Controller('admin/staff')
export class StaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Numbered pages of admin accounts, by name or mobile, role and whether they can sign in' })
  list(@Query() query: ListStaffQueryDto): Promise<PagedList<AdminDto>> {
    return this.staff.list(query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'How many accounts there are, how many can sign in, and how many hold each role' })
  stats(): Promise<StaffStatsDto> {
    return this.staff.stats()
  }

  @Post()
  @Can('staff.create')
  @ApiOperation({ summary: 'Add an admin account with a role (only a Super admin can give the Super admin role)' })
  create(@CurrentAdmin() admin: AdminPrincipal, @Actor() actor: AuditActor, @Body() body: CreateAdminDto): Promise<AdminDto> {
    return this.staff.create(body, admin, actor)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change name, role or active (staff.edit), or set a new password (staff.reset_password)' })
  update(@CurrentAdmin() admin: AdminPrincipal, @Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateAdminDto): Promise<AdminDto> {
    return this.staff.update(admin, actor, id, body)
  }
}
