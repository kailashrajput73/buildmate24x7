'use client'
import { Minus, Plus, ShoppingCart, Zap } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { useShop } from '@/lib/shop'
import { useDelivery } from '@/lib/delivery'

export function QtyStepper({ value, onChange, max, disabled, size = 'md' }: { value: number; onChange: (v: number) => void; max?: number; disabled?: boolean; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-8' : 'h-11'
  return (
    <div className={`inline-flex ${h} items-center rounded-full border border-white/80 bg-white/70 shadow-[inset_0_1px_2px_rgb(16_42_84/0.06)]`}>
      <button type="button" disabled={disabled || value <= 1} onClick={() => onChange(value - 1)} className="flex h-full w-9 items-center justify-center text-ink-soft disabled:opacity-40" aria-label="Decrease quantity"><Minus className="h-4 w-4" /></button>
      <input value={value} inputMode="numeric" aria-label="Quantity" disabled={disabled}
        onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, '')); if (n >= 1) onChange(max ? Math.min(n, max) : n) }}
        className="num h-full w-12 border-x border-line bg-transparent text-center text-[15px] font-semibold focus:outline-none" />
      <button type="button" disabled={disabled || (max != null && value >= max)} onClick={() => onChange(value + 1)} className="flex h-full w-9 items-center justify-center text-ink-soft disabled:opacity-40" aria-label="Increase quantity"><Plus className="h-4 w-4" /></button>
    </div>
  )
}

export function AddButton({ productId, name, inStock, compact }: { productId: number; name: string; inStock: boolean; compact?: boolean }) {
  const { add, cartBusy } = useShop()
  const { selected } = useDelivery()
  if (!inStock) return <span className="text-sm font-semibold text-ink-faint">Out of stock</span>
  const blocked = !!selected && !selected.serviceable
  return (
    <button type="button" disabled={cartBusy || blocked} title={blocked ? selected?.message : undefined} onClick={() => add(productId, 1, name)}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full border-2 border-pipe-600/80 bg-white/50 font-semibold text-pipe-700 transition-colors hover:bg-pipe-600 hover:text-white disabled:opacity-50 ${compact ? 'h-9 px-3 text-sm' : 'h-10 w-full text-sm'}`}
      aria-label={`Add ${name} to cart`}>
      <ShoppingCart className="h-4 w-4" /> Add
    </button>
  )
}

export function AddWithQty({ productId, name, max }: { productId: number; name: string; max: number }) {
  const { add, cartBusy } = useShop()
  const { selected, openPicker } = useDelivery()
  const blocked = !!selected && !selected.serviceable
  const router = useRouter()
  const [q, setQ] = useState(1)
  if (max <= 0) return <p className="glass-soft rounded-2xl px-4 py-3 font-semibold text-ink-soft">Out of stock right now. Call the store — we may have it at the counter.</p>
  // Buy now = put this quantity in the cart and go straight to checkout (login happens there if needed).
  const buyNow = async () => { if (await add(productId, q, name, true)) router.push('/checkout') }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <QtyStepper value={q} onChange={setQ} max={max} />
        <button className="inline-flex h-11 min-w-[160px] flex-1 items-center justify-center gap-2 rounded-full border-2 border-pipe-600/80 bg-white/50 font-semibold text-pipe-700 transition-colors hover:bg-white/90 disabled:opacity-50"
          disabled={cartBusy || blocked} onClick={() => add(productId, q, name)}>
          <ShoppingCart className="h-5 w-5" /> Add to cart
        </button>
      </div>
      <button className="btn-primary h-12 w-full text-base" disabled={cartBusy || blocked} onClick={buyNow}>
        <Zap className="h-5 w-5" /> Buy now
      </button>
      {blocked && <DeliveryBlockedNote message={selected!.message} onChange={() => openPicker()} />}
    </div>
  )
}

/** Shown under Add to Cart / Buy Now when the selected delivery PIN code is not serviceable. */
export function DeliveryBlockedNote({ message, onChange }: { message: string; onChange: () => void }) {
  return (
    <p role="status" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
      {message} <button type="button" onClick={onChange} className="font-semibold underline">Change PIN code</button>
    </p>
  )
}
