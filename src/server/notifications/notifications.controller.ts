import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { NotificationDto, Paginated, UnreadCountDto } from '@/shared'

import { Actor, type AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import type { AdminPrincipal, CustomerPrincipal } from '../auth/auth.types'
import { AdminGuard, CurrentAdmin, CurrentCustomer, CustomerGuard, Roles } from '../auth/guards'
import { BroadcastDto, IdParamDto, ListNotificationsQueryDto } from '../common/dto'
import { NotificationsService } from './notifications.service'

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentCustomer() customer: CustomerPrincipal, @Query() query: ListNotificationsQueryDto): Promise<Paginated<NotificationDto>> {
    return this.notifications.list({ userId: customer.id }, query)
  }

  @Get('unread-count')
  unreadCount(@CurrentCustomer() customer: CustomerPrincipal): Promise<UnreadCountDto> {
    return this.notifications.unreadCount({ userId: customer.id })
  }

  @Patch(':id/read')
  markRead(@CurrentCustomer() customer: CustomerPrincipal, @Param() { id }: IdParamDto): Promise<NotificationDto> {
    return this.notifications.markRead({ userId: customer.id }, id)
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentCustomer() customer: CustomerPrincipal): Promise<UnreadCountDto> {
    return this.notifications.markAllRead({ userId: customer.id })
  }
}

@ApiTags('Admin: notifications')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@CurrentAdmin() admin: AdminPrincipal, @Query() query: ListNotificationsQueryDto): Promise<Paginated<NotificationDto>> {
    return this.notifications.list({ adminId: admin.id }, query)
  }

  @Get('unread-count')
  unreadCount(@CurrentAdmin() admin: AdminPrincipal): Promise<UnreadCountDto> {
    return this.notifications.unreadCount({ adminId: admin.id })
  }

  @Patch(':id/read')
  markRead(@CurrentAdmin() admin: AdminPrincipal, @Param() { id }: IdParamDto): Promise<NotificationDto> {
    return this.notifications.markRead({ adminId: admin.id }, id)
  }

  @Post('read-all')
  @HttpCode(200)
  markAllRead(@CurrentAdmin() admin: AdminPrincipal): Promise<UnreadCountDto> {
    return this.notifications.markAllRead({ adminId: admin.id })
  }

  @Post('broadcast')
  @Roles('MANAGER')
  @ApiOperation({ summary: 'Send a bilingual announcement to all customers or to selected ones' })
  async broadcast(@Actor() actor: AuditActor, @Body() body: BroadcastDto): Promise<{ sent: number }> {
    const sent = await this.notifications.notifyUsers(body.userIds ?? 'all', {
      type: 'ANNOUNCEMENT',
      title: { bn: body.titleBn, en: body.titleEn },
      body: { bn: body.bodyBn, en: body.bodyEn },
    })
    await this.audit.record({
      action: 'ANNOUNCEMENT_SENT',
      actor,
      entity: { type: 'ANNOUNCEMENT', label: body.titleEn },
      note: body.bodyEn,
      meta: { titleBn: body.titleBn, bodyBn: body.bodyBn, audience: body.userIds ? 'selected' : 'all', sent },
    })
    return { sent }
  }
}
