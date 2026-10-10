import type { ActorType, OrderStatus } from '@/shared'

import type { OrderWithRelations } from '../orders/order.mapper'

/**
 * In-process domain events (via @nestjs/event-emitter). Services emit them after the database
 * write commits; the notifications module listens and delivers in-app/realtime messages.
 */
export const DOMAIN_EVENTS = {
  orderCreated: 'order.created',
  orderStatusChanged: 'order.status_changed',
  orderBillUpdated: 'order.bill_updated',
  customerBlocked: 'customer.blocked',
} as const

export interface OrderCreatedEvent {
  order: OrderWithRelations
}

export interface OrderStatusChangedEvent {
  order: OrderWithRelations
  from: OrderStatus
  to: OrderStatus
  note: string | null
  by: ActorType
}

export interface OrderBillUpdatedEvent {
  order: OrderWithRelations
  previousTotal: number
}

export interface CustomerBlockedEvent {
  userId: string
}
