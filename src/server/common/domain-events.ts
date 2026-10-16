import type { ActorType, OrderStatus } from '@/shared'

import type { OrderWithRelations } from '../orders/order.mapper'

/**
 * In-process domain events (via @nestjs/event-emitter). Services emit them after the database
 * write commits; the notifications module listens and delivers in-app/realtime messages.
 */
export const DOMAIN_EVENTS = {
  orderCreated: 'order.created',
  orderStatusChanged: 'order.status_changed',
  orderQuoted: 'order.quoted',
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

/** The bill before a quote: the fees the customer saw when ordering, or the last quote's. */
export interface QuotedBill {
  itemsTotal: number
  serviceFee: number
  deliveryFee: number
  total: number
}

/** Staff sent a bazar or medicine order's price (from PENDING) or a new one (from QUOTED). */
export interface OrderQuotedEvent {
  order: OrderWithRelations
  from: OrderStatus
  previous: QuotedBill
  note: string | null
}

export interface CustomerBlockedEvent {
  userId: string
}
