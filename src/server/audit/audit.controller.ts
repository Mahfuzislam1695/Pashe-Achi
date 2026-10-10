import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuditLogDto, Paginated } from '@/shared'

import { AdminGuard, Roles } from '../auth/guards'
import { ListAuditQueryDto } from '../common/dto'
import { AuditService } from './audit.service'

@ApiTags('Admin: history')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Roles('MANAGER')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'The history log: who changed what, and when, newest first (managers and super admins)' })
  list(@Query() query: ListAuditQueryDto): Promise<Paginated<AuditLogDto>> {
    return this.audit.list(query)
  }
}
