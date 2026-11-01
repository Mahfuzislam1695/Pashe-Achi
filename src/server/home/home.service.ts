import { randomUUID } from 'node:crypto'

import { Injectable, Logger, StreamableFile } from '@nestjs/common'
import {
  type AdminHomeBannerDto,
  type AdminHomeCategoryDto,
  type AdminHomeDto,
  type AdminHomeSectionDto,
  API_PREFIX,
  type AuditChange,
  DEFAULT_HOME_SECTIONS,
  type HomeBannerDto,
  type HomeBannerInput,
  type HomeBannerTarget,
  type HomeCategoryDto,
  type HomeCategoryInput,
  type HomeContentDto,
  HOME_SECTIONS,
  type HomeSectionId,
  type HomeSectionsInput,
  type HomeTone,
  photo,
  SERVICE_IDS,
  SERVICE_LABELS,
  type ServiceId,
  type UpdateHomeBannerInput,
  type UpdateHomeCategoryInput,
} from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { AppException } from '../common/app.exception'
import type { HomeBanner, HomeCategory } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { checkImage } from '../uploads/image-file'
import { StorageService } from '../uploads/storage.service'

type Kind = 'banners' | 'categories'
type Db = Pick<PrismaService, 'homeBanner' | 'homeCategory'>

/** A service tile's uploaded picture, in the Setting row `home.service.<id>`. */
interface StoredImage {
  key: string
  mime: string
  size: number
  updatedAt: number
}

const SECTIONS_SETTING = 'home.sections'
const serviceSetting = (service: ServiceId) => `home.service.${service}`

const BANNER_FIELDS = ['titleBn', 'titleEn', 'bodyBn', 'bodyEn', 'ctaBn', 'ctaEn', 'target', 'isActive'] as const
const CATEGORY_FIELDS = ['nameBn', 'nameEn', 'tone', 'addsItem', 'isActive'] as const
const ORDER = [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] as const

const blankToNull = (value: string | null | undefined) => value?.trim() || null
const both = (bn: string | null, en: string | null) => (bn || en ? { bn: bn || en || '', en: en || bn || '' } : null)

/** The picture's path on this origin: the upload (versioned, so a replaced one is never cached), or else the built-in one. */
const rowImage = (kind: Kind, row: HomeBanner | HomeCategory) =>
  row.imageKey ? `/${API_PREFIX}/home/${kind}/${row.id}/image?v=${row.imageUpdatedAt?.getTime() ?? 0}` : row.defaultImage

const toBanner = (row: HomeBanner): HomeBannerDto => ({
  id: row.id,
  title: { bn: row.titleBn, en: row.titleEn || row.titleBn },
  body: both(row.bodyBn, row.bodyEn),
  cta: both(row.ctaBn, row.ctaEn),
  target: row.target as HomeBannerTarget | null,
  imageUrl: rowImage('banners', row),
})

const toCategory = (row: HomeCategory): HomeCategoryDto => ({
  id: row.id,
  name: { bn: row.nameBn, en: row.nameEn || row.nameBn },
  tone: row.tone as HomeTone,
  addsItem: row.addsItem,
  imageUrl: rowImage('categories', row),
})

const toAdminBanner = (row: HomeBanner): AdminHomeBannerDto => ({
  ...toBanner(row),
  titleBn: row.titleBn,
  titleEn: row.titleEn,
  bodyBn: row.bodyBn,
  bodyEn: row.bodyEn,
  ctaBn: row.ctaBn,
  ctaEn: row.ctaEn,
  isActive: row.isActive,
  uploaded: !!row.imageKey,
})

const toAdminCategory = (row: HomeCategory): AdminHomeCategoryDto => ({
  ...toCategory(row),
  nameBn: row.nameBn,
  nameEn: row.nameEn,
  isActive: row.isActive,
  uploaded: !!row.imageKey,
})

const sectionWords = (section: AdminHomeSectionDto) => (section.headingEn ? `${section.headingBn} / ${section.headingEn}` : section.headingBn)

/**
 * The customer home page, managed by staff on /admin/home: banners, category tiles, the service tiles'
 * pictures, and each section's heading and visibility. The page reads it through the public GET /home;
 * every change writes a history entry. Pictures live next to the other uploads, under home/….
 */
@Injectable()
export class HomeService {
  private readonly logger = new Logger(HomeService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** What customers see: the rows that are on, in order. */
  async content(): Promise<HomeContentDto> {
    const [banners, categories, sections, images] = await Promise.all([
      this.prisma.homeBanner.findMany({ where: { isActive: true }, orderBy: [...ORDER] }),
      this.prisma.homeCategory.findMany({ where: { isActive: true }, orderBy: [...ORDER] }),
      this.sections(),
      this.serviceImages(),
    ])
    return {
      banners: banners.map(toBanner),
      categories: categories.map(toCategory),
      serviceImages: Object.fromEntries(SERVICE_IDS.map(service => [service, images[service].url])) as Record<ServiceId, string>,
      sections: Object.fromEntries(
        HOME_SECTIONS.map(id => [id, { heading: { bn: sections[id].headingBn, en: sections[id].headingEn || sections[id].headingBn }, visible: sections[id].visible }]),
      ) as HomeContentDto['sections'],
    }
  }

  /** Everything, for the admin panel. */
  async adminContent(): Promise<AdminHomeDto> {
    const [banners, categories, sections, serviceImages] = await Promise.all([
      this.prisma.homeBanner.findMany({ orderBy: [...ORDER] }),
      this.prisma.homeCategory.findMany({ orderBy: [...ORDER] }),
      this.sections(),
      this.serviceImages(),
    ])
    return { banners: banners.map(toAdminBanner), categories: categories.map(toAdminCategory), sections, serviceImages }
  }

  async createBanner(input: HomeBannerInput, actor: AuditActor): Promise<AdminHomeBannerDto> {
    const row = await this.prisma.$transaction(async tx => {
      const last = await tx.homeBanner.aggregate({ _max: { sortOrder: true } })
      const created = await tx.homeBanner.create({
        data: {
          titleBn: input.titleBn,
          titleEn: blankToNull(input.titleEn),
          bodyBn: blankToNull(input.bodyBn),
          bodyEn: blankToNull(input.bodyEn),
          ctaBn: blankToNull(input.ctaBn),
          ctaEn: blankToNull(input.ctaEn),
          target: input.target ?? null,
          isActive: input.isActive ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      })
      await this.audit.record({ action: 'HOME_CREATED', actor, entity: { type: 'HOME', id: created.id, label: created.titleBn }, changes: diffChanges(null, created, BANNER_FIELDS) }, tx)
      return created
    })
    return toAdminBanner(row)
  }

  async updateBanner(id: string, input: UpdateHomeBannerInput, actor: AuditActor): Promise<AdminHomeBannerDto> {
    const row = await this.prisma.$transaction(async tx => {
      const before = await tx.homeBanner.findUnique({ where: { id } })
      if (!before) throw AppException.notFound()
      const updated = await tx.homeBanner.update({
        where: { id },
        data: {
          ...(input.titleBn !== undefined ? { titleBn: input.titleBn } : {}),
          ...(input.titleEn !== undefined ? { titleEn: blankToNull(input.titleEn) } : {}),
          ...(input.bodyBn !== undefined ? { bodyBn: blankToNull(input.bodyBn) } : {}),
          ...(input.bodyEn !== undefined ? { bodyEn: blankToNull(input.bodyEn) } : {}),
          ...(input.ctaBn !== undefined ? { ctaBn: blankToNull(input.ctaBn) } : {}),
          ...(input.ctaEn !== undefined ? { ctaEn: blankToNull(input.ctaEn) } : {}),
          ...(input.target !== undefined ? { target: input.target } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
      const changes = diffChanges(before, updated, BANNER_FIELDS)
      if (changes.length) await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id, label: updated.titleBn }, changes }, tx)
      return updated
    })
    return toAdminBanner(row)
  }

  async createCategory(input: HomeCategoryInput, actor: AuditActor): Promise<AdminHomeCategoryDto> {
    const row = await this.prisma.$transaction(async tx => {
      const last = await tx.homeCategory.aggregate({ _max: { sortOrder: true } })
      const created = await tx.homeCategory.create({
        data: {
          nameBn: input.nameBn,
          nameEn: blankToNull(input.nameEn),
          tone: input.tone ?? 'blue',
          addsItem: input.addsItem ?? true,
          isActive: input.isActive ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      })
      await this.audit.record({ action: 'HOME_CREATED', actor, entity: { type: 'HOME', id: created.id, label: created.nameBn }, changes: diffChanges(null, created, CATEGORY_FIELDS) }, tx)
      return created
    })
    return toAdminCategory(row)
  }

  async updateCategory(id: string, input: UpdateHomeCategoryInput, actor: AuditActor): Promise<AdminHomeCategoryDto> {
    const row = await this.prisma.$transaction(async tx => {
      const before = await tx.homeCategory.findUnique({ where: { id } })
      if (!before) throw AppException.notFound()
      const updated = await tx.homeCategory.update({
        where: { id },
        data: {
          ...(input.nameBn !== undefined ? { nameBn: input.nameBn } : {}),
          ...(input.nameEn !== undefined ? { nameEn: blankToNull(input.nameEn) } : {}),
          ...(input.tone !== undefined ? { tone: input.tone } : {}),
          ...(input.addsItem !== undefined ? { addsItem: input.addsItem } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        },
      })
      const changes = diffChanges(before, updated, CATEGORY_FIELDS)
      if (changes.length) await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id, label: updated.nameBn }, changes }, tx)
      return updated
    })
    return toAdminCategory(row)
  }

  /** Deletes a banner or category and its uploaded picture. */
  async remove(kind: Kind, id: string, actor: AuditActor) {
    const imageKey = await this.prisma.$transaction(async tx => {
      const row = await findRow(tx, kind, id)
      if (kind === 'banners') await tx.homeBanner.delete({ where: { id } })
      else await tx.homeCategory.delete({ where: { id } })
      await this.audit.record({ action: 'HOME_DELETED', actor, entity: { type: 'HOME', id, label: rowLabel(row) } }, tx)
      return row.imageKey
    })
    if (imageKey) await this.removeFile(imageKey)
  }

  /** Puts the rows in the given order. `ids` must be every row, so a list someone else just changed is refused. */
  async reorder(kind: Kind, ids: string[], actor: AuditActor) {
    await this.prisma.$transaction(async tx => {
      const rows = await listRows(tx, kind)
      const known = new Set(rows.map(row => row.id))
      if (ids.length !== rows.length || new Set(ids).size !== ids.length || ids.some(id => !known.has(id))) throw AppException.badRequest('home.order')
      if (rows.every((row, index) => row.id === ids[index])) return
      const byId = new Map(rows.map(row => [row.id, row]))
      for (const [sortOrder, id] of ids.entries()) {
        if (kind === 'banners') await tx.homeBanner.update({ where: { id }, data: { sortOrder } })
        else await tx.homeCategory.update({ where: { id }, data: { sortOrder } })
      }
      await this.audit.record({
        action: 'HOME_UPDATED',
        actor,
        entity: { type: 'HOME', label: kind === 'banners' ? 'ব্যানার' : 'ক্যাটাগরি' },
        changes: [{ field: 'order', from: rows.map(rowLabel).join(', '), to: ids.map(id => rowLabel(byId.get(id)!)).join(', ') }],
      }, tx)
    })
    return this.adminContent()
  }

  /** Adds or replaces a banner's or category's picture. */
  async setImage(kind: Kind, id: string, upload: Express.Multer.File | undefined, actor: AuditActor) {
    const { file, type } = checkImage(upload, 'image.invalid')
    const before = await findRow(this.prisma, kind, id)
    const now = new Date()
    const key = imageKey(type.ext, now)
    await this.storage.save(key, file.buffer)
    try {
      await this.prisma.$transaction(async tx => {
        await updateRowImage(tx, kind, id, { imageKey: key, imageMime: type.mime, imageSize: file.size, imageUpdatedAt: now })
        await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id, label: rowLabel(before) }, changes: [{ field: 'image', from: null, to: before.imageKey ? 'replaced' : 'added' }] }, tx)
      })
    } catch (error) {
      await this.removeFile(key)
      throw error
    }
    if (before.imageKey) await this.removeFile(before.imageKey)
    return this.adminContent()
  }

  /** Removes the uploaded picture; the built-in one, if any, shows again. */
  async removeImage(kind: Kind, id: string, actor: AuditActor) {
    const before = await findRow(this.prisma, kind, id)
    if (before.imageKey) {
      await this.prisma.$transaction(async tx => {
        await updateRowImage(tx, kind, id, { imageKey: null, imageMime: null, imageSize: null, imageUpdatedAt: new Date() })
        await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id, label: rowLabel(before) }, changes: [{ field: 'image', from: null, to: 'removed' }] }, tx)
      })
      await this.removeFile(before.imageKey)
    }
    return this.adminContent()
  }

  /** A banner's or category's uploaded picture, for anyone. */
  async openImage(kind: Kind, id: string) {
    const row = await findRow(this.prisma, kind, id)
    if (!row.imageKey || !row.imageMime) throw AppException.notFound()
    return this.stream(row.imageKey, row.imageMime, row.imageSize)
  }

  async setServiceImage(service: ServiceId, upload: Express.Multer.File | undefined, actor: AuditActor) {
    const { file, type } = checkImage(upload, 'image.invalid')
    const before = await this.storedServiceImage(service)
    const now = new Date()
    const stored: StoredImage = { key: imageKey(type.ext, now), mime: type.mime, size: file.size, updatedAt: now.getTime() }
    await this.storage.save(stored.key, file.buffer)
    try {
      await this.prisma.$transaction(async tx => {
        const value = JSON.stringify(stored)
        const key = serviceSetting(service)
        await tx.setting.upsert({ where: { key }, create: { key, value }, update: { value } })
        await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id: key, label: SERVICE_LABELS[service].bn }, changes: [{ field: 'image', from: null, to: before ? 'replaced' : 'added' }] }, tx)
      })
    } catch (error) {
      await this.removeFile(stored.key)
      throw error
    }
    if (before) await this.removeFile(before.key)
    return this.adminContent()
  }

  /** Back to the service's usual photo. */
  async removeServiceImage(service: ServiceId, actor: AuditActor) {
    const before = await this.storedServiceImage(service)
    if (before) {
      await this.prisma.$transaction(async tx => {
        const key = serviceSetting(service)
        await tx.setting.delete({ where: { key } })
        await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id: key, label: SERVICE_LABELS[service].bn }, changes: [{ field: 'image', from: null, to: 'removed' }] }, tx)
      })
      await this.removeFile(before.key)
    }
    return this.adminContent()
  }

  async openServiceImage(service: ServiceId) {
    const stored = await this.storedServiceImage(service)
    if (!stored) throw AppException.notFound()
    return this.stream(stored.key, stored.mime, stored.size)
  }

  async saveSections(input: HomeSectionsInput, actor: AuditActor) {
    await this.prisma.$transaction(async tx => {
      const row = await tx.setting.findUnique({ where: { key: SECTIONS_SETTING } })
      const before = parseSections(row?.value)
      const after = Object.fromEntries(
        HOME_SECTIONS.map(id => [id, { headingBn: input[id].headingBn, headingEn: blankToNull(input[id].headingEn), visible: input[id].visible }]),
      ) as Record<HomeSectionId, AdminHomeSectionDto>
      const changes: AuditChange[] = HOME_SECTIONS.flatMap(id => [
        ...(sectionWords(before[id]) !== sectionWords(after[id]) ? [{ field: id, from: sectionWords(before[id]), to: sectionWords(after[id]) }] : []),
        ...(before[id].visible !== after[id].visible ? [{ field: id, from: before[id].visible, to: after[id].visible }] : []),
      ])
      if (!changes.length) return
      const value = JSON.stringify(after)
      await tx.setting.upsert({ where: { key: SECTIONS_SETTING }, create: { key: SECTIONS_SETTING, value }, update: { value } })
      await this.audit.record({ action: 'HOME_UPDATED', actor, entity: { type: 'HOME', id: SECTIONS_SETTING, label: 'হোম পেজের অংশ' }, changes }, tx)
    })
    return this.adminContent()
  }

  private async sections() {
    const row = await this.prisma.setting.findUnique({ where: { key: SECTIONS_SETTING } })
    return parseSections(row?.value)
  }

  /** Each service tile's picture: the upload, or else the service's usual photo. */
  private async serviceImages() {
    const rows = await this.prisma.setting.findMany({ where: { key: { in: SERVICE_IDS.map(serviceSetting) } } })
    const stored = new Map(rows.map(row => [row.key, parseStored(row.value)]))
    return Object.fromEntries(
      SERVICE_IDS.map(service => {
        const image = stored.get(serviceSetting(service))
        return [service, image ? { url: `/${API_PREFIX}/home/services/${service}/image?v=${image.updatedAt}`, uploaded: true } : { url: photo(service).src, uploaded: false }]
      }),
    ) as AdminHomeDto['serviceImages']
  }

  private async storedServiceImage(service: ServiceId) {
    const row = await this.prisma.setting.findUnique({ where: { key: serviceSetting(service) } })
    return row ? parseStored(row.value) : null
  }

  private async stream(key: string, mime: string, size: number | null) {
    const stream = await this.storage.open(key)
    if (!stream) throw AppException.notFound()
    return new StreamableFile(stream, { type: mime, length: size ?? undefined, disposition: 'inline' })
  }

  private async removeFile(key: string) {
    try {
      await this.storage.remove(key)
    } catch (error) {
      this.logger.warn(`Could not delete home page picture ${key}: ${String(error)}`)
    }
  }
}

const imageKey = (ext: string, now: Date) => `home/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${ext}`

const rowLabel = (row: HomeBanner | HomeCategory) => ('titleBn' in row ? row.titleBn : row.nameBn)

const listRows = (db: Db, kind: Kind): Promise<(HomeBanner | HomeCategory)[]> =>
  kind === 'banners' ? db.homeBanner.findMany({ orderBy: [...ORDER] }) : db.homeCategory.findMany({ orderBy: [...ORDER] })

async function findRow(db: Db, kind: Kind, id: string): Promise<HomeBanner | HomeCategory> {
  const row = kind === 'banners' ? await db.homeBanner.findUnique({ where: { id } }) : await db.homeCategory.findUnique({ where: { id } })
  if (!row) throw AppException.notFound()
  return row
}

const updateRowImage = (db: Db, kind: Kind, id: string, data: { imageKey: string | null; imageMime: string | null; imageSize: number | null; imageUpdatedAt: Date }) =>
  kind === 'banners' ? db.homeBanner.update({ where: { id }, data }) : db.homeCategory.update({ where: { id }, data })

/** The stored sections, or the default headings for whatever is missing or unreadable. */
function parseSections(value: string | undefined): Record<HomeSectionId, AdminHomeSectionDto> {
  let stored: Partial<Record<HomeSectionId, Partial<AdminHomeSectionDto>>> = {}
  try {
    stored = value ? JSON.parse(value) : {}
  } catch {
    // Unreadable: the defaults.
  }
  return Object.fromEntries(
    HOME_SECTIONS.map(id => [
      id,
      {
        headingBn: stored[id]?.headingBn ?? DEFAULT_HOME_SECTIONS[id].bn,
        headingEn: stored[id]?.headingBn ? (stored[id]?.headingEn ?? null) : DEFAULT_HOME_SECTIONS[id].en,
        visible: stored[id]?.visible ?? true,
      },
    ]),
  ) as Record<HomeSectionId, AdminHomeSectionDto>
}

function parseStored(value: string): StoredImage | null {
  try {
    const image = JSON.parse(value) as StoredImage
    return typeof image.key === 'string' && typeof image.mime === 'string' ? image : null
  } catch {
    return null
  }
}
