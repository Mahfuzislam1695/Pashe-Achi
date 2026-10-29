import { detectFileType, isApk } from './file-signature'

const bytes = (hex: string, pad = 16) => Buffer.concat([Buffer.from(hex, 'hex'), Buffer.alloc(pad)])

describe('detectFileType', () => {
  it.each([
    ['jpeg', bytes('ffd8ffe0'), 'image/jpeg'],
    ['png', bytes('89504e470d0a1a0a'), 'image/png'],
    ['gif', Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(10)]), 'image/gif'],
    ['webp', Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(4)]), 'image/webp'],
    ['pdf', Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(8)]), 'application/pdf'],
    ['heic', Buffer.concat([Buffer.alloc(4), Buffer.from('ftypheic'), Buffer.alloc(4)]), 'image/heic'],
  ])('recognises %s', (_, buffer, mime) => {
    expect(detectFileType(buffer)?.mime).toBe(mime)
  })

  it('rejects anything else, whatever its name or Content-Type claims', () => {
    expect(detectFileType(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull()
    expect(detectFileType(Buffer.from('MZ\x90\x00 executable padding'))).toBeNull()
  })

  it('rejects files too short to identify', () => {
    expect(detectFileType(Buffer.from([0xff, 0xd8]))).toBeNull()
  })
})

describe('isApk', () => {
  const zip = (...entries: string[]) => Buffer.concat([bytes('504b0304', 26), ...entries.map(name => Buffer.from(name)), Buffer.alloc(16)])

  it('accepts a ZIP with an AndroidManifest.xml entry', () => {
    expect(isApk(zip('AndroidManifest.xml', 'classes.dex'))).toBe(true)
  })

  it('rejects other ZIPs and anything that is not a ZIP', () => {
    expect(isApk(zip('word/document.xml'))).toBe(false)
    expect(isApk(Buffer.concat([Buffer.from('%PDF-1.7 AndroidManifest.xml'), Buffer.alloc(16)]))).toBe(false)
    expect(isApk(bytes('504b0304', 0))).toBe(false)
  })
})
