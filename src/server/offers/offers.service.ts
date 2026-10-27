import { randomUUID } from 'node:crypto'

import { Injectable, Logger, StreamableFile } from '@nestjs/common'
import { type AdminOfferDto, API_PREFIX, isoDateInBd, type ListOffersQuery, OFFER_STATUSES, type OfferDto, type OfferInput, type OfferStatsDto, type OfferStatsQuery, type OfferStatus, type PagedList, type UpdateOfferInput } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { diffChanges } from '../audit/diff'
import { AppException } from '../common/app.exception'
import { offsetArgs, toPaged } from '../common/pagination'
import type { Offer, Prisma } from '../generated/prisma/client'
import { offerContent } from '../notifications/notification.content'
import { NotificationsService } from '../notifications/notifications.service'
import { PrismaService } from '../prisma/prisma.service'
import { detectFileType } from '../uploads/file-signature'
import { StorageService } from '../uploads/storage.service'
import { MAX_UPLOAD_BYTES } from '../uploads/uploads.service'

/** Pictures every browser shows (no PDF or HEIC). */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const FIELDS = ['titleBn', 'titleEn', 'bodyBn', 'bodyEn', 'service', 'startsOn', 'endsOn', 'isActive'] as const

/** @db.Date columns come back as UTC midnight. */
const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const toDay = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const blankToNull = (value: string | null | undefined) => value?.trim() || null

export function offerStatus(offer: Pick<Offer, 'isActive' | 'startsOn' | 'endsOn'>, today = isoDateInBd()): OfferStatus {
  if (!offer.isActive) return 'off'
  if (today < isoDay(offer.startsOn)) return 'upcoming'
  if (today > isoDay(offer.endsOn)) return 'ended'
  return 'running'
}

/** The offers with the given status on the given day (YYYY-MM-DD): the database side of offerStatus(). */
export function statusWhere(status: OfferStatus, today = isoDateInBd()): Prisma.OfferWhereInput {
  const day = toDay(today)
  switch (status) {
    case 'off':
      return { isActive: false }
    case 'upcoming':
      return { isActive: true, startsOn: { gt: day } }
    case 'ended':
      return { isActive: true, endsOn: { lt: day } }
    case 'running':
      return { isActive: true, startsOn: { lte: day }, endsOn: { gte: day } }
  }
}

const offerWhere = (query: OfferStatsQuery): Prisma.OfferWhereInput => ({
  ...(query.q ? { OR: [{ titleBn: { contains: query.q, mode: 'insensitive' } }, { titleEn: { contains: query.q, mode: 'insensitive' } }] } : {}),
  ...(query.service ? { service: query.service } : {}),
})

/** The picture's path on this origin, versioned so a replaced picture is never served from a cache. */
const imagePath = (offer: Offer, admin: boolean) =>
  offer.imageKey ? `/${API_PREFIX}/${admin ? 'admin/' : ''}offers/${offer.id}/image?v=${offer.imageUpdatedAt?.getTime() ?? 0}` : null

export const toOfferDto = (offer: Offer): OfferDto => ({
  id: offer.id,
  title: { bn: offer.titleBn, en: offer.titleEn || offer.titleBn },
  body: offer.bodyBn || offer.bodyEn ? { bn: offer.bodyBn || offer.bodyEn || '', en: offer.bodyEn || offer.bodyBn || '' } : null,
  service: offer.service,
  imageUrl: imagePath(offer, false),
  startsOn: isoDay(offer.startsOn),
  endsOn: isoDay(offer.endsOn),
})

export const toAdminOfferDto = (offer: Offer, today = isoDateInBd()): AdminOfferDto => ({
  ...toOfferDto(offer),
  imageUrl: imagePath(offer, true),
  titleBn: offer.titleBn,
  titleEn: offer.titleEn,
  bodyBn: offer.bodyBn,
  bodyEn: offer.bodyEn,
  isActive: offer.isActive,
  status: offerStatus(offer, today),
  createdAt: offer.createdAt.toISOString(),
  updatedAt: offer.updatedAt.toISOString(),
})

/** What a history entry compares: the stored values, dates as YYYY-MM-DD. */
const auditValues = (offer: Offer) => ({
  titleBn: offer.titleBn,
  titleEn: offer.titleEn,
  bodyBn: offer.bodyBn,
  bodyEn: offer.bodyEn,
  service: offer.service,
  startsOn: isoDay(offer.startsOn),
  endsOn: isoDay(offer.endsOn),
  isActive: offer.isActive,
})

/**
 * আজকের অফার: staff post offers with a picture; customers and the public landing page see the
 * ones running today (Bangladesh time). Every change writes a history entry; a notification to
 * all customers is sent only when staff ask for it.
 */
@Injectable()
export class OffersService {
  private readonly logger = new Logger(OffersService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  /** The offers customers see now, newest first. */
  async listRunning(): Promise<OfferDto[]> {
    const today = toDay(isoDateInBd())
    const rows = await this.prisma.offer.findMany({
      where: { isActive: true, startsOn: { lte: today }, endsOn: { gte: today } },
      orderBy: [{ startsOn: 'desc' }, { createdAt: 'desc' }],
    })
    return rows.map(toOfferDto)
  }

  /** The admin panel's offers in numbered pages, latest end date first (so running and upcoming offers lead). */
  async listAll(query: ListOffersQuery): Promise<PagedList<AdminOfferDto>> {
    const today = isoDateInBd()
    const where: Prisma.OfferWhereInput = { AND: [offerWhere(query), query.status ? statusWhere(query.status, today) : {}] }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.offer.findMany({ where, orderBy: [{ endsOn: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }], ...offsetArgs(query.page, query.limit) }),
      this.prisma.offer.count({ where }),
    ])
    return toPaged(rows, total, query, row => toAdminOfferDto(row, today))
  }

  /** How many offers the search matches, and how many of them have each status today. */
  async stats(query: OfferStatsQuery): Promise<OfferStatsDto> {
    const today = isoDateInBd()
    const where = offerWhere(query)
    const counts = await this.prisma.$transaction(OFFER_STATUSES.map(status => this.prisma.offer.count({ where: { AND: [where, statusWhere(status, today)] } })))
    const byStatus = Object.fromEntries(OFFER_STATUSES.map((status, index) => [status, counts[index] ?? 0])) as Record<OfferStatus, number>
    return { total: counts.reduce((sum, count) => sum + count, 0), byStatus }
  }

  async create(input: OfferInput, actor: AuditActor): Promise<AdminOfferDto> {
    const offer = await this.prisma.$transaction(async tx => {
      const created = await tx.offer.create({
        data: {
          titleBn: input.titleBn,
          titleEn: blankToNull(input.titleEn),
          bodyBn: blankToNull(input.bodyBn),
          bodyEn: blankToNull(input.bodyEn),
          service: input.service ?? null,
          startsOn: toDay(input.startsOn),
          endsOn: toDay(input.endsOn),
          isActive: input.isActive ?? true,
        },
      })
      await this.audit.record({ action: 'OFFER_CREATED', actor, entity: { type: 'OFFER', id: created.id, label: created.titleBn }, changes: diffChanges(null, auditValues(created), FIELDS) }, tx)
      return created
    })
    return toAdminOfferDto(offer)
  }

  async update(id: string, input: UpdateOfferInput, actor: AuditActor): Promise<AdminOfferDto> {
    const offer = await this.prisma.$transaction(async tx => {
      const before = await tx.offer.findUnique({ where: { id } })
      if (!before) throw AppException.notFound()
      const startsOn = input.startsOn ?? isoDay(before.startsOn)
      const endsOn = input.endsOn ?? isoDay(before.endsOn)
      if (endsOn < startsOn) throw AppException.badRequest('offer.dates')
      const updated = await tx.offer.update({
        where: { id },
        data: {
          ...(input.titleBn !== undefined ? { titleBn: input.titleBn } : {}),
          ...(input.titleEn !== undefined ? { titleEn: blankToNull(input.titleEn) } : {}),
          ...(input.bodyBn !== undefined ? { bodyBn: blankToNull(input.bodyBn) } : {}),
          ...(input.bodyEn !== undefined ? { bodyEn: blankToNull(input.bodyEn) } : {}),
          ...(input.service !== undefined ? { service: input.service } : {}),
          ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
          startsOn: toDay(startsOn),
          endsOn: toDay(endsOn),
        },
      })
      const changes = diffChanges(auditValues(before), auditValues(updated), FIELDS)
      if (changes.length) await this.audit.record({ action: 'OFFER_UPDATED', actor, entity: { type: 'OFFER', id, label: updated.titleBn }, changes }, tx)
      return updated
    })
    return toAdminOfferDto(offer)
  }

  async remove(id: string, actor: AuditActor) {
    const offer = await this.prisma.$transaction(async tx => {
      const row = await tx.offer.findUnique({ where: { id } })
      if (!row) throw AppException.notFound()
      await tx.offer.delete({ where: { id } })
      await this.audit.record({ action: 'OFFER_DELETED', actor, entity: { type: 'OFFER', id, label: row.titleBn } }, tx)
      return row
    })
    if (offer.imageKey) await this.removeFile(offer.imageKey)
  }

  /** Adds or replaces the picture: a JPG, PNG or WebP of at most 5 MB, checked by its first bytes. */
  async setImage(id: string, file: Express.Multer.File | undefined, actor: AuditActor): Promise<AdminOfferDto> {
    if (!file?.buffer?.length || file.size > MAX_UPLOAD_BYTES) throw AppException.badRequest('offer.image')
    const type = detectFileType(file.buffer)
    if (!type || !IMAGE_TYPES.has(type.mime)) throw AppException.badRequest('offer.image')
    const before = await this.prisma.offer.findUnique({ where: { id } })
    if (!before) throw AppException.notFound()

    const now = new Date()
    const key = `offers/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${type.ext}`
    await this.storage.save(key, file.buffer)
    const offer = await this.prisma.$transaction(async tx => {
      const updated = await tx.offer.update({ where: { id }, data: { imageKey: key, imageMime: type.mime, imageSize: file.size, imageUpdatedAt: now } })
      await this.audit.record({
        action: 'OFFER_UPDATED',
        actor,
        entity: { type: 'OFFER', id, label: updated.titleBn },
        changes: [{ field: 'image', from: null, to: before.imageKey ? 'replaced' : 'added' }],
      }, tx)
      return updated
    })
    if (before.imageKey) await this.removeFile(before.imageKey)
    return toAdminOfferDto(offer)
  }

  async removeImage(id: string, actor: AuditActor): Promise<AdminOfferDto> {
    const before = await this.prisma.offer.findUnique({ where: { id } })
    if (!before) throw AppException.notFound()
    if (!before.imageKey) return toAdminOfferDto(before)
    const offer = await this.prisma.$transaction(async tx => {
      const updated = await tx.offer.update({ where: { id }, data: { imageKey: null, imageMime: null, imageSize: null, imageUpdatedAt: new Date() } })
      await this.audit.record({ action: 'OFFER_UPDATED', actor, entity: { type: 'OFFER', id, label: updated.titleBn }, changes: [{ field: 'image', from: null, to: 'removed' }] }, tx)
      return updated
    })
    await this.removeFile(before.imageKey)
    return toAdminOfferDto(offer)
  }

  /** A running offer's picture, for anyone (customers, the landing page). */
  async openPublicImage(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } })
    if (!offer || offerStatus(offer) !== 'running') throw AppException.notFound()
    return this.streamImage(offer)
  }

  /** Any offer's picture, for staff. */
  async openAdminImage(id: string) {
    const offer = await this.prisma.offer.findUnique({ where: { id } })
    if (!offer) throw AppException.notFound()
    return this.streamImage(offer)
  }

  /** Tells every active customer about the offer (bell + live toast). Returns how many got it. */
  async announce(id: string, actor: AuditActor): Promise<{ sent: number }> {
    const offer = await this.prisma.offer.findUnique({ where: { id } })
    if (!offer) throw AppException.notFound()
    const sent = await this.notifications.notifyUsers('all', offerContent(toOfferDto(offer)))
    await this.audit.record({ action: 'OFFER_ANNOUNCED', actor, entity: { type: 'OFFER', id, label: offer.titleBn }, meta: { sent } })
    return { sent }
  }

  private async streamImage(offer: Offer) {
    if (!offer.imageKey || !offer.imageMime) throw AppException.notFound()
    const stream = await this.storage.open(offer.imageKey)
    if (!stream) throw AppException.notFound()
    return new StreamableFile(stream, { type: offer.imageMime, length: offer.imageSize ?? undefined, disposition: 'inline' })
  }

  private async removeFile(key: string) {
    try {
      await this.storage.remove(key)
    } catch (error) {
      this.logger.warn(`Could not delete offer picture ${key}: ${String(error)}`)
    }
  }
}
