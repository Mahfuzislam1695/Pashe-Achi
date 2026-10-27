import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { AuditLogDto, AuditStatsDto, PagedList } from '@/shared'

import { AdminGuard, Can } from '../auth/guards'
import { AuditStatsQueryDto, ListAuditQueryDto } from '../common/dto'
import { AuditService } from './audit.service'

@ApiTags('Admin: history')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('history.view')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'The history log: who changed what, and when, newest first (history.view)' })
  list(@Query() query: ListAuditQueryDto): Promise<PagedList<AuditLogDto>> {
    return this.audit.list(query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'How many history entries the filters match, by who acted (customer, staff or system)' })
  stats(@Query() query: AuditStatsQueryDto): Promise<AuditStatsDto> {
    return this.audit.stats(query)
  }
}
