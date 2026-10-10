import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { SOCKET_EVENTS } from '@/shared'

import { DOMAIN_EVENTS, type OrderBillUpdatedEvent, type OrderCreatedEvent, type OrderStatusChangedEvent } from '../common/domain-events'
import { toOrderSummary } from '../orders/order.mapper'
import { billUpdatedContent, customerCancelledContent, orderCreatedContent, statusChangedContent } from './notification.content'
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

      if (by === 'CUSTOMER') {
        await this.notifications.notifyAdmins(customerCancelledContent(order, to))
        return
      }
      await this.notifications.notifyUser(order.userId, statusChangedContent(order, to, note))
    })
  }

  @OnEvent(DOMAIN_EVENTS.orderBillUpdated, { async: true })
  async onBillUpdated({ order }: OrderBillUpdatedEvent) {
    await this.safely('order.bill_updated', async () => {
      this.gateway.toAdmins(SOCKET_EVENTS.orderUpdated, toOrderSummary(order, true))
      this.gateway.toUser(order.userId, SOCKET_EVENTS.orderUpdated, toOrderSummary(order))
      await this.notifications.notifyUser(order.userId, billUpdatedContent(order))
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
