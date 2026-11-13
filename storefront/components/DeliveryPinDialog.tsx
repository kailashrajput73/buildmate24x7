'use client'
import { useEffect, useRef, useState } from 'react'
import { MapPin, X } from 'lucide-react'
import { useDelivery, type DeliveryCheck } from '@/lib/delivery'

/** "Deliver to" pop-up: enter a 6-digit PIN code, see whether the store delivers there. No GPS needed. */
export function DeliveryPinDialog({ note, onClose }: { note?: string; onClose: () => void }) {
  const { selected, choose, checking } = useDelivery()
  const [pin, setPin] = useState(selected?.pincode ?? '')
  const [result, setResult] = useState<DeliveryCheck | null>(selected)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => { input.current?.focus() }, [])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const submit = async () => {
    setError(null)
    if (!/^[1-9]\d{5}$/.test(pin)) { setError('Enter a valid 6-digit PIN code.'); return }
    try {
      const r = await choose(pin)
      if (r.status === 'INVALID') setError(r.message)
      else setResult(r)
    } catch { setError('Could not check this PIN code. Check your internet connection and try again.') }
  }
  const shown = result && result.pincode === pin ? result : null

  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="deliver-to-title"
        className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-pipe-600" aria-hidden />
            <h2 id="deliver-to-title" className="text-lg font-bold text-ink">Choose delivery location</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1 text-ink-soft hover:bg-black/5"><X className="h-5 w-5" /></button>
        </div>
        {note && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">{note}</p>}
        <p className="mb-2 text-sm text-ink-soft">Enter the PIN code where you want your order delivered. You can shop from anywhere — only the delivery PIN code matters.</p>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void submit() }}>
          <input ref={input} inputMode="numeric" maxLength={6} value={pin} aria-label="Delivery PIN code" placeholder="6-digit PIN code"
            onChange={(e) => { setPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(null) }}
            className="h-11 flex-1 rounded-xl border border-line px-3 text-base tracking-widest focus:border-pipe-600 focus:outline-none" />
          <button type="submit" disabled={checking || pin.length !== 6} className="btn-primary h-11 px-5 disabled:opacity-50">
            {checking ? 'Checking…' : 'Check'}
          </button>
        </form>
        {error && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        {shown && (
          <div role="status" className={`mt-3 rounded-xl px-3 py-3 text-sm ${shown.serviceable ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-700'}`}>
            <div className="font-semibold">{shown.serviceable ? '✓ Delivery available' : '✕ Delivery not available'}</div>
            <div>{[shown.city, shown.district, shown.state].filter(Boolean).join(', ') || shown.pincode}</div>
            {!shown.serviceable && <div className="mt-1">{shown.message} You can still browse; try another PIN code to order.</div>}
          </div>
        )}
        {shown?.serviceable && (
          <button type="button" onClick={onClose} className="btn-primary mt-3 h-11 w-full">Continue shopping</button>
        )}
      </div>
    </div>
  )
}
