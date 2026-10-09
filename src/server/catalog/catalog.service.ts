import { Injectable } from '@nestjs/common'
import {
  type CatalogDto,
  DEFAULT_PRICING,
  type Pricing,
  type PricingInput,
  type SupportSettings,
  type SupportSettingsInput,
  type UpdateVehicleInput,
  type VehicleDto,
  type VehicleInput,
} from '@/shared'

import { AppException } from '../common/app.exception'
import type { Vehicle } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'

export const SUPPORT_KEYS = { phone: 'support.phone', whatsapp: 'support.whatsapp' } as const

/** Placeholder support line until an admin sets the real one in Catalog. */
export const DEFAULT_SUPPORT: SupportSettings = { phone: '+8801700000000', whatsapp: 'https://wa.me/8801700000000' }

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
  constructor(private readonly prisma: PrismaService) {}

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

  /** Customers see active vehicles only; the admin panel sees all of them. */
  async getCatalog(includeInactive = false): Promise<CatalogDto> {
    const [pricing, vehicles, support] = await Promise.all([
      this.getPricing(),
      this.prisma.vehicle.findMany({ where: includeInactive ? {} : { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] }),
      this.getSupport(),
    ])
    return { pricing, vehicles: vehicles.map(toVehicleDto), support }
  }

  async updatePricing(input: PricingInput): Promise<Pricing> {
    const { id: _, updatedAt: __, ...pricing } = await this.prisma.pricing.upsert({ where: { id: 1 }, create: { id: 1, ...input }, update: input })
    return pricing
  }

  async createVehicle(input: VehicleInput): Promise<VehicleDto> {
    const base = slugify(input.nameEn)
    const clashes = await this.prisma.vehicle.count({ where: { slug: { startsWith: base } } })
    const vehicle = await this.prisma.vehicle.create({ data: { ...input, slug: clashes ? `${base}-${clashes + 1}` : base } })
    return toVehicleDto(vehicle)
  }

  async updateVehicle(id: string, input: UpdateVehicleInput): Promise<VehicleDto> {
    const exists = await this.prisma.vehicle.findUnique({ where: { id }, select: { id: true } })
    if (!exists) throw AppException.notFound()
    return toVehicleDto(await this.prisma.vehicle.update({ where: { id }, data: input }))
  }

  async updateSupport(input: SupportSettingsInput): Promise<SupportSettings> {
    await this.prisma.$transaction([
      this.prisma.setting.upsert({ where: { key: SUPPORT_KEYS.phone }, create: { key: SUPPORT_KEYS.phone, value: input.phone }, update: { value: input.phone } }),
      this.prisma.setting.upsert({
        where: { key: SUPPORT_KEYS.whatsapp },
        create: { key: SUPPORT_KEYS.whatsapp, value: input.whatsapp },
        update: { value: input.whatsapp },
      }),
    ])
    return input
  }
}
