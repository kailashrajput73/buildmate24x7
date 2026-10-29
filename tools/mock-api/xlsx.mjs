// Minimal .xlsx reader/writer with no dependencies (Node's zlib only), so the mock API can do Excel
// import, export and templates like the real API. Reads the first sheet of files saved by Excel, Google
// Sheets, LibreOffice or openpyxl; writes one plain sheet with a bold header row.
import { deflateRawSync, inflateRawSync } from 'node:zlib'

// ------------------------------------------------------------------ zip
function unzip(buf) {
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('not a zip')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const files = new Map()
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad zip directory')
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28), extraLen = buf.readUInt16LE(p + 30), commentLen = buf.readUInt16LE(p + 32)
    const local = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen)
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + size)
    files.set(name, () => (method === 0 ? raw : method === 8 ? inflateRawSync(raw) : (() => { throw new Error('unsupported compression') })()))
    p += 46 + nameLen + extraLen + commentLen
  }
  return files
}

const CRC = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c })
const crc32 = (b) => { let c = -1; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ -1) >>> 0 }

function zip(entries) {
  const locals = [], central = []
  let offset = 0
  for (const [name, content] of entries) {
    const data = Buffer.from(content), comp = deflateRawSync(data), nm = Buffer.from(name), crc = crc32(data)
    const h = Buffer.alloc(30)
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8)
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26)
    const c = Buffer.alloc(46)
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10)
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(offset, 42)
    locals.push(h, nm, comp); central.push(c, nm)
    offset += 30 + nm.length + comp.length
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, cd, end])
}

// ------------------------------------------------------------------ xml helpers
const unesc = (s) => s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[e.toLowerCase()])
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
const textOf = (xml) => [...xml.matchAll(/<(?:\w+:)?t(?:\s[^>]*)?>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((m) => unesc(m[1])).join('')
const colIndex = (ref) => { let n = 0; for (const ch of ref.replace(/\d+/g, '').toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1 }
const colName = (i) => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26) } return s }

/** Returns the first sheet as an array of rows; each row is an array of strings ('' for empty cells). Row 0 is the header. */
export function readXlsx(buf) {
  const files = unzip(buf)
  const get = (n) => { const f = files.get(n); return f ? f().toString('utf8') : null }
  const wb = get('xl/workbook.xml'); if (!wb) throw new Error('no workbook')
  const firstSheet = /<(?:\w+:)?sheet\b[^>]*\br:id="([^"]+)"/.exec(wb)?.[1]
  const rels = get('xl/_rels/workbook.xml.rels') ?? ''
  let target = [...rels.matchAll(/<Relationship\b[^>]*>/g)].map((m) => m[0]).find((r) => r.includes(`Id="${firstSheet}"`))?.match(/Target="([^"]+)"/)?.[1] ?? 'worksheets/sheet1.xml'
  target = target.startsWith('/') ? target.slice(1) : `xl/${target}`
  const sheet = get(target); if (!sheet) throw new Error('no sheet')
  const sstXml = get('xl/sharedStrings.xml') ?? ''
  const sst = [...sstXml.matchAll(/<(?:\w+:)?si>([\s\S]*?)<\/(?:\w+:)?si>/g)].map((m) => textOf(m[1].replace(/<(?:\w+:)?rPh\b[\s\S]*?<\/(?:\w+:)?rPh>/g, '')))
  const rows = []
  for (const rm of sheet.matchAll(/<(?:\w+:)?row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?row>)/g)) {
    const rIdx = Number(/\br="(\d+)"/.exec(rm[1])?.[1] ?? rows.length + 1) - 1
    const row = []
    let next = 0
    for (const cm of (rm[2] ?? '').matchAll(/<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)) {
      const attrs = cm[1], inner = cm[2] ?? ''
      const ref = /\br="([A-Z]+\d*)"/.exec(attrs)?.[1]
      const ci = ref ? colIndex(ref) : next
      next = ci + 1
      const t = /\bt="(\w+)"/.exec(attrs)?.[1]
      const v = /<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/.exec(inner)?.[1]
      let val = ''
      if (t === 's') val = sst[Number(v)] ?? ''
      else if (t === 'inlineStr') val = textOf(inner)
      else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE'
      else if (t === 'str' || t === 'e') val = v != null ? unesc(v) : ''
      else if (v != null) { const n = Number(v); val = Number.isFinite(n) ? String(Number(n.toPrecision(15))) : unesc(v) }
      row[ci] = val.trim()
    }
    rows[rIdx] = Array.from({ length: row.length }, (_, i) => row[i] ?? '')
  }
  return Array.from({ length: rows.length }, (_, i) => rows[i] ?? [])
}

/** Builds a one-sheet workbook. rows[0] is the header (bold); numbers stay numbers, everything else is text. */
export function writeXlsx(sheetName, rows) {
  const width = Math.max(1, ...rows.map((r) => r.length))
  const widths = Array.from({ length: width }, (_, c) => Math.min(60, Math.max(8, ...rows.slice(0, 200).map((r) => String(r[c] ?? '').length + 2))))
  const body = rows.map((r, ri) => `<row r="${ri + 1}">${r.map((v, ci) => {
    if (v == null || v === '') return ''
    const ref = `${colName(ci)}${ri + 1}`, style = ri === 0 ? ' s="1"' : ''
    return typeof v === 'number' && Number.isFinite(v) ? `<c r="${ref}"${style}><v>${v}</v></c>` : `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${esc(typeof v === 'boolean' ? (v ? 'Yes' : 'No') : v)}</t></is></c>`
  }).join('')}</row>`).join('')
  const name = esc(String(sheetName).replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'Sheet1')
  return zip([
    ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'],
    ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${name}" sheetId="1" r:id="rId1"/></sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
    ['xl/styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'],
    ['xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${body}</sheetData></worksheet>`],
  ])
}

/** Parses a multipart/form-data body into { fields, files: { name: { filename, data } } }. */
export function parseMultipart(buf, contentType) {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType ?? '')
  const out = { fields: {}, files: {} }
  if (!boundary) return out
  const delim = Buffer.from(`--${boundary[1] ?? boundary[2].trim()}`)
  let pos = buf.indexOf(delim)
  while (pos >= 0) {
    const start = pos + delim.length
    if (buf.subarray(start, start + 2).toString() === '--') break
    const headEnd = buf.indexOf('\r\n\r\n', start)
    if (headEnd < 0) break
    const next = buf.indexOf(delim, headEnd + 4)
    if (next < 0) break
    const head = buf.toString('utf8', start, headEnd)
    const data = buf.subarray(headEnd + 4, next - 2) // strip the CRLF before the next boundary
    const name = /name="([^"]*)"/i.exec(head)?.[1]
    const filename = /filename="([^"]*)"/i.exec(head)?.[1]
    if (name != null) { if (filename != null) out.files[name] = { filename, data }; else out.fields[name] = data.toString('utf8') }
    pos = next
  }
  return out
}
