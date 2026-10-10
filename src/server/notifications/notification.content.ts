import { ORDER_STATUS_LABELS, type OrderStatus, orderCode, SERVICE_LABELS, type ServiceId, type Text } from '@/shared'

import type { NotificationContent } from './notification.mapper'

// What each order notification says. Plain functions (no Nest), so the demo seed writes exactly
// the same wording as the live listener.

interface OrderRef {
  id: string
  number: number
  service: ServiceId
  total: number
  user: { name: string }
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, Text>> = {
  BOOKED: { bn: 'আপনার অর্ডার বুক করা হয়েছে।', en: 'Your order has been booked.' },
  IN_PROGRESS: { bn: 'আপনার অর্ডারের কাজ চলছে।', en: 'Your order is on its way.' },
  COMPLETED: { bn: 'অর্ডার সম্পন্ন হয়েছে। ধন্যবাদ!', en: 'Your order is complete. Thank you!' },
  CANCELLED: { bn: 'আপনার অর্ডার বাতিল করা হয়েছে।', en: 'Your order has been cancelled.' },
}

const withNote = (text: Text, note: string | null): Text => (note ? { bn: `${text.bn} ${note}`, en: `${text.en} ${note}` } : text)

/** To admins: a customer placed an order. */
export function orderCreatedContent(order: OrderRef): NotificationContent {
  const code = orderCode(order.number)
  const service = SERVICE_LABELS[order.service]
  return {
    type: 'ORDER_CREATED',
    title: { bn: `নতুন অর্ডার ${code}`, en: `New order ${code}` },
    body: { bn: `${service.bn} · ${order.user.name} · ${order.total} টাকা`, en: `${service.en} · ${order.user.name} · Tk ${order.total}` },
    data: { orderId: order.id, orderCode: code },
  }
}

/** To admins: the customer cancelled their own order. */
export function customerCancelledContent(order: OrderRef, to: OrderStatus): NotificationContent {
  const code = orderCode(order.number)
  return {
    type: 'ORDER_STATUS',
    title: { bn: `অর্ডার ${code} বাতিল`, en: `Order ${code} cancelled` },
    body: { bn: `${order.user.name} অর্ডারটি বাতিল করেছেন।`, en: `${order.user.name} cancelled the order.` },
    data: { orderId: order.id, orderCode: code, status: to },
  }
}

/** To the customer: staff moved their order to a new status (with the staff member's note, if any). */
export function statusChangedContent(order: OrderRef, to: OrderStatus, note: string | null): NotificationContent {
  const code = orderCode(order.number)
  const label = ORDER_STATUS_LABELS[to]
  return {
    type: 'ORDER_STATUS',
    title: { bn: `অর্ডার ${code}: ${label.bn}`, en: `Order ${code}: ${label.en}` },
    body: withNote(STATUS_MESSAGES[to] ?? label, note),
    data: { orderId: order.id, orderCode: code, status: to },
  }
}

/** To the customer: staff corrected the bill. */
export function billUpdatedContent(order: OrderRef): NotificationContent {
  const code = orderCode(order.number)
  return {
    type: 'ORDER_BILL',
    title: { bn: `অর্ডার ${code}: বিল আপডেট`, en: `Order ${code}: bill updated` },
    body: { bn: `নতুন মোট বিল ${order.total} টাকা।`, en: `New total: Tk ${order.total}.` },
    data: { orderId: order.id, orderCode: code },
  }
}
