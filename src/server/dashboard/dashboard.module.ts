import { Controller, Get, Module, Query, UseGuards } from '@nestjs/common'
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger'
import type { DashboardDto } from '@/shared'

import { AdminGuard } from '../auth/guards'
import { DashboardQueryDto } from '../common/dto'
import { DashboardService } from './dashboard.service'

@ApiTags('Admin: dashboard')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Query() query: DashboardQueryDto): Promise<DashboardDto> {
    return this.dashboard.get(query.days)
  }
}

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
