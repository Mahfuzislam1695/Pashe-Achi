import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { DashboardDto, StaffActivityDto } from '@/shared'

import { AdminGuard, Can } from '../auth/guards'
import { DashboardQueryDto } from '../common/dto'
import { DashboardService } from './dashboard.service'

@ApiTags('Admin: dashboard')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('dashboard.view')
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({ summary: 'The period (from–to, Bangladesh days) beside the one before it, the live queue, and the period by status, service, day and customer. Revenue counts confirmed bills only.' })
  get(@Query() query: DashboardQueryDto): Promise<DashboardDto> {
    return this.dashboard.get(query)
  }

  @Get('staff')
  @Can('dashboard.staff_activity')
  @ApiOperation({ summary: 'What each staff member did to orders in the period: status changes, prices sent and completions (managers and up)' })
  staff(@Query() query: DashboardQueryDto): Promise<StaffActivityDto> {
    return this.dashboard.staff(query)
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
