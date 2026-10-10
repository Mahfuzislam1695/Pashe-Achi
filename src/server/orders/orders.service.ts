import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  type AuditChange,
  BILL_EDITABLE,
  calcBazar,
  calcMedicine,
  calcParcel,
  calcShifting,
  canTransition,
  type CreateBazarOrderInput,
  type CreateMedicineOrderInput,
  type CreateParcelOrderInput,
  type CreateShiftingOrderInput,
  CUSTOMER_CANCELLABLE,
  type ListMyOrdersQuery,
  type ListOrdersQuery,
  type OrderDetail,
  type OrderStatus,
  type OrderSummary,
  orderCode,
  type Paginated,
  type ScheduleInput,
  type UpdateOrderItemsInput,
  type UpdateOrderStatusInput,
} from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { CatalogService } from '../catalog/catalog.service'
import { AppException } from '../common/app.exception'
import { DOMAIN_EVENTS, type OrderBillUpdatedEvent, type OrderCreatedEvent, type OrderStatusChangedEvent } from '../common/domain-events'
import { bdDayEnd, bdDayStart, pageArgs, toPage } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { orderInclude, type OrderWithRelations, summaryInclude, toOrderDetail, toOrderSummary } from './order.mapper'

const SUMMARY_MAX = 300
const clip = (text: string) => (text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text)
const blankToNull = (value: string | undefined) => value?.trim() || null
const scheduleData = (schedule: ScheduleInput) => ({ scheduledDate: new Date(`${schedule.date}T00:00:00.000Z`), scheduledTime: schedule.time })

/**
 * Places and manages orders. Every fee and total is computed here from the current Pricing row
 * (never trusted from the client) and stored on the order as a snapshot.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogService,
    private readonly events: EventEmitter2,
    private readonly audit: AuditService,
  ) {}

  // Customer: place orders

  async createBazar(userId: string, input: CreateBazarOrderInput, actor: AuditActor): Promise<OrderDetail> {
    const bill = calcBazar(await this.catalog.getPricing(), input.items.map(item => item.price))
    return this.place({
      user: { connect: { id: userId } },
      service: 'bazar',
      summary: clip(input.items.map(item => item.name).join(', ')),
      contactMobile: input.contactMobile,
      address: input.address,
      note: blankToNull(input.note),
      ...scheduleData(input.schedule),
      ...bill,
      items: {
        create: input.items.map((item, index) => ({
          position: index + 1,
          name: item.name,
          quantity: item.quantity,
          variety: blankToNull(item.variety),
          price: item.price ?? null,
        })),
      },
    }, actor)
  }

  async createShifting(userId: string, input: CreateShiftingOrderInput, actor: AuditActor): Promise<OrderDetail> {
    const [pricing, vehicle, user] = await Promise.all([
      this.catalog.getPricing(),
      this.prisma.vehicle.findFirst({ where: { id: input.vehicleId, isActive: true } }),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mobile: true } }),
    ])
    if (!vehicle) throw AppException.badRequest('vehicle.unavailable')

    const bill = calcShifting(pricing, { vehicleRate: vehicle.rate, ...input })
    return this.place({
      user: { connect: { id: userId } },
      service: 'shifting',
      summary: clip(`${input.loadingArea} → ${input.unloadingArea}`),
      contactMobile: user.mobile,
      note: blankToNull(input.note),
      ...scheduleData(input.schedule),
      ...bill,
      shifting: {
        create: {
          loadingArea: input.loadingArea,
          unloadingArea: input.unloadingArea,
          vehicle: { connect: { id: vehicle.id } },
          vehicleNameBn: vehicle.nameBn,
          vehicleNameEn: vehicle.nameEn,
          vehicleRate: vehicle.rate,
          labourers: input.labourers,
          wagePerLabourer: pricing.wagePerLabourer,
          loadingFloor: input.loadingFloor,
          loadingRatePerFloor: pricing.loadingRatePerFloor,
          unloadingFloor: input.unloadingFloor,
          unloadingRatePerFloor: pricing.unloadingRatePerFloor,
        },
      },
    }, actor)
  }

  async createMedicine(userId: string, input: CreateMedicineOrderInput, actor: AuditActor): Promise<OrderDetail> {
    const bill = calcMedicine(await this.catalog.getPricing(), input.items.map(item => item.price))
    const names = input.items.map(item => item.name).join(', ')
    return this.place(
      {
        user: { connect: { id: userId } },
        service: 'medicine',
        summary: clip(names || 'প্রেসক্রিপশন / Prescription'),
        contactMobile: input.contactMobile,
        address: input.address,
        note: blankToNull(input.note),
        ...scheduleData(input.schedule),
        ...bill,
        items: {
          create: input.items.map((item, index) => ({
            position: index + 1,
            name: item.name,
            quantity: item.quantity,
            company: item.company,
            category: item.category,
            price: item.price,
          })),
        },
      },
      actor,
      input.prescriptionUploadId ? { uploadId: input.prescriptionUploadId, ownerId: userId } : undefined,
    )
  }

  async createParcel(userId: string, input: CreateParcelOrderInput, actor: AuditActor): Promise<OrderDetail> {
    const [pricing, user] = await Promise.all([
      this.catalog.getPricing(),
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { mobile: true } }),
    ])
    return this.place({
      user: { connect: { id: userId } },
      service: 'parcel',
      summary: clip(`${input.product} · ${input.pickupAddress} → ${input.dropoffAddress}`),
      contactMobile: user.mobile,
      note: blankToNull(input.note),
      ...scheduleData(input.schedule),
      ...calcParcel(pricing),
      parcel: {
        create: {
          product: input.product,
          weight: blankToNull(input.weight),
          pickupAddress: input.pickupAddress,
          dropoffAddress: input.dropoffAddress,
          receiverMobile: input.receiverMobile,
        },
      },
    }, actor)
  }

  /** Writes the order, its first timeline entry, its history entry and (for medicine) claims the prescription upload, atomically. */
  private async place(data: Omit<Prisma.OrderCreateInput, 'events'>, actor: AuditActor, attach?: { uploadId: string; ownerId: string }): Promise<OrderDetail> {
    const order = await this.prisma.$transaction(async tx => {
      const created = await tx.order.create({ data: { ...data, events: { create: { to: 'PENDING', actor: 'CUSTOMER' } } } })
      if (attach) {
        const { count } = await tx.upload.updateMany({
          where: { id: attach.uploadId, ownerId: attach.ownerId, orderId: null },
          data: { orderId: created.id },
        })
        if (count !== 1) throw AppException.badRequest('upload.missing')
      }
      await this.audit.record({
        action: 'ORDER_CREATED',
        actor,
        entity: { type: 'ORDER', id: created.id, label: orderCode(created.number) },
        meta: { service: created.service, total: created.total },
      }, tx)
      return tx.order.findUniqueOrThrow({ where: { id: created.id }, include: orderInclude })
    })
    this.events.emit(DOMAIN_EVENTS.orderCreated, { order } satisfies OrderCreatedEvent)
    return toOrderDetail(order)
  }

  // Customer: history

  async listMine(userId: string, query: ListMyOrdersQuery): Promise<Paginated<OrderSummary>> {
    const rows = await this.prisma.order.findMany({
      where: { userId, ...(query.service ? { service: query.service } : {}) },
      include: summaryInclude,
      ...pageArgs(query.cursor, query.limit),
    })
    return toPage(rows, query.limit, row => toOrderSummary(row))
  }

  async getMine(userId: string, id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, include: orderInclude })
    if (!order) throw AppException.notFound()
    return toOrderDetail(order)
  }

  async cancelMine(userId: string, id: string, actor: AuditActor): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, select: { status: true } })
    if (!order) throw AppException.notFound()
    if (!CUSTOMER_CANCELLABLE.includes(order.status)) throw AppException.badRequest('order.not_cancellable')
    const updated = await this.changeStatus(id, order.status, 'CANCELLED', { actor, note: null })
    return toOrderDetail(updated)
  }

  // Admin

  async list(query: ListOrdersQuery): Promise<Paginated<OrderSummary>> {
    const rows = await this.prisma.order.findMany({ where: this.adminWhere(query), include: summaryInclude, ...pageArgs(query.cursor, query.limit) })
    return toPage(rows, query.limit, row => toOrderSummary(row, true))
  }

  async get(id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude })
    if (!order) throw AppException.notFound()
    return toOrderDetail(order, true)
  }

  async updateStatus(actor: AuditActor, id: string, input: UpdateOrderStatusInput): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { status: true } })
    if (!order) throw AppException.notFound()
    if (!canTransition(order.status, input.status)) throw AppException.badRequest('order.bad_transition')
    const updated = await this.changeStatus(id, order.status, input.status, { actor, note: blankToNull(input.note) })
    return toOrderDetail(updated, true)
  }

  /**
   * Corrects bazar/medicine line prices once the real cost is known, and recomputes the total.
   * The history entry lists each changed line's old and new price, and the admin's note.
   */
  async updateItems(actor: AuditActor, id: string, input: UpdateOrderItemsInput): Promise<OrderDetail> {
    const { order, previousTotal } = await this.prisma.$transaction(async tx => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: { orderBy: { position: 'asc' } } } })
      if (!current) throw AppException.notFound()
      if (current.service !== 'bazar' && current.service !== 'medicine') throw AppException.badRequest('validation')
      if (!BILL_EDITABLE.includes(current.status)) throw AppException.badRequest('order.bill_locked')

      const prices = new Map(current.items.map(item => [item.id, item.price]))
      for (const change of input.items) {
        if (!prices.has(change.id)) throw AppException.badRequest('validation')
        prices.set(change.id, change.price)
      }
      const changes: AuditChange[] = []
      for (const item of current.items) {
        const price = prices.get(item.id) ?? null
        if (price === item.price) continue
        changes.push({ field: 'item.price', label: item.name, from: item.price, to: price })
        await tx.orderItem.update({ where: { id: item.id }, data: { price } })
      }
      const itemsTotal = [...prices.values()].reduce<number>((sum, price) => sum + (price ?? 0), 0)
      const total = itemsTotal + current.serviceFee + current.deliveryFee
      await tx.order.update({ where: { id }, data: { itemsTotal, total } })
      if (changes.length) {
        if (total !== current.total) changes.push({ field: 'total', from: current.total, to: total })
        await this.audit.record({
          action: 'ORDER_BILL_UPDATED',
          actor,
          entity: { type: 'ORDER', id, label: orderCode(current.number) },
          changes,
          note: input.note,
        }, tx)
      }
      return { order: await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude }), previousTotal: current.total }
    })
    if (order.total !== previousTotal) this.events.emit(DOMAIN_EVENTS.orderBillUpdated, { order, previousTotal } satisfies OrderBillUpdatedEvent)
    return toOrderDetail(order, true)
  }

  /**
   * Moves an order between statuses and records it in the timeline and the history log. The update
   * only applies if the status is still `from`, so two people acting at once can't both succeed.
   */
  private async changeStatus(id: string, from: OrderStatus, to: OrderStatus, by: { actor: AuditActor; note: string | null }): Promise<OrderWithRelations> {
    const order = await this.prisma.$transaction(async tx => {
      const { count } = await tx.order.updateMany({ where: { id, status: from }, data: { status: to } })
      if (count !== 1) throw AppException.conflict('order.bad_transition')
      const adminId = by.actor.type === 'ADMIN' ? by.actor.id : null
      await tx.orderStatusEvent.create({ data: { orderId: id, from, to, note: by.note, actor: by.actor.type, adminId } })
      const updated = await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude })
      await this.audit.record({
        action: 'ORDER_STATUS_CHANGED',
        actor: by.actor,
        entity: { type: 'ORDER', id, label: orderCode(updated.number) },
        changes: [{ field: 'status', from, to }],
        note: by.note,
      }, tx)
      return updated
    })
    this.events.emit(DOMAIN_EVENTS.orderStatusChanged, { order, from, to, note: by.note, by: by.actor.type } satisfies OrderStatusChangedEvent)
    return order
  }

  private adminWhere(query: ListOrdersQuery): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      ...(query.service ? { service: query.service } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { userId: query.customerId } : {}),
    }
    if (query.from || query.to) {
      where.createdAt = { ...(query.from ? { gte: bdDayStart(query.from) } : {}), ...(query.to ? { lt: bdDayEnd(query.to) } : {}) }
    }
    if (query.q) {
      const code = /^(?:pa-?)?(\d{1,9})$/i.exec(query.q)
      where.OR = [
        ...(code ? [{ number: Number(code[1]) }] : []),
        { summary: { contains: query.q, mode: 'insensitive' } },
        { contactMobile: { contains: query.q } },
        { user: { name: { contains: query.q, mode: 'insensitive' } } },
        { user: { mobile: { contains: query.q } } },
      ]
    }
    return where
  }
}
