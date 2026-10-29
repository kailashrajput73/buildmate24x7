import { Camera, ScanLine, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { money, qty } from '../lib/format'
import type { ProductLookup } from '../lib/types'
import { Button } from './ui'

/**
 * One box for both workflows at the counter:
 *  - USB / Bluetooth barcode scanners type the code and press Enter → exact lookup.
 *  - Staff can also type part of a name or alias and pick from the list.
 *  - The camera button scans product QR codes (and box barcodes where the browser can read them). It uses the
 *    browser's built-in detector when there is one (Chrome on Android) and a bundled decoder otherwise
 *    (Chrome/Edge on Windows, Firefox, Safari). Browsers only allow the camera on https:// or localhost.
 */
export default function ProductPicker({ onPick, placeholder = 'Scan a QR / barcode, or type a product name', autoFocus }: {
  onPick: (p: ProductLookup) => void
  placeholder?: string
  autoFocus?: boolean
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<ProductLookup[]>([])
  const [active, setActive] = useState(0)
  const [open, setOpen] = useState(false)
  const [camera, setCamera] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      try {
        const r = await api.get<ProductLookup[]>('/api/admin/products/lookup', { q: term, take: 12 })
        setResults(r)
        setActive(0)
        setOpen(true)
      } catch { /* ignore while typing */ }
    }, 200)
    return () => clearTimeout(t)
  }, [q])

  const pick = (p: ProductLookup) => {
    onPick(p)
    setQ('')
    setResults([])
    setOpen(false)
    inputRef.current?.focus()
  }

  const scan = async (code: string, quiet = false) => {
    try {
      pick(await api.get<ProductLookup>(`/api/admin/products/scan/${encodeURIComponent(code.trim())}`))
      return true
    } catch {
      if (!quiet) toast.error(`No product found for “${code}”`)
      return false
    }
  }

  const onKey = async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'Enter') {
      e.preventDefault()
      const term = q.trim()
      if (!term) return
      // A scanner types the whole code (C1115CKG, BM000123 or a box EAN) and presses Enter before the name search
      // returns, so a single word is looked up as an exact code first; only if that fails is the highlighted match used.
      const exact = results.find((r) => r.code.toUpperCase() === term.toUpperCase())
      if (exact) pick(exact)
      else if (!/\s/.test(term) && await scan(term, results.length > 0)) { /* added */ }
      else if (results[active]) pick(results[active])
      else if (/\s/.test(term)) await scan(term)
    }
  }

  return (
    <div className="relative">
      <ScanLine className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-pipe-500" />
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        className="input h-11 pl-10 pr-12 text-base"
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={onKey}
        onFocus={() => results.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Find product"
      />
      {!!navigator.mediaDevices?.getUserMedia && (
        <button type="button" onClick={() => setCamera(true)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-ink-soft hover:bg-pipe-50" aria-label="Scan with camera">
          <Camera className="h-5 w-5" />
        </button>
      )}
      {open && results.length > 0 && (
        <ul className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-line bg-white py-1 shadow-xl">
          {results.map((p, i) => (
            <li key={p.id}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(p)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${i === active ? 'bg-pipe-50' : ''}`}>
                <span className="num w-20 shrink-0 text-xs text-ink-faint">{p.code}</span>
                <span className="flex-1 truncate">{p.name}<span className="text-ink-faint"> · {p.brandName}</span></span>
                <span className={`num text-xs ${p.availableQty <= 0 ? 'text-brick-700' : 'text-ink-soft'}`}>{qty(p.availableQty)} {p.unit}</span>
                <span className="num w-20 text-right text-xs">{money(p.listPrice)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {camera && <CameraScanner onClose={() => setCamera(false)} onCode={(c) => { setCamera(false); scan(c) }} />}
    </div>
  )
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type DetectorCtor = (new (o: object) => Detector) & { getSupportedFormats?: () => Promise<string[]> }

/** Built-in BarcodeDetector if it can read QR codes here, else null (the bundled jsQR decoder is used). */
async function nativeDetector(): Promise<Detector | null> {
  const Ctor = (window as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
  if (!Ctor) return null
  try {
    const supported = (await Ctor.getSupportedFormats?.()) ?? []
    const wanted = ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a'].filter((f) => supported.includes(f))
    return wanted.includes('qr_code') ? new Ctor({ formats: wanted }) : null
  } catch { return null }
}

function CameraScanner({ onClose, onCode }: { onClose: () => void; onCode: (c: string) => void }) {
  const video = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    let stream: MediaStream | undefined
    let stop = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } })
      } catch (e) {
        const denied = e instanceof DOMException && (e.name === 'NotAllowedError' || e.name === 'SecurityError')
        toast.error(denied ? 'Camera permission was blocked. Allow the camera for this site, or use a scanner / type the code.' : 'No camera found. Use a scanner or type the code.')
        onClose()
        return
      }
      const v = video.current
      if (!v || stop) { stream.getTracks().forEach((t) => t.stop()); return }
      v.srcObject = stream
      await v.play().catch(() => undefined)
      const native = await nativeDetector()
      const jsQR = native ? null : (await import('jsqr')).default
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      while (!stop) {
        let code: string | undefined
        if (v.readyState >= 2 && v.videoWidth) {
          if (native) code = (await native.detect(v).catch(() => []))[0]?.rawValue
          else if (jsQR && ctx) {
            // decode a centred square at most 640 px wide — fast enough on low-end tablets
            const side = Math.min(v.videoWidth, v.videoHeight), scale = Math.min(1, 640 / side)
            canvas.width = canvas.height = Math.round(side * scale)
            ctx.drawImage(v, (v.videoWidth - side) / 2, (v.videoHeight - side) / 2, side, side, 0, 0, canvas.width, canvas.height)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            code = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data
          }
        }
        if (code?.trim() && !stop) { navigator.vibrate?.(60); onCode(code.trim()); return }
        await new Promise((r) => setTimeout(r, 200))
      }
    })()
    return () => { stop = true; stream?.getTracks().forEach((t) => t.stop()) }
  }, []) // eslint-disable-line

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/80 p-4" role="dialog" aria-label="Scan with camera">
      <div className="w-full max-w-md overflow-hidden rounded-lg bg-black">
        <div className="relative">
          <video ref={video} className="aspect-square w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-[18%] rounded-xl border-[3px] border-tape-400/90" />
        </div>
        <div className="flex items-center justify-between bg-white px-4 py-2">
          <span className="text-sm">Point the camera at the product QR code</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close camera"><X className="h-4 w-4" /></Button>
        </div>
      </div>
    </div>
  )
}
