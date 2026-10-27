import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { NotificationDto, NotificationStatsDto, PagedList, Paginated, PushKeyDto, UnreadCountDto } from '@/shared'
import type { Request } from 'express'

import { Actor, type AuditActor, clientInfo } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import type { AdminPrincipal, CustomerPrincipal } from '../auth/auth.types'
import { AdminGuard, Can, CurrentAdmin, CurrentCustomer, CustomerGuard } from '../auth/guards'
import { BroadcastDto, IdParamDto, ListAdminNotificationsQueryDto, ListNotificationsQueryDto, NotificationStatsQueryDto, PushRemoveDto, PushSubscriptionDto } from '../common/dto'
import { NotificationsService } from './notifications.service'
import { PushService } from './push.service'

@ApiTags('Notifications')
@ApiBearerAuth()
@ApiCookieAuth('pa_at')
@UseGuards(CustomerGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
  ) {}

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

  @Get('push')
  @ApiOperation({ summary: 'The key a browser subscribes to phone/desktop notifications with (null: push is not set up)' })
  pushKey(): PushKeyDto {
    return this.push.publicKey()
  }

  @Put('push')
  @HttpCode(204)
  @ApiOperation({ summary: "Send this browser the customer's notifications (Web Push)" })
  async subscribePush(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: PushSubscriptionDto, @Req() request: Request): Promise<void> {
    await this.push.subscribe({ userId: customer.id }, body, clientInfo(request).userAgent)
  }

  @Delete('push')
  @HttpCode(204)
  @ApiOperation({ summary: 'Stop sending this browser notifications (also called before logging out)' })
  async unsubscribePush(@CurrentCustomer() customer: CustomerPrincipal, @Body() body: PushRemoveDto): Promise<void> {
    await this.push.unsubscribe({ userId: customer.id }, body.endpoint)
  }
}

@ApiTags('Admin: notifications')
@ApiCookieAuth('pa_admin_at')
@UseGuards(AdminGuard)
@Can('notifications.view')
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly notifications: NotificationsService,
    private readonly push: PushService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'The inbox in numbered pages, filtered by type, days and unread' })
  list(@CurrentAdmin() admin: AdminPrincipal, @Query() query: ListAdminNotificationsQueryDto): Promise<PagedList<NotificationDto>> {
    return this.notifications.listForAdmin(admin.id, query)
  }

  @Get('stats')
  @ApiOperation({ summary: 'How many notifications the filters match, how many are unread, and how many came today' })
  stats(@CurrentAdmin() admin: AdminPrincipal, @Query() query: NotificationStatsQueryDto): Promise<NotificationStatsDto> {
    return this.notifications.statsForAdmin(admin.id, query)
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

  @Get('push')
  pushKey(): PushKeyDto {
    return this.push.publicKey()
  }

  @Put('push')
  @HttpCode(204)
  @ApiOperation({ summary: "Send this browser the staff member's notifications (Web Push)" })
  async subscribePush(@CurrentAdmin() admin: AdminPrincipal, @Body() body: PushSubscriptionDto, @Req() request: Request): Promise<void> {
    await this.push.subscribe({ adminId: admin.id }, body, clientInfo(request).userAgent)
  }

  @Delete('push')
  @HttpCode(204)
  async unsubscribePush(@CurrentAdmin() admin: AdminPrincipal, @Body() body: PushRemoveDto): Promise<void> {
    await this.push.unsubscribe({ adminId: admin.id }, body.endpoint)
  }

  @Post('broadcast')
  @Can('notifications.broadcast')
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
