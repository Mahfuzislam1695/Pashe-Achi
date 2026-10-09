import { CUSTOMER_CANCELLABLE, type OrderDetail, type OrderSummary, orderCode } from '@/shared'

import type { Prisma } from '../generated/prisma/client'
import { toUploadDto } from '../uploads/uploads.service'

export const summaryInclude = {
  user: { select: { id: true, name: true, mobile: true } },
} satisfies Prisma.OrderInclude

export const orderInclude = {
  ...summaryInclude,
  items: { orderBy: { position: 'asc' } },
  shifting: true,
  parcel: true,
  uploads: { orderBy: { createdAt: 'asc' } },
  events: { orderBy: { createdAt: 'asc' }, include: { admin: { select: { name: true } } } },
} satisfies Prisma.OrderInclude

export type OrderWithUser = Prisma.OrderGetPayload<{ include: typeof summaryInclude }>
export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>

/** @db.Date columns come back as UTC midnight. */
const isoDate = (date: Date) => date.toISOString().slice(0, 10)

/** `withCustomer` adds the customer's name and mobile (admin responses only). */
export function toOrderSummary(order: OrderWithUser, withCustomer = false): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    code: orderCode(order.number),
    service: order.service,
    status: order.status,
    summary: order.summary,
    total: order.total,
    scheduledDate: isoDate(order.scheduledDate),
    scheduledTime: order.scheduledTime,
    createdAt: order.createdAt.toISOString(),
    ...(withCustomer ? { customer: { id: order.user.id, name: order.user.name, mobile: order.user.mobile } } : {}),
  }
}

export function toOrderDetail(order: OrderWithRelations, withCustomer = false): OrderDetail {
  const prescription = order.uploads[0]
  return {
    ...toOrderSummary(order, withCustomer),
    contactMobile: order.contactMobile,
    address: order.address,
    note: order.note,
    itemsTotal: order.itemsTotal,
    serviceFee: order.serviceFee,
    deliveryFee: order.deliveryFee,
    items: order.items.map(item => ({
      id: item.id,
      position: item.position,
      name: item.name,
      quantity: item.quantity,
      variety: item.variety,
      company: item.company,
      category: item.category,
      price: item.price,
    })),
    shifting: order.shifting
      ? {
          loadingArea: order.shifting.loadingArea,
          unloadingArea: order.shifting.unloadingArea,
          vehicleId: order.shifting.vehicleId,
          vehicleName: { bn: order.shifting.vehicleNameBn, en: order.shifting.vehicleNameEn },
          vehicleRate: order.shifting.vehicleRate,
          labourers: order.shifting.labourers,
          wagePerLabourer: order.shifting.wagePerLabourer,
          loadingFloor: order.shifting.loadingFloor,
          loadingRatePerFloor: order.shifting.loadingRatePerFloor,
          unloadingFloor: order.shifting.unloadingFloor,
          unloadingRatePerFloor: order.shifting.unloadingRatePerFloor,
        }
      : null,
    parcel: order.parcel
      ? {
          product: order.parcel.product,
          weight: order.parcel.weight,
          pickupAddress: order.parcel.pickupAddress,
          dropoffAddress: order.parcel.dropoffAddress,
          receiverMobile: order.parcel.receiverMobile,
        }
      : null,
    prescription: prescription ? toUploadDto(prescription) : null,
    events: order.events.map(event => ({
      id: event.id,
      from: event.from,
      to: event.to,
      note: event.note,
      actor: event.actor,
      adminName: event.admin?.name ?? null,
      createdAt: event.createdAt.toISOString(),
    })),
    canCancel: CUSTOMER_CANCELLABLE.includes(order.status),
  }
}
