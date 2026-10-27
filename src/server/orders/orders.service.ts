import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import {
  adminNextStatuses,
  type AuditChange,
  calcBazar,
  calcMedicine,
  calcParcel,
  calcShifting,
  type ConfirmOrderInput,
  type CreateBazarOrderInput,
  type CreateMedicineOrderInput,
  type CreateParcelOrderInput,
  type CreateShiftingOrderInput,
  CUSTOMER_CANCELLABLE,
  type GeoPoint,
  isQuotedService,
  type ListMyOrdersQuery,
  type ListOrdersQuery,
  type OrderDetail,
  type OrderStatsDto,
  type OrderStatsQuery,
  type OrderStatus,
  type OrderSummary,
  orderCode,
  type PagedList,
  type Paginated,
  QUOTE_EDITABLE,
  type QuoteOrderInput,
  type ScheduleInput,
  type ServiceId,
  type ShiftingQuoteInput,
  type UpdateOrderStatusInput,
} from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { CatalogService } from '../catalog/catalog.service'
import { AppException } from '../common/app.exception'
import { DOMAIN_EVENTS, type OrderCreatedEvent, type OrderQuotedEvent, type OrderStatusChangedEvent, type QuotedBill } from '../common/domain-events'
import { bdDayRange, offsetArgs, pageArgs, toPage, toPaged } from '../common/pagination'
import type { Prisma } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ORDER_SORT_ORDER, orderTotals, statusGroupArgs } from './order-stats'
import { orderInclude, type OrderWithRelations, summaryInclude, toOrderDetail, toOrderSummary } from './order.mapper'

const SUMMARY_MAX = 300
const clip = (text: string) => (text.length > SUMMARY_MAX ? `${text.slice(0, SUMMARY_MAX - 1)}…` : text)
const blankToNull = (value: string | undefined) => value?.trim() || null
const scheduleData = (schedule: ScheduleInput) => ({ scheduledDate: new Date(`${schedule.date}T00:00:00.000Z`), scheduledTime: schedule.time })
/** An address's optional map pin as its two columns, e.g. pinColumns('pickup', pin) → { pickupLat, pickupLng }. */
const pinColumns = <P extends string>(prefix: P, pin: GeoPoint | undefined) =>
  ({ [`${prefix}Lat`]: pin?.lat ?? null, [`${prefix}Lng`]: pin?.lng ?? null }) as Record<`${P}Lat` | `${P}Lng`, number | null>

/** What a quote reads: the lines (bazar, medicine) or the shifting details (the vehicle rent). */
const quotableInclude = { items: { orderBy: { position: 'asc' } }, shifting: true } satisfies Prisma.OrderInclude
type QuotableOrder = Prisma.OrderGetPayload<{ include: typeof quotableInclude }>

/**
 * Places and manages orders. Every fee and total is computed here from the current Pricing row
 * (never trusted from the client) and stored on the order as a snapshot. Customers send no prices:
 * bazar and medicine lines, and shifting's vehicle rent, are priced by staff in a quote, which the
 * customer confirms or cancels.
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
    const pricing = await this.catalog.getPricing()
    // No prices yet: the bill is the fees until staff send the quote.
    const bill = calcBazar(pricing, [])
    return this.place({
      user: { connect: { id: userId } },
      service: 'bazar',
      summary: clip(input.items.map(item => item.name).join(', ')),
      contactMobile: input.contactMobile,
      address: input.address,
      ...pinColumns('address', input.addressPin),
      note: blankToNull(input.note),
      ...scheduleData(input.schedule),
      ...bill,
      items: {
        create: input.items.map((item, index) => ({
          position: index + 1,
          name: item.name,
          quantity: item.quantity,
          variety: blankToNull(item.variety),
          price: null,
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

    // No vehicle rent yet: the bill is labour and floors until staff price the vehicle by distance.
    const bill = calcShifting(pricing, { ...input, vehicleRate: null })
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
          ...pinColumns('loading', input.loadingPin),
          ...pinColumns('unloading', input.unloadingPin),
          vehicle: { connect: { id: vehicle.id } },
          vehicleNameBn: vehicle.nameBn,
          vehicleNameEn: vehicle.nameEn,
          vehicleRate: null,
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
    const pricing = await this.catalog.getPricing()
    const bill = calcMedicine(pricing, [])
    const names = input.items.map(item => item.name).join(', ')
    return this.place(
      {
        user: { connect: { id: userId } },
        service: 'medicine',
        summary: clip(names || 'প্রেসক্রিপশন / Prescription'),
        contactMobile: input.contactMobile,
        address: input.address,
        ...pinColumns('address', input.addressPin),
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
            price: null,
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
          ...pinColumns('pickup', input.pickupPin),
          ...pinColumns('dropoff', input.dropoffPin),
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
        // Bazar, medicine and shifting have no total until staff price them.
        meta: { service: created.service, ...(isQuotedService(created.service) ? {} : { total: created.total }) },
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

  /**
   * The customer accepts the staff's prices: QUOTED → BOOKED, and the bill is final. `quoteVersion`
   * and `total` name the quote they saw; if staff sent a new one in the meantime (even with the same
   * total), nothing changes (order.quote_changed).
   */
  async confirmMine(userId: string, id: string, input: ConfirmOrderInput, actor: AuditActor): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({ where: { id, userId }, select: { status: true, total: true, quoteVersion: true } })
    if (!order) throw AppException.notFound()
    if (order.status !== 'QUOTED') throw AppException.badRequest('order.bad_transition')
    if (order.total !== input.total || order.quoteVersion !== input.quoteVersion) throw AppException.conflict('order.quote_changed')
    const updated = await this.changeStatus(id, 'QUOTED', 'BOOKED', { actor, note: null }, { total: input.total, quoteVersion: input.quoteVersion })
    return toOrderDetail(updated)
  }

  // Admin

  async list(query: ListOrdersQuery): Promise<PagedList<OrderSummary>> {
    const where = this.adminWhere(query)
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({ where, include: summaryInclude, orderBy: ORDER_SORT_ORDER[query.sort ?? 'newest'], ...offsetArgs(query.page, query.limit) }),
      this.prisma.order.count({ where }),
    ])
    return toPaged(rows, total, query, row => toOrderSummary(row, true))
  }

  /** Counts per status and confirmed revenue for the orders the list's filters match, whatever their status. */
  async stats(query: OrderStatsQuery): Promise<OrderStatsDto> {
    const groups = await this.prisma.order.groupBy(statusGroupArgs(this.adminWhere(query)))
    return orderTotals(groups)
  }

  async get(id: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, include: orderInclude })
    if (!order) throw AppException.notFound()
    return toOrderDetail(order, true)
  }

  async updateStatus(actor: AuditActor, id: string, input: UpdateOrderStatusInput): Promise<OrderDetail> {
    const order = await this.prisma.order.findUnique({ where: { id }, select: { status: true, service: true } })
    if (!order) throw AppException.notFound()
    if (!adminNextStatuses(order.service, order.status).includes(input.status)) throw AppException.badRequest('order.bad_transition')
    const updated = await this.changeStatus(id, order.status, input.status, { actor, note: blankToNull(input.note) })
    return toOrderDetail(updated, true)
  }

  /**
   * Staff price a bazar or medicine order: every line gets a price, unavailable lines can be
   * removed and new ones added (a prescription's medicines), and the shopping fee and delivery
   * charge can be changed from the Catalog's (medicine has no shopping fee). The order becomes
   * QUOTED and the customer is asked to confirm or cancel. Staff may send a new price while it is
   * QUOTED; once the customer confirms, the bill is locked (order.bill_locked). Customers' own
   * lines keep their name and quantity: only the price (and order) of an existing line changes.
   */
  async quote(actor: AuditActor, id: string, input: QuoteOrderInput): Promise<OrderDetail> {
    return this.sendQuote(actor, id, ['bazar', 'medicine'], input.note, async (tx, current) => {
      const serviceFee = input.serviceFee ?? current.serviceFee
      const deliveryFee = input.deliveryFee ?? current.deliveryFee
      if (current.service === 'medicine' && serviceFee !== 0) throw AppException.badRequest('quote.fees')

      const existing = new Map(current.items.map(item => [item.id, item]))
      const kept = new Set<string>()
      const changes: AuditChange[] = []
      for (const [index, line] of input.items.entries()) {
        if (line.id) {
          const before = existing.get(line.id)
          if (!before || kept.has(line.id)) throw AppException.badRequest('validation')
          kept.add(line.id)
          await tx.orderItem.update({ where: { id: line.id }, data: { position: index + 1, price: line.price } })
          if (before.price !== line.price) changes.push({ field: 'item.price', label: before.name, from: before.price, to: line.price })
        } else {
          await tx.orderItem.create({
            data: {
              orderId: id,
              position: index + 1,
              name: line.name,
              quantity: line.quantity,
              variety: blankToNull(line.variety),
              company: blankToNull(line.company),
              category: blankToNull(line.category),
              price: line.price,
            },
          })
          changes.push({ field: 'item.added', label: `${line.name} (${line.quantity})`, from: null, to: line.price })
        }
      }
      for (const item of current.items) {
        if (kept.has(item.id)) continue
        await tx.orderItem.delete({ where: { id: item.id } })
        changes.push({ field: 'item.removed', label: `${item.name} (${item.quantity})`, from: item.price, to: null })
      }

      if (serviceFee !== current.serviceFee) changes.push({ field: 'serviceFee', from: current.serviceFee, to: serviceFee })
      if (deliveryFee !== current.deliveryFee) changes.push({ field: 'deliveryFee', from: current.deliveryFee, to: deliveryFee })
      return { itemsTotal: input.items.reduce((sum, line) => sum + line.price, 0), serviceFee, deliveryFee, changes }
    })
  }

  /**
   * Staff price a shifting order's vehicle by the distance between its loading and unloading areas
   * (the vehicle's Catalog rate is only where they start). Labour and floors keep the Catalog rates
   * the order was placed with. As with a bazar quote, the customer confirms or cancels, staff may
   * send a new price while it is QUOTED, and the bill is locked once the customer confirms.
   */
  async quoteShifting(actor: AuditActor, id: string, input: ShiftingQuoteInput): Promise<OrderDetail> {
    return this.sendQuote(actor, id, ['shifting'], input.note, async (tx, current) => {
      if (!current.shifting) throw AppException.badRequest('validation')
      const before = current.shifting.vehicleRate
      await tx.shiftingDetail.update({ where: { orderId: id }, data: { vehicleRate: input.vehicleRate } })
      return {
        itemsTotal: input.vehicleRate,
        serviceFee: current.serviceFee,
        deliveryFee: current.deliveryFee,
        changes: before === input.vehicleRate ? [] : [{ field: 'vehicleRate', from: before, to: input.vehicleRate }],
      }
    })
  }

  /**
   * Sends a quote for one of `services`. `price` writes that service's part (the lines, or the
   * vehicle rent) and returns the new bill and what changed in it; then the order becomes QUOTED with
   * a new quoteVersion, the timeline and the history log record it, and the customer is notified.
   */
  private async sendQuote(
    actor: AuditActor,
    id: string,
    services: readonly ServiceId[],
    rawNote: string | undefined,
    price: (tx: Prisma.TransactionClient, current: QuotableOrder) => Promise<Omit<QuotedBill, 'total'> & { changes: AuditChange[] }>,
  ): Promise<OrderDetail> {
    const { order, from, previous } = await this.prisma.$transaction(async tx => {
      // Hold the row until commit: a confirm arriving now waits, then sees the new version and fails.
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${id} FOR UPDATE`
      const current = await tx.order.findUnique({ where: { id }, include: quotableInclude })
      if (!current) throw AppException.notFound()
      if (!services.includes(current.service)) throw AppException.badRequest('validation')
      if (!QUOTE_EDITABLE.includes(current.status)) throw AppException.badRequest('order.bill_locked')

      const { changes, ...bill } = await price(tx, current)
      const total = bill.itemsTotal + bill.serviceFee + bill.deliveryFee
      if (total !== current.total) changes.push({ field: 'total', from: current.total, to: total })
      await tx.order.update({ where: { id }, data: { ...bill, total, status: 'QUOTED', quoteVersion: { increment: 1 } } })

      const note = blankToNull(rawNote)
      const entity = { type: 'ORDER' as const, id, label: orderCode(current.number) }
      // Every quote is a step in the customer's timeline (a new price shows as "Price sent" again).
      await tx.orderStatusEvent.create({ data: { orderId: id, from: current.status, to: 'QUOTED', note, actor: actor.type, adminId: actor.type === 'ADMIN' ? actor.id : null } })
      if (changes.length) await this.audit.record({ action: 'ORDER_BILL_UPDATED', actor, entity, changes, note }, tx)
      if (current.status !== 'QUOTED') {
        await this.audit.record({ action: 'ORDER_STATUS_CHANGED', actor, entity, changes: [{ field: 'status', from: current.status, to: 'QUOTED' }], note }, tx)
      }
      return {
        order: await tx.order.findUniqueOrThrow({ where: { id }, include: orderInclude }),
        from: current.status,
        previous: { itemsTotal: current.itemsTotal, serviceFee: current.serviceFee, deliveryFee: current.deliveryFee, total: current.total },
      }
    })
    this.events.emit(DOMAIN_EVENTS.orderQuoted, { order, from, previous, note: blankToNull(rawNote) } satisfies OrderQuotedEvent)
    return toOrderDetail(order, true)
  }

  /**
   * Moves an order between statuses and records it in the timeline and the history log. The update
   * only applies if the status is still `from` (and, for a confirm, the quote is still the one the
   * customer saw), so two people acting at once can't both succeed.
   */
  private async changeStatus(
    id: string,
    from: OrderStatus,
    to: OrderStatus,
    by: { actor: AuditActor; note: string | null },
    expect?: { total: number; quoteVersion: number },
  ): Promise<OrderWithRelations> {
    const order = await this.prisma.$transaction(async tx => {
      const { count } = await tx.order.updateMany({ where: { id, status: from, ...expect }, data: { status: to } })
      if (count !== 1) {
        const now = expect ? await tx.order.findUnique({ where: { id }, select: { status: true } }) : null
        throw AppException.conflict(now?.status === from ? 'order.quote_changed' : 'order.bad_transition')
      }
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

  private adminWhere(query: OrderStatsQuery & { status?: OrderStatus }): Prisma.OrderWhereInput {
    const where: Prisma.OrderWhereInput = {
      ...(query.service ? { service: query.service } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.customerId ? { userId: query.customerId } : {}),
    }
    if (query.dateBy === 'scheduled') {
      // A @db.Date column: compare calendar days, not instants.
      if (query.from || query.to) {
        where.scheduledDate = { ...(query.from ? { gte: new Date(query.from) } : {}), ...(query.to ? { lte: new Date(query.to) } : {}) }
      }
    } else {
      const createdAt = bdDayRange(query.from, query.to)
      if (createdAt) where.createdAt = createdAt
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
