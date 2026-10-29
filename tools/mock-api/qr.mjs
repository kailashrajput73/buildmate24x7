// Scannable QR code PNGs for the mock API, matching the real API (QRCoder, error correction Q, product code as text).
// Uses the vendored MIT "qrcode-generator" (vendor/qrcode-generator.cjs) and Node's zlib — no npm install.
import { createRequire } from 'node:module'
import { deflateSync } from 'node:zlib'

const qrcode = createRequire(import.meta.url)('./vendor/qrcode-generator.cjs')

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]) }

/** Black-on-white QR PNG, `scale` pixels per module, 4-module quiet zone. */
export function qrPng(text, scale = 10) {
  const qr = qrcode(0, 'Q')
  qr.addData(String(text), 'Byte')
  qr.make()
  const n = qr.getModuleCount(), quiet = 4, s = Math.min(40, Math.max(2, Math.round(scale) || 10)), size = (n + quiet * 2) * s
  const raw = Buffer.alloc((size + 1) * size, 255)
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0 // filter: none
    const my = Math.floor(y / s) - quiet
    for (let x = 0; x < size; x++) {
      const mx = Math.floor(x / s) - quiet
      if (my >= 0 && my < n && mx >= 0 && mx < n && qr.isDark(my, mx)) raw[y * (size + 1) + 1 + x] = 0
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 0 // 8-bit greyscale
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
}
