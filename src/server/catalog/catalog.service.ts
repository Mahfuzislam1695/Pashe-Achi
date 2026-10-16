import { Injectable } from '@nestjs/common'
import {
  type CatalogDto,
  DEFAULT_DELIVERY_HOURS,
  DEFAULT_PRICING,
  type DeliveryHours,
  type DeliveryHoursInput,
  formatDeliveryWindows,
  parseDeliveryWindows,
  type Pricing,
  type PricingInput,
  SERVICE_IDS,
  type ServiceId,
  type SupportSettings,
  type SupportSettingsInput,
  type UpdateVehicleInput,
  type VehicleDto,
  type VehicleInput,
} from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { AppException } from '../common/app.exception'
import type { Vehicle } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const SUPPORT_KEYS = { phone: 'support.phone', whatsapp: 'support.whatsapp' } as const

/** One Setting row per service, e.g. delivery.bazar = "08:00-10:00,18:00-21:00" (empty: any time). */
export const DELIVERY_HOURS_KEYS = Object.fromEntries(SERVICE_IDS.map(service => [service, `delivery.${service}`])) as Record<ServiceId, string>

/** The windows as the history log shows them: { bazarHours: "08:00-10:00,18:00-21:00", … }. */
const hoursForAudit = (hours: DeliveryHours): Record<string, string> => Object.fromEntries(SERVICE_IDS.map(service => [`${service}Hours`, formatDeliveryWindows(hours[service])]))

/** Placeholder support line until an admin sets the real one in Catalog. */
export const DEFAULT_SUPPORT: SupportSettings = { phone: '+8801700000000', whatsapp: 'https://wa.me/8801700000000' }

export const PRICING_FIELDS = [
  'bazarShoppingFee',
  'bazarDeliveryFee',
  'medicineDeliveryFee',
  'parcelDeliveryFee',
  'wagePerLabourer',
  'loadingRatePerFloor',
  'unloadingRatePerFloor',
] as const satisfies readonly (keyof Pricing)[]

export const VEHICLE_FIELDS = ['nameBn', 'nameEn', 'rate', 'isActive', 'sortOrder'] as const satisfies readonly (keyof Vehicle)[]

const toVehicleDto = (vehicle: Vehicle): VehicleDto => ({
  id: vehicle.id,
  slug: vehicle.slug,
  name: { bn: vehicle.nameBn, en: vehicle.nameEn },
  rate: vehicle.rate,
  isActive: vehicle.isActive,
  sortOrder: vehicle.sortOrder,
})

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'vehicle'

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /** The current fees. Falls back to the sketch defaults if the database was never seeded. */
  async getPricing(): Promise<Pricing> {
    const row = await this.prisma.pricing.findUnique({ where: { id: 1 } })
    if (!row) return DEFAULT_PRICING
    const { id: _, updatedAt: __, ...pricing } = row
    return pricing
  }

  async getSupport(): Promise<SupportSettings> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.values(SUPPORT_KEYS) } } })
    const value = (key: string) => rows.find(row => row.key === key)?.value
    return { phone: value(SUPPORT_KEYS.phone) ?? DEFAULT_SUPPORT.phone, whatsapp: value(SUPPORT_KEYS.whatsapp) ?? DEFAULT_SUPPORT.whatsapp }
  }

  /** The ডেলিভারি টাইম windows per service. A service with no row yet keeps its default. */
  async getDeliveryHours(): Promise<DeliveryHours> {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: Object.values(DELIVERY_HOURS_KEYS) } } })
    return Object.fromEntries(
      SERVICE_IDS.map(service => {
        const row = rows.find(setting => setting.key === DELIVERY_HOURS_KEYS[service])
        return [service, row ? parseDeliveryWindows(row.value) : DEFAULT_DELIVERY_HOURS[service]]
      }),
    ) as DeliveryHours
  }

  /** Customers see active vehicles only; the admin panel sees all of them. */
  async getCatalog(includeInactive = false): Promise<CatalogDto> {
    const [pricing, vehicles, support, deliveryHours] = await Promise.all([
      this.getPricing(),
      this.prisma.vehicle.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.getSupport(),
      this.getDeliveryHours(),
    ])
    return { pricing, vehicles: vehicles.map(toVehicleDto), support, deliveryHours }
  }

  async updatePricing(input: PricingInput, actor: AuditActor): Promise<Pricing> {
    return this.prisma.$transaction(async tx => {
      const before = await tx.pricing.findUnique({ where: { id: 1 } })
      const { id: _, updatedAt: __, ...pricing } = await tx.pricing.upsert({ where: { id: 1 }, create: { id: 1, ...input }, update: input })
      const changes = diffChanges(before, input, PRICING_FIELDS)
      if (changes.length) await this.audit.record({ action: 'PRICING_UPDATED', actor, entity: { type: 'PRICING' }, changes }, tx)
      return pricing
    })
  }

  async createVehicle(input: VehicleInput, actor: AuditActor): Promise<VehicleDto> {
    const base = slugify(input.nameEn)
    const vehicle = await this.prisma.$transaction(async tx => {
      const clashes = await tx.vehicle.count({ where: { slug: { startsWith: base } } })
      const created = await tx.vehicle.create({ data: { ...input, slug: clashes ? `${base}-${clashes + 1}` : base } })
      await this.audit.record({
        action: 'VEHICLE_CREATED',
        actor,
        entity: { type: 'VEHICLE', id: created.id, label: created.nameEn },
        changes: diffChanges(null, created, VEHICLE_FIELDS),
      }, tx)
      return created
    })
    return toVehicleDto(vehicle)
  }

  async updateVehicle(id: string, input: UpdateVehicleInput, actor: AuditActor): Promise<VehicleDto> {
    const vehicle = await this.prisma.$transaction(async tx => {
      const before = await tx.vehicle.findUnique({ where: { id } })
      if (!before) throw AppException.notFound()
      const updated = await tx.vehicle.update({ where: { id }, data: input })
      const changes = diffChanges(before, input, VEHICLE_FIELDS)
      if (changes.length) await this.audit.record({ action: 'VEHICLE_UPDATED', actor, entity: { type: 'VEHICLE', id, label: updated.nameEn }, changes }, tx)
      return updated
    })
    return toVehicleDto(vehicle)
  }

  async updateSupport(input: SupportSettingsInput, actor: AuditActor): Promise<SupportSettings> {
    const before = await this.getSupport()
    await this.prisma.$transaction(async tx => {
      for (const field of ['phone', 'whatsapp'] as const) {
        const key = SUPPORT_KEYS[field]
        await tx.setting.upsert({ where: { key }, create: { key, value: input[field] }, update: { value: input[field] } })
      }
      const changes = diffChanges(before, input, ['phone', 'whatsapp'])
      if (changes.length) await this.audit.record({ action: 'SUPPORT_UPDATED', actor, entity: { type: 'SUPPORT' }, changes }, tx)
    })
    return input
  }

  async updateDeliveryHours(input: DeliveryHoursInput, actor: AuditActor): Promise<DeliveryHours> {
    const before = await this.getDeliveryHours()
    await this.prisma.$transaction(async tx => {
      for (const service of SERVICE_IDS) {
        const key = DELIVERY_HOURS_KEYS[service]
        const value = formatDeliveryWindows(input[service])
        await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
      }
      const after = hoursForAudit(input)
      const changes = diffChanges(hoursForAudit(before), after, Object.keys(after))
      if (changes.length) await this.audit.record({ action: 'DELIVERY_HOURS_UPDATED', actor, entity: { type: 'DELIVERY_HOURS' }, changes }, tx)
    })
    return this.getDeliveryHours()
  }
}
