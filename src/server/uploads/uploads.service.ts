import { randomUUID } from 'node:crypto'

import { Injectable, Logger, StreamableFile } from '@nestjs/common'
import type { UploadDto } from '@/shared'

import { AppException } from '../common/app.exception'
import type { Upload } from '../generated/prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { detectFileType } from './file-signature'
import { StorageService } from './storage.service'

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024
/** Uploads never attached to an order are deleted after this long. */
const ORPHAN_TTL_MS = 24 * 60 * 60 * 1000

export const toUploadDto = (upload: Upload): UploadDto => ({
  id: upload.id,
  originalName: upload.originalName,
  mime: upload.mime,
  size: upload.size,
  createdAt: upload.createdAt.toISOString(),
})

const safeName = (name: string) =>
  name
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .slice(0, 120) || 'file'

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async savePrescription(ownerId: string, file: Express.Multer.File | undefined): Promise<UploadDto> {
    if (!file?.buffer?.length) throw AppException.badRequest('upload.type')
    if (file.size > MAX_UPLOAD_BYTES) throw AppException.badRequest('upload.size')
    const type = detectFileType(file.buffer)
    if (!type) throw AppException.badRequest('upload.type')

    const now = new Date()
    const key = `prescriptions/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${randomUUID()}.${type.ext}`
    await this.storage.save(key, file.buffer)
    const upload = await this.prisma.upload.create({
      data: { ownerId, originalName: safeName(Buffer.from(file.originalname, 'latin1').toString('utf8')), mime: type.mime, size: file.size, storageKey: key },
    })
    void this.removeOrphans(ownerId)
    return toUploadDto(upload)
  }

  /** Streams a file to its owner. */
  async openForCustomer(ownerId: string, id: string) {
    const upload = await this.prisma.upload.findFirst({ where: { id, ownerId } })
    return this.stream(upload)
  }

  /** Streams any file to an admin (prescriptions on the order page). */
  async openForAdmin(id: string) {
    return this.stream(await this.prisma.upload.findUnique({ where: { id } }))
  }

  private async stream(upload: Upload | null) {
    if (!upload) throw AppException.notFound()
    const stream = await this.storage.open(upload.storageKey)
    if (!stream) throw AppException.notFound()
    return new StreamableFile(stream, {
      type: upload.mime,
      length: upload.size,
      disposition: `inline; filename*=UTF-8''${encodeURIComponent(upload.originalName)}`,
    })
  }

  /** Deletes this customer's uploads that were never used in an order. */
  private async removeOrphans(ownerId: string) {
    try {
      const orphans = await this.prisma.upload.findMany({ where: { ownerId, orderId: null, createdAt: { lt: new Date(Date.now() - ORPHAN_TTL_MS) } } })
      for (const orphan of orphans) {
        await this.storage.remove(orphan.storageKey)
        await this.prisma.upload.delete({ where: { id: orphan.id } })
      }
    } catch (error) {
      this.logger.warn(`Could not clean up old uploads: ${String(error)}`)
    }
  }
}
