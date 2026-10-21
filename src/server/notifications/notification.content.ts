import { isQuotedService, ORDER_STATUS_LABELS, type OrderStatus, orderCode, SERVICE_LABELS, type ServiceId, type Text } from '@/shared'

import type { NotificationContent } from './notification.mapper'

// What each order notification says. Plain functions (no Nest), so the demo seed writes exactly
// the same wording as the live listener.

interface OrderRef {
  id: string
  number: number
  service: ServiceId
  itemsTotal: number
  serviceFee: number
  deliveryFee: number
  total: number
  scheduledDate: Date
  scheduledTime: string
  user: { name: string }
}

/** A bill before a quote: the fees the customer saw when ordering, or the last quote. */
export interface PreviousBill {
  serviceFee: number
  deliveryFee: number
  total: number
}

const GOODS: Partial<Record<ServiceId, Text>> = {
  bazar: { bn: 'বাজার', en: 'Bazar' },
  medicine: { bn: 'ঔষুধ', en: 'Medicines' },
  shifting: { bn: 'গাড়ী ভাড়া', en: 'Vehicle' },
}
/** The service fee in a breakdown: bazar's shopping fee, shifting's labour and floors. */
const SERVICE_FEE: Partial<Record<ServiceId, Text>> = { shifting: { bn: 'লেবার ও ফ্লোর', en: 'labour and floors' } }
const FEE_LABELS: Record<'serviceFee' | 'deliveryFee', Text> = {
  serviceFee: { bn: 'বাজার ক্রয় বাবদ মজুরী', en: 'Shopping fee' },
  deliveryFee: { bn: 'ডেলিভারী খরচ', en: 'Delivery charge' },
}

/** Sentences joined with the language's full stop; a sentence that already ends in one keeps it. */
const sentences = (parts: (string | null | undefined)[], stop: string) =>
  parts
    .map(part => part?.trim())
    .filter(Boolean)
    .map(part => (/[।.!?]$/.test(part!) ? part : `${part}${stop}`))
    .join(' ')

/**
 * "বাজার 610 + মজুরী 150 + ডেলিভারী 120 = মোট 880 টাকা", or for shifting "গাড়ী ভাড়া 1500 + লেবার ও
 * ফ্লোর 220 = মোট 1720 টাকা" (a fee of 0 is left out).
 */
export function billBreakdown(order: Pick<OrderRef, 'service' | 'itemsTotal' | 'serviceFee' | 'deliveryFee' | 'total'>): Text {
  const goods = GOODS[order.service] ?? { bn: 'পণ্য', en: 'Items' }
  const fee = SERVICE_FEE[order.service] ?? { bn: 'মজুরী', en: 'shopping fee' }
  const bn = [`${goods.bn} ${order.itemsTotal}`, order.serviceFee ? `${fee.bn} ${order.serviceFee}` : null, order.deliveryFee ? `ডেলিভারী ${order.deliveryFee}` : null]
  const en = [`${goods.en} Tk ${order.itemsTotal}`, order.serviceFee ? `${fee.en} Tk ${order.serviceFee}` : null, order.deliveryFee ? `delivery Tk ${order.deliveryFee}` : null]
  return {
    bn: `${bn.filter(Boolean).join(' + ')} = মোট ${order.total} টাকা`,
    en: `${en.filter(Boolean).join(' + ')} = Tk ${order.total}`,
  }
}

/** The fees staff changed in this quote: "ডেলিভারী খরচ 80 → 120 টাকা". */
export function feeChanges(previous: PreviousBill, order: Pick<OrderRef, 'serviceFee' | 'deliveryFee'>): Text[] {
  return (['serviceFee', 'deliveryFee'] as const)
    .filter(field => previous[field] !== order[field])
    .map(field => ({
      bn: `${FEE_LABELS[field].bn} ${previous[field]} → ${order[field]} টাকা`,
      en: `${FEE_LABELS[field].en} Tk ${previous[field]} → Tk ${order[field]}`,
    }))
}

const STATUS_MESSAGES: Partial<Record<OrderStatus, Text>> = {
  BOOKED: { bn: 'আপনার অর্ডার বুক করা হয়েছে।', en: 'Your order has been booked.' },
  IN_PROGRESS: { bn: 'আপনার অর্ডারের কাজ চলছে।', en: 'Your order is on its way.' },
  COMPLETED: { bn: 'অর্ডার সম্পন্ন হয়েছে। ধন্যবাদ!', en: 'Your order is complete. Thank you!' },
  CANCELLED: { bn: 'আপনার অর্ডার বাতিল করা হয়েছে।', en: 'Your order has been cancelled.' },
}

const withNote = (text: Text, note: string | null): Text => (note ? { bn: `${text.bn} ${note}`, en: `${text.en} ${note}` } : text)

/** To admins: a customer placed an order. Bazar, medicine and shifting orders still need staff to price them. */
export function orderCreatedContent(order: OrderRef): NotificationContent {
  const code = orderCode(order.number)
  const service = SERVICE_LABELS[order.service]
  const amount: Text = isQuotedService(order.service) ? { bn: 'দাম দিতে হবে', en: 'needs pricing' } : { bn: `${order.total} টাকা`, en: `Tk ${order.total}` }
  return {
    type: 'ORDER_CREATED',
    title: { bn: `নতুন অর্ডার ${code}`, en: `New order ${code}` },
    body: { bn: `${service.bn} · ${order.user.name} · ${amount.bn}`, en: `${service.en} · ${order.user.name} · ${amount.en}` },
    data: { orderId: order.id, orderCode: code },
  }
}

/** To admins: the customer cancelled their own order (before booking, or instead of confirming a price). */
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

/** To admins: the customer accepted the staff's prices, so the order is booked (and can be bought and delivered). */
export function customerConfirmedContent(order: OrderRef, to: OrderStatus): NotificationContent {
  const code = orderCode(order.number)
  const delivery = `${order.scheduledDate.toISOString().slice(0, 10)}, ${order.scheduledTime}`
  return {
    type: 'ORDER_STATUS',
    title: { bn: `অর্ডার ${code} কনফার্ম`, en: `Order ${code} confirmed` },
    body: {
      bn: `${order.user.name} দাম কনফার্ম করেছেন · মোট ${order.total} টাকা · ডেলিভারি ${delivery}।`,
      en: `${order.user.name} confirmed the price · Tk ${order.total} · delivery ${delivery}.`,
    },
    data: { orderId: order.id, orderCode: code, status: to },
  }
}

/**
 * To the customer: staff priced their order (or sent a new price). The body has
 * the whole bill, the fees staff changed and the staff note, so the customer can decide from the
 * notification itself; they confirm or cancel on the order page.
 */
export function quotedContent(order: OrderRef, quote: { previous: PreviousBill; note: string | null; requote: boolean }): NotificationContent {
  const code = orderCode(order.number)
  const { previous, note, requote } = quote
  const breakdown = billBreakdown(order)
  const fees = feeChanges(previous, order)
  const totalChanged = requote && previous.total !== order.total
  return {
    type: 'ORDER_BILL',
    title: requote ? { bn: `অর্ডার ${code}: নতুন দাম`, en: `Order ${code}: new price` } : { bn: `অর্ডার ${code}: দাম জানানো হয়েছে`, en: `Order ${code}: price ready` },
    body: {
      bn: sentences(
        [totalChanged ? `মোট বিল ${previous.total} থেকে ${order.total} টাকা হয়েছে` : null, breakdown.bn, ...fees.map(fee => fee.bn), note, 'দেখে কনফার্ম বা বাতিল করুন'],
        '।',
      ),
      en: sentences(
        [totalChanged ? `Total changed from Tk ${previous.total} to Tk ${order.total}` : null, breakdown.en, ...fees.map(fee => fee.en), note, 'Please confirm or cancel'],
        '.',
      ),
    },
    data: { orderId: order.id, orderCode: code, status: 'QUOTED' },
  }
}

/** To every customer: staff announced one of আজকের অফার. */
export function offerContent(offer: { id: string; title: Text; body: Text | null }): NotificationContent {
  return {
    type: 'OFFER',
    title: { bn: `আজকের অফার: ${offer.title.bn}`, en: `Today's offer: ${offer.title.en}` },
    body: offer.body ?? { bn: 'আজকের অফার দেখুন।', en: "See today's offers." },
    data: { offerId: offer.id },
  }
}
