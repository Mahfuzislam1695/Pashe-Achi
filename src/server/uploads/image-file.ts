import type { MessageCode } from '@/shared'

import { AppException } from '../common/app.exception'
import { detectFileType } from './file-signature'
import { MAX_UPLOAD_BYTES } from './uploads.service'

/** Pictures every browser shows (no PDF or HEIC). */
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

/** An uploaded picture's type: a JPG, PNG or WebP of at most 5 MB, checked by its first bytes. Anything else reports `code`. */
export function checkImage(file: Express.Multer.File | undefined, code: MessageCode) {
  if (!file?.buffer?.length || file.size > MAX_UPLOAD_BYTES) throw AppException.badRequest(code)
  const type = detectFileType(file.buffer)
  if (!type || !IMAGE_TYPES.has(type.mime)) throw AppException.badRequest(code)
  return { file, type }
}
