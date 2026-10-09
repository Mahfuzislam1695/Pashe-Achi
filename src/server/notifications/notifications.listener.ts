import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { ORDER_STATUS_LABELS, type OrderStatus, orderCode, SERVICE_LABELS, SOCKET_EVENTS, type Text } from '@/shared'

import { DOMAIN_EVENTS, type OrderBillUpdatedEvent, type OrderCreatedEvent, type OrderStatusChangedEvent } from '../common/domain-events'
import { toOrderSummary } from '../orders/order.mapper'
import { NotificationsGateway } from './notifications.gateway'
import { NotificationsService } from './notifications.service'

const STATUS_MESSAGES: Partial<Record<OrderStatus, Text>> = {
  BOOKED: { bn: 'আপনার অর্ডার বুক করা হয়েছে।', en: 'Your order has been booked.' },
  IN_PROGRESS: { bn: 'আপনার অর্ডারের কাজ চলছে।', en: 'Your order is on its way.' },
  COMPLETED: { bn: 'অর্ডার সম্পন্ন হয়েছে। ধন্যবাদ!', en: 'Your order is complete. Thank you!' },
  CANCELLED: { bn: 'আপনার অর্ডার বাতিল করা হয়েছে।', en: 'Your order has been cancelled.' },
}

const withNote = (text: Text, note: string | null): Text => (note ? { bn: `${text.bn} ${note}`, en: `${text.en} ${note}` } : text)

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
      const code = orderCode(order.number)
      const service = SERVICE_LABELS[order.service]
      this.gateway.toAdmins(SOCKET_EVENTS.orderNew, toOrderSummary(order, true))
      await this.notifications.notifyAdmins({
        type: 'ORDER_CREATED',
        title: { bn: `নতুন অর্ডার ${code}`, en: `New order ${code}` },
        body: { bn: `${service.bn} · ${order.user.name} · ${order.total} টাকা`, en: `${service.en} · ${order.user.name} · Tk ${order.total}` },
        data: { orderId: order.id, orderCode: code },
      })
    })
  }

  @OnEvent(DOMAIN_EVENTS.orderStatusChanged, { async: true })
  async onStatusChanged({ order, to, note, by }: OrderStatusChangedEvent) {
    await this.safely('order.status_changed', async () => {
      const code = orderCode(order.number)
      this.gateway.toAdmins(SOCKET_EVENTS.orderUpdated, toOrderSummary(order, true))
      this.gateway.toUser(order.userId, SOCKET_EVENTS.orderUpdated, toOrderSummary(order))

      if (by === 'CUSTOMER') {
        await this.notifications.notifyAdmins({
          type: 'ORDER_STATUS',
          title: { bn: `অর্ডার ${code} বাতিল`, en: `Order ${code} cancelled` },
          body: { bn: `${order.user.name} অর্ডারটি বাতিল করেছেন।`, en: `${order.user.name} cancelled the order.` },
          data: { orderId: order.id, orderCode: code, status: to },
        })
        return
      }

      const label = ORDER_STATUS_LABELS[to]
      await this.notifications.notifyUser(order.userId, {
        type: 'ORDER_STATUS',
        title: { bn: `অর্ডার ${code}: ${label.bn}`, en: `Order ${code}: ${label.en}` },
        body: withNote(STATUS_MESSAGES[to] ?? label, note),
        data: { orderId: order.id, orderCode: code, status: to },
      })
    })
  }

  @OnEvent(DOMAIN_EVENTS.orderBillUpdated, { async: true })
  async onBillUpdated({ order }: OrderBillUpdatedEvent) {
    await this.safely('order.bill_updated', async () => {
      const code = orderCode(order.number)
      this.gateway.toAdmins(SOCKET_EVENTS.orderUpdated, toOrderSummary(order, true))
      this.gateway.toUser(order.userId, SOCKET_EVENTS.orderUpdated, toOrderSummary(order))
      await this.notifications.notifyUser(order.userId, {
        type: 'ORDER_BILL',
        title: { bn: `অর্ডার ${code}: বিল আপডেট`, en: `Order ${code}: bill updated` },
        body: { bn: `নতুন মোট বিল ${order.total} টাকা।`, en: `New total: Tk ${order.total}.` },
        data: { orderId: order.id, orderCode: code },
      })
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
