import { Inject, Injectable, Logger } from '@nestjs/common'
import type { ListNotificationsQuery, NotificationDto, Paginated, UnreadCountDto } from '@/shared'

import { AppException } from '../common/app.exception'
import { pageArgs, toPage } from '../common/pagination'
import type { Notification, Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { NOTIFICATION_CHANNELS, type NotificationChannel } from './channels'
import { type NotificationContent, toNotificationDto, toNotificationRow } from './notification.mapper'

/** Exactly one of the two. */
export type Recipient = { userId: string } | { adminId: string }

const BATCH = 1000

/** Stores notifications, then hands them to every delivery channel. */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name)

  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_CHANNELS) private readonly channels: NotificationChannel[],
  ) {}

  notifyUser(userId: string, content: NotificationContent) {
    return this.notifyUsers([userId], content)
  }

  /** Sends to the given customers, or to every customer who isn't blocked. Returns how many were notified. */
  async notifyUsers(userIds: string[] | 'all', content: NotificationContent): Promise<number> {
    const ids =
      userIds === 'all'
        ? (await this.prisma.user.findMany({ where: { isBlocked: false }, select: { id: true } })).map(user => user.id)
        : [...new Set(userIds)]
    const row = toNotificationRow(content)
    let sent = 0
    for (let start = 0; start < ids.length; start += BATCH) {
      const rows = await this.prisma.notification.createManyAndReturn({ data: ids.slice(start, start + BATCH).map(userId => ({ ...row, userId })) })
      await this.deliver(rows)
      sent += rows.length
    }
    return sent
  }

  /** Sends to every active admin. */
  async notifyAdmins(content: NotificationContent) {
    const admins = await this.prisma.admin.findMany({ where: { isActive: true }, select: { id: true } })
    if (!admins.length) return
    const row = toNotificationRow(content)
    await this.deliver(await this.prisma.notification.createManyAndReturn({ data: admins.map(admin => ({ ...row, adminId: admin.id })) }))
  }

  async list(recipient: Recipient, query: ListNotificationsQuery): Promise<Paginated<NotificationDto>> {
    const where: Prisma.NotificationWhereInput = { ...recipient, ...(query.unread === 'true' ? { readAt: null } : {}) }
    const rows = await this.prisma.notification.findMany({ where, ...pageArgs(query.cursor, query.limit) })
    return toPage(rows, query.limit, toNotificationDto)
  }

  async unreadCount(recipient: Recipient): Promise<UnreadCountDto> {
    return { count: await this.prisma.notification.count({ where: { ...recipient, readAt: null } }) }
  }

  async markRead(recipient: Recipient, id: string): Promise<NotificationDto> {
    const row = await this.prisma.notification.findFirst({ where: { id, ...recipient } })
    if (!row) throw AppException.notFound()
    if (row.readAt) return toNotificationDto(row)
    return toNotificationDto(await this.prisma.notification.update({ where: { id }, data: { readAt: new Date() } }))
  }

  async markAllRead(recipient: Recipient): Promise<UnreadCountDto> {
    await this.prisma.notification.updateMany({ where: { ...recipient, readAt: null }, data: { readAt: new Date() } })
    return { count: 0 }
  }

  /** A failing channel never fails the request that caused the notification; it is logged instead. */
  private async deliver(rows: Notification[]) {
    for (const channel of this.channels) {
      try {
        await channel.deliver(rows)
      } catch (error) {
        this.logger.error(`Channel "${channel.name}" failed: ${String(error)}`)
      }
    }
  }
}
