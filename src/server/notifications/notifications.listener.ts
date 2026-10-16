import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { SOCKET_EVENTS } from '@/shared'

import { DOMAIN_EVENTS, type OrderCreatedEvent, type OrderQuotedEvent, type OrderStatusChangedEvent } from '../common/domain-events'
import { toOrderSummary } from '../orders/order.mapper'
import { customerCancelledContent, customerConfirmedContent, orderCreatedContent, quotedContent, statusChangedContent } from './notification.content'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsService } from './notifications.service'

/** Turns order events into notifications for the right people, plus live list updates. */
@Injectable()
export class NotificationsListener {
  private readonly logger = new Logger(NotificationsListener.name)

  constructor(
    private readonly notifications: NotificationsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  @OnEvent(DOMAIN_EVENTS.orderCreated, { async: true })
  async onOrderCreated({ order }: OrderCreatedEvent) {
    await this.safely('order.created', async () => {
      this.gateway.toAdmins(SOCKET_EVENTS.orderNew, toOrderSummary(order, true))
      await this.notifications.notifyAdmins(orderCreatedContent(order))
    })
  }

  @OnEvent(DOMAIN_EVENTS.orderStatusChanged, { async: true })
  async onStatusChanged({ order, to, note, by }: OrderStatusChangedEvent) {
    await this.safely('order.status_changed', async () => {
      this.gateway.toAdmins(SOCKET_EVENTS.orderUpdated, toOrderSummary(order, true))
      this.gateway.toUser(order.userId, SOCKET_EVENTS.orderUpdated, toOrderSummary(order))

      // The customer either confirmed a quote (→ BOOKED) or cancelled: tell the staff.
      if (by === 'CUSTOMER') {
        await this.notifications.notifyAdmins(to === 'BOOKED' ? customerConfirmedContent(order, to) : customerCancelledContent(order, to))
        return
      }
      await this.notifications.notifyUser(order.userId, statusChangedContent(order, to, note))
    })
  }

  /** Staff sent a price (or a new one): the customer gets the whole bill, what changed and the note. */
  @OnEvent(DOMAIN_EVENTS.orderQuoted, { async: true })
  async onQuoted({ order, from, previous, note }: OrderQuotedEvent) {
    await this.safely('order.quoted', async () => {
      this.gateway.toAdmins(SOCKET_EVENTS.orderUpdated, toOrderSummary(order, true))
      this.gateway.toUser(order.userId, SOCKET_EVENTS.orderUpdated, toOrderSummary(order))
      await this.notifications.notifyUser(order.userId, quotedContent(order, { previous, note, requote: from === 'QUOTED' }))
    })
  }

  /** Notification failures are logged; they must never undo or fail the order change itself. */
  private async safely(event: string, run: () => Promise<void>) {
    try {
      await run()
    } catch (error) {
      this.logger.error(`Handling ${event} failed: ${error instanceof Error ? error.stack : String(error)}`)
    }
  }
}
