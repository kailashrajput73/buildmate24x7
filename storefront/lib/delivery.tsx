'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from './api'
import { DeliveryPinDialog } from '@/components/DeliveryPinDialog'

/**
 * Delivery serviceability on the website.
 *
 * The customer picks a delivery PIN code ("Deliver to …"); the server says whether it is serviceable
 * (admin → Delivery areas). Only that selected PIN code decides whether Add to Cart, Buy Now and checkout are
 * allowed — never the customer's GPS position, IP address or current city. The choice is remembered on this
 * device and re-checked with the server on every visit, so a PIN code the store adds or switches off takes effect
 * without any app or website change.
 */

export type DeliveryStatus = 'SERVICEABLE' | 'NOT_SERVICEABLE' | 'INVALID'
export interface DeliveryCheck { pincode: string; status: DeliveryStatus; serviceable: boolean; city: string | null; district: string | null; state: string | null; message: string }

interface DeliveryValue {
  /** The selected delivery PIN code and the server's answer for it (null = none chosen yet). */
  selected: DeliveryCheck | null
  checking: boolean
  /** Purchasing allowed: a selected PIN code the server says is serviceable. */
  canPurchase: boolean
  /** Checks a PIN code with the server and, when valid, makes it the selected delivery PIN code. */
  choose: (pincode: string) => Promise<DeliveryCheck>
  /** Opens the "Deliver to" PIN code pop-up (optionally with a note explaining why). */
  openPicker: (note?: string) => void
  /** For Add to Cart / Buy Now: true when allowed; otherwise opens the pop-up with the reason and returns false. */
  requireServiceable: () => boolean
  /** "370421, Mundra" — for the header. */
  label: string | null
}

const STORAGE_KEY = 'bm_delivery_pin'
const DeliveryContext = createContext<DeliveryValue | null>(null)

const read = (): DeliveryCheck | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const v = raw ? (JSON.parse(raw) as DeliveryCheck) : null
    return v && /^[1-9]\d{5}$/.test(v.pincode) ? v : null
  } catch { return null }
}
const write = (v: DeliveryCheck | null) => {
  try { if (v) localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); else localStorage.removeItem(STORAGE_KEY) } catch { /* private mode */ }
}

export const deliveryLabel = (c: DeliveryCheck | null) => (c ? [c.pincode, c.city ?? c.district].filter(Boolean).join(', ') : null)

export function DeliveryProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<DeliveryCheck | null>(null)
  const [checking, setChecking] = useState(false)
  const [picker, setPicker] = useState<{ note?: string } | null>(null)

  const check = useCallback(async (pincode: string) => {
    const pin = pincode.replace(/\D/g, '')
    return api<DeliveryCheck>(`/api/delivery/check?pincode=${encodeURIComponent(pin)}`)
  }, [])

  // Saved choice: shown at once, then re-checked with the server (the store may have changed its areas).
  useEffect(() => {
    const saved = read()
    if (!saved) return
    setSelected(saved)
    setChecking(true)
    check(saved.pincode)
      .then((r) => { if (r.status !== 'INVALID') { setSelected(r); write(r) } })
      .catch(() => undefined)
      .finally(() => setChecking(false))
  }, [check])

  const choose = useCallback(async (pincode: string) => {
    setChecking(true)
    try {
      const r = await check(pincode)
      if (r.status !== 'INVALID') { setSelected(r); write(r) }
      return r
    } finally { setChecking(false) }
  }, [check])

  const canPurchase = !!selected?.serviceable
  const openPicker = useCallback((note?: string) => setPicker({ note }), [])
  const requireServiceable = useCallback(() => {
    if (canPurchase) return true
    setPicker({
      note: selected
        ? `${selected.message} Choose a serviceable delivery PIN code to add items to your cart.`
        : 'Enter your delivery PIN code to check that we deliver there.',
    })
    return false
  }, [canPurchase, selected])

  const value = useMemo<DeliveryValue>(() => ({
    selected, checking, canPurchase, choose, openPicker, requireServiceable, label: deliveryLabel(selected),
  }), [selected, checking, canPurchase, choose, openPicker, requireServiceable])

  return (
    <DeliveryContext.Provider value={value}>
      {children}
      {picker && <DeliveryPinDialog note={picker.note} onClose={() => setPicker(null)} />}
    </DeliveryContext.Provider>
  )
}

export function useDelivery(): DeliveryValue {
  const v = useContext(DeliveryContext)
  if (!v) throw new Error('useDelivery must be used inside DeliveryProvider')
  return v
}
