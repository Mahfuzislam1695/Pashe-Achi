import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { RoleDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import type { AdminPrincipal } from '../auth/auth.types'
import { AdminGuard, Can, CurrentAdmin } from '../auth/guards'
import { CreateRoleDto, IdParamDto, UpdateRoleDto } from '../common/dto'
import { RolesService } from './roles.service'

@ApiTags('Admin: roles')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/roles')
export class RolesController {
  constructor(private readonly roles: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Every role with its permissions and how many staff hold it (any admin: role names and pickers)' })
  list(): Promise<RoleDto[]> {
    return this.roles.list()
  }

  @Post()
  @Can('roles.create')
  @ApiOperation({ summary: 'Add a role: names and module.action permissions (only permissions the caller holds, unless Super admin)' })
  create(@CurrentAdmin() admin: AdminPrincipal, @Actor() actor: AuditActor, @Body() body: CreateRoleDto): Promise<RoleDto> {
    return this.roles.create(admin, actor, body)
  }

  @Patch(':id')
  @Can('roles.edit')
  @ApiOperation({ summary: "Change a role; staff holding it get the new permissions at once (not the Super admin role, nor the caller's own; only permissions the caller holds)" })
  update(@CurrentAdmin() admin: AdminPrincipal, @Actor() actor: AuditActor, @Param() { id }: IdParamDto, @Body() body: UpdateRoleDto): Promise<RoleDto> {
    return this.roles.update(admin, actor, id, body)
  }

  @Delete(':id')
  @HttpCode(204)
  @Can('roles.delete')
  @ApiOperation({ summary: 'Delete a role no staff member holds (not the Super admin role)' })
  remove(@Actor() actor: AuditActor, @Param() { id }: IdParamDto): Promise<void> {
    return this.roles.remove(id, actor)
  }
}
