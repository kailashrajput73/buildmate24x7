'use client'
import { useState } from 'react'
import type { Address } from '@/lib/types'

export type AddressInput = Omit<Address, 'id' | 'isDefault'> & { isDefault: boolean }
export const STATES = ['Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Odisha', 'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal']

export default function AddressForm({ initial, onSave, onCancel, busy }: { initial?: Partial<AddressInput>; onSave: (a: AddressInput) => void; onCancel?: () => void; busy?: boolean }) {
  const [a, setA] = useState<AddressInput>({ name: '', phone: '', line1: '', line2: '', landmark: '', city: '', state: 'Rajasthan', pincode: '', isDefault: true, ...initial })
  const f = (k: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setA({ ...a, [k]: e.target.value })
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); onSave(a) }}>
      <label><span className="label">Full name</span><input className="input" required autoComplete="name" value={a.name} onChange={f('name')} /></label>
      <label><span className="label">Mobile</span><input className="input" required inputMode="numeric" maxLength={10} autoComplete="tel-national" value={a.phone} onChange={(e) => setA({ ...a, phone: e.target.value.replace(/\D/g, '') })} /></label>
      <label className="sm:col-span-2"><span className="label">House / building, street</span><input className="input" required autoComplete="address-line1" value={a.line1} onChange={f('line1')} /></label>
      <label><span className="label">Area / locality</span><input className="input" autoComplete="address-line2" value={a.line2 ?? ''} onChange={f('line2')} /></label>
      <label><span className="label">Landmark</span><input className="input" value={a.landmark ?? ''} onChange={f('landmark')} /></label>
      <label><span className="label">City</span><input className="input" required autoComplete="address-level2" value={a.city} onChange={f('city')} /></label>
      <label><span className="label">Pincode</span><input className="input" required inputMode="numeric" maxLength={6} autoComplete="postal-code" value={a.pincode} onChange={(e) => setA({ ...a, pincode: e.target.value.replace(/\D/g, '') })} /></label>
      <label className="sm:col-span-2"><span className="label">State</span><select className="input" value={a.state} onChange={f('state')}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
      <div className="flex gap-2 sm:col-span-2">
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</button>
        {onCancel && <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
