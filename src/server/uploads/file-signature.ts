/**
 * Identifies an upload from its first bytes instead of trusting the browser's Content-Type or
 * file name. Only photos and PDFs are accepted for prescriptions.
 */
export interface DetectedFile {
  mime: string
  ext: string
}

const startsWith = (buffer: Buffer, bytes: number[], offset = 0) => bytes.every((byte, index) => buffer[offset + index] === byte)
const ascii = (buffer: Buffer, start: number, end: number) => buffer.subarray(start, end).toString('latin1')

export function detectFileType(buffer: Buffer): DetectedFile | null {
  if (buffer.length < 12) return null
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' }
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' }
  if (ascii(buffer, 0, 6) === 'GIF87a' || ascii(buffer, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif' }
  if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' }
  if (ascii(buffer, 0, 5) === '%PDF-') return { mime: 'application/pdf', ext: 'pdf' }
  // HEIC/HEIF photos from iPhones: an ISO-BMFF "ftyp" box with a HEIF brand.
  if (ascii(buffer, 4, 8) === 'ftyp' && ['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(ascii(buffer, 8, 12))) {
    return { mime: 'image/heic', ext: 'heic' }
  }
  return null
}
