import { randomUUID } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Readable } from 'node:stream'

import { Injectable, Logger, StreamableFile } from '@nestjs/common'
import { type ApkInfoDto, type ApkUploadInput, APK_DOWNLOAD_PATH, MAX_APK_BYTES } from '@/shared'

import type { AuditActor } from '../audit/actor'
import { AuditService } from '../audit/audit.service'
import { AppException } from '../common/app.exception'
import { PrismaService } from '../prisma/prisma.service'
import { PROJECT_ROOT } from '../project-root'
import { isApk } from '../uploads/file-signature'
import { StorageService } from '../uploads/storage.service'

/** The Setting row that names the uploaded APK (JSON StoredApk). */
const APK_SETTING = 'app.apk'

/** The APK that ships with the site (mobile/README.md, "The APK on the website"), used until one is uploaded. */
const BUNDLED_APK = resolve(PROJECT_ROOT, 'public/downloads/kingfisher.apk')

interface StoredApk {
  key: string
  size: number
  version: string | null
  uploadedAt: string
  uploadedBy: string
}

const APK_ENTITY = { type: 'SYSTEM', id: 'apk', label: 'kingfisher.apk' } as const

/**
 * The Kingfisher app's APK on /app-download. Staff upload a new build on the System page; it is stored
 * like the other uploads (a new key each time, as storage never overwrites) and named by a Setting row,
 * so it goes live at once, without a redeploy. Without an upload, the bundled file is served.
 */
@Injectable()
export class ApkService {
  private readonly logger = new Logger(ApkService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async current(): Promise<ApkInfoDto | null> {
    const stored = await this.stored()
    if (stored) {
      return { source: 'uploaded', version: stored.version, size: stored.size, updatedAt: stored.uploadedAt, uploadedBy: stored.uploadedBy, url: APK_DOWNLOAD_PATH }
    }
    const bundled = await this.bundled()
    return bundled && { source: 'bundled', version: null, size: bundled.size, updatedAt: bundled.mtime.toISOString(), uploadedBy: null, url: APK_DOWNLOAD_PATH }
  }

  /** The live APK, for anyone. */
  async open(): Promise<StreamableFile> {
    let stream: Readable | null = null
    let size: number | undefined
    const stored = await this.stored()
    if (stored) {
      stream = await this.storage.open(stored.key)
      size = stored.size
      if (!stream) this.logger.error(`The uploaded APK ${stored.key} is missing; serving the bundled one`)
    }
    if (!stream) {
      const bundled = await this.bundled()
      if (!bundled) throw AppException.notFound()
      stream = createReadStream(BUNDLED_APK)
      size = bundled.size
    }
    return new StreamableFile(stream, { type: 'application/vnd.android.package-archive', length: size, disposition: 'attachment; filename="kingfisher.apk"' })
  }

  async upload(file: Express.Multer.File | undefined, input: ApkUploadInput, actor: AuditActor): Promise<ApkInfoDto> {
    if (!file?.buffer?.length) throw AppException.badRequest('apk.required')
    if (file.size > MAX_APK_BYTES) throw AppException.badRequest('apk.too_large')
    if (!isApk(file.buffer)) throw AppException.badRequest('apk.invalid')

    const before = await this.stored()
    const now = new Date()
    const version = input.version?.trim() || null
    const stored: StoredApk = { key: `app/kingfisher-${now.getTime()}-${randomUUID().slice(0, 8)}.apk`, size: file.size, version, uploadedAt: now.toISOString(), uploadedBy: actor.name }
    await this.storage.save(stored.key, file.buffer)
    try {
      await this.prisma.$transaction(async tx => {
        const value = JSON.stringify(stored)
        await tx.setting.upsert({ where: { key: APK_SETTING }, create: { key: APK_SETTING, value }, update: { value } })
        await this.audit.record({
          action: 'APK_UPLOADED',
          actor,
          entity: APK_ENTITY,
          changes: before?.version !== version ? [{ field: 'version', from: before?.version ?? null, to: version }] : [],
          meta: { size: stored.size, version },
        }, tx)
      })
    } catch (error) {
      await this.removeFile(stored.key)
      throw error
    }
    if (before) await this.removeFile(before.key)
    return (await this.current())!
  }

  /** Back to the bundled APK. */
  async remove(actor: AuditActor): Promise<ApkInfoDto | null> {
    const before = await this.stored()
    if (before) {
      await this.prisma.$transaction(async tx => {
        await tx.setting.delete({ where: { key: APK_SETTING } })
        await this.audit.record({ action: 'APK_REMOVED', actor, entity: APK_ENTITY, meta: { size: before.size, version: before.version } }, tx)
      })
      await this.removeFile(before.key)
    }
    return this.current()
  }

  private async stored(): Promise<StoredApk | null> {
    const row = await this.prisma.setting.findUnique({ where: { key: APK_SETTING } })
    if (!row) return null
    try {
      const value = JSON.parse(row.value) as StoredApk
      return typeof value.key === 'string' && typeof value.size === 'number' ? value : null
    } catch {
      return null
    }
  }

  private async bundled() {
    try {
      const info = await stat(BUNDLED_APK)
      return info.isFile() ? info : null
    } catch {
      return null
    }
  }

  private async removeFile(key: string) {
    try {
      await this.storage.remove(key)
    } catch (error) {
      this.logger.warn(`Could not delete APK ${key}: ${String(error)}`)
    }
  }
}
