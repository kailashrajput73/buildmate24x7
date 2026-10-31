import { Field, Input, Select } from './ui'
import { useProductTypes } from '../lib/masters'
import type { CatalogFields as Fields } from '../lib/types'

export default function CatalogFields({ value, categoryId, onChange }: { value?: Fields; categoryId: number; onChange: (value: Fields) => void }) {
  const types = useProductTypes(categoryId || undefined).data ?? []
  const f = value ?? { boxDiscountType: 'None', boxDiscountValue: 0 }
  const set = (patch: Partial<Fields>) => onChange({ ...f, ...patch })
  return <div className="grid gap-3 sm:grid-cols-2">
    <Field label="Type"><Select value={f.typeId ?? ''} onChange={e => set({ typeId: e.target.value ? Number(e.target.value) : undefined })}><option value="">Unassigned (legacy)</option>{types.filter(t => t.isActive).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select></Field>
    <Field label="Class"><Input value={f.class ?? ''} onChange={e => set({ class: e.target.value })} /></Field>
    <Field label="Size" hint="Original unit is retained, e.g. 20 mm or 4 sqmm"><Input value={f.size ?? ''} onChange={e => set({ size: e.target.value })} /></Field>
    <Field label="Length" hint="e.g. 3 m, 10 feet"><Input value={f.length ?? ''} onChange={e => set({ length: e.target.value })} /></Field>
    <Field label="Pack Size" hint="Base units in one full package"><Input type="number" min="0.001" step="0.001" value={f.packSize ?? ''} onChange={e => set({ packSize: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    <Field label="MRP Pkg" hint="Leave empty to calculate piece MRP × Pack Size"><Input type="number" min="0.01" step="0.01" value={f.packMrp ?? ''} onChange={e => set({ packMrp: e.target.value ? Number(e.target.value) : undefined })} /></Field>
    <Field label="Box discount type"><Select value={f.boxDiscountType} onChange={e => set({ boxDiscountType: e.target.value as Fields['boxDiscountType'], boxDiscountValue: 0 })}><option>None</option><option>Percentage</option><option>Fixed</option></Select></Field>
    <Field label="Box discount value"><Input type="number" min="0" step="0.01" disabled={f.boxDiscountType === 'None'} value={f.boxDiscountValue} onChange={e => set({ boxDiscountValue: Number(e.target.value) })} /></Field>
    {f.boxPrice != null && <p className="text-sm text-ink-soft">Saved box selling price: ₹{f.boxPrice.toFixed(2)}. Updated prices are calculated by the server when saved.</p>}
  </div>
}
