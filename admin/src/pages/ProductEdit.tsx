import CatalogFields from '../components/CatalogFields'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, Printer, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import ImageUploader from '../components/ImageUploader'
import { Button, ErrorBox, Field, Input, KeyVal, Loading, NumberInput, PageHeader, Section, Select, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { money, qty } from '../lib/format'
import { useAction } from '../lib/hooks'
import { useBrands, useCategories, useGroups, useSubCategories, useProductTypes } from '../lib/masters'
import type { Product, ProductUpsert } from '../lib/types'

const GST = [0, 5, 12, 18, 28]
const LANGS: { code: string; label: string }[] = [{ code: 'hi', label: 'Hindi' }, { code: 'gu', label: 'Gujarati' }, { code: 'mr', label: 'Marathi' }]

const blank: ProductUpsert = {
  name: '', description: '', categoryId: 0, subCategoryId: undefined, brandId: 0, barcode: '', unit: 'pcs', hsnCode: '', gstRate: 18,
  mrp: 0, listPrice: 0, partnerDiscountPercent: 0, retailDiscountPercent: 0, rewardPointsPerUnit: 0, reorderLevel: 0, sequence: 0,
  imageUrls: [], isActive: true, showOnWeb: true, showOnApp: true, aliases: [], translations: {}, groupIds: [],
  variantFamily: '', variantLabel: '', specs: [], catalog: { boxDiscountType: 'None', boxDiscountValue: 0 },
}

export default function ProductEdit() {
  const { id } = useParams()
  const isNew = id === 'new'
  const nav = useNavigate()
  const { can } = useAuth()
  const readOnly = !can(P.catalogManage)
  const { data, isLoading, error } = useQuery({ queryKey: ['product', id], queryFn: () => api.get<Product>(`/api/admin/products/${id}`), enabled: !isNew })
  const [f, setF] = useState<ProductUpsert>(blank)
  useEffect(() => { if (data) setF({ ...blank, ...data, variantFamily: data.catalog?.productFamily ?? data.variantFamily }) }, [data])
  const set = <K extends keyof ProductUpsert>(k: K, v: ProductUpsert[K]) => setF((x) => ({ ...x, [k]: v }))

  const cats = useCategories().data ?? []
  const productTypes = useProductTypes(f.categoryId || undefined).data ?? []
  const subs = (useSubCategories(f.categoryId || undefined).data ?? []).filter(s => !f.catalog?.typeId || productTypes.find(t => t.id === f.catalog?.typeId)?.subCategoryIds.includes(s.id))
  const brands = useBrands().data ?? []
  const groups = useGroups().data ?? []
  const [qr, setQr] = useState<string>()
  useEffect(() => {
    if (isNew || !data) return
    let url: string | undefined
    api.objectUrl(`/api/admin/products/${data.id}/qr.png?size=8`).then((u) => { url = u; setQr(u) }).catch(() => undefined)
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [data, isNew])

  const save = useAction(
    () => (isNew ? api.post<Product>('/api/admin/products', clean(f)) : api.put<Product>(`/api/admin/products/${id}`, clean(f))),
    { success: (p) => `${p.name} saved`, invalidate: ['products', 'product'], onSuccess: (p) => isNew && nav(`/products/${p.id}`, { replace: true }) },
  )

  if (!isNew && isLoading) return <Loading />
  if (error) return <ErrorBox error={error} />

  const partnerPrice = round(f.listPrice * (1 - f.partnerDiscountPercent / 100))
  const retailPrice = round(f.listPrice * (1 - f.retailDiscountPercent / 100))

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(undefined) }}>
      <PageHeader
        back={<Link to="/products" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-pipe-700"><ArrowLeft className="h-4 w-4" /> Products</Link>}
        title={isNew ? 'New product' : f.name || 'Product'}
        subtitle={data ? `${data.code} · updated ${new Date(data.updatedAt).toLocaleDateString('en-IN')}` : 'A BM product code is generated when you save. To use the brand’s own codes, add products by Excel import.'}
        actions={!readOnly && <Button type="submit" busy={save.isPending}>Save product</Button>}
      />
      <fieldset disabled={readOnly} className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Section title="Basics">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Product name" className="sm:col-span-2"><Input required value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="Astral CPVC Pro Pipe 1/2&quot; SDR 11 (3 m)" /></Field>
              <Field label="Category">
                <Select required value={f.categoryId || ''} onChange={(e) => setF((x) => ({ ...x, categoryId: Number(e.target.value), subCategoryId: undefined, catalog: { ...x.catalog!, typeId: undefined, familyId: undefined } }))}>
                  <option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              </Field>
              <Field label="Sub category">
                <Select value={f.subCategoryId ?? ''} onChange={(e) => set('subCategoryId', e.target.value ? Number(e.target.value) : undefined)}>
                  <option value="">None</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </Field>
              <Field label="Brand">
                <Select required value={f.brandId || ''} onChange={(e) => setF(x => ({ ...x, brandId: Number(e.target.value), catalog: { ...x.catalog!, familyId: undefined } }))}>
                  <option value="">Choose…</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Unit"><Input value={f.unit} onChange={(e) => set('unit', e.target.value)} placeholder="pcs, coil, bag, m" /></Field>
                <Field label="Display order" hint="Lower shows first"><NumberInput value={f.sequence} onChange={(v) => set('sequence', v)} /></Field>
              </div>
              <Field label="Description" className="sm:col-span-2"><Textarea value={f.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
            </div>
          </Section>

          <Section title="Options & specifications" actions={<span className="text-xs text-ink-soft">Products with the same family show as one item with an option picker</span>}>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <Field label="Product family" hint="Copy exactly from the other items, e.g. King CPVC Coupler SDR 11">
                <Input value={f.variantFamily ?? ''} onChange={(e) => setF(x => ({ ...x, variantFamily: e.target.value, catalog: { ...x.catalog!, productFamily: e.target.value, familyId: undefined } }))} placeholder="Leave blank if this item has no sizes" />
              </Field>
              <Field label="Option(s) shown in picker" hint='One option: 20 mm (¾"). Several: Size: 1.5 sq.mm; Colour: Red; Length: 90 m'>
                <Input value={f.variantLabel ?? ''} onChange={(e) => set('variantLabel', e.target.value)} placeholder='20 mm (¾")' />
              </Field>
              <Field label="Specifications" hint="One per line as Name: Value — e.g. Material: CPVC" className="sm:col-span-2">
                <Textarea rows={4} value={(f.specs ?? []).join('\n')} onChange={(e) => set('specs', e.target.value.split('\n'))} placeholder={'Material: CPVC\nSDR: SDR 11\nSize: 20 mm (¾")'} />
              </Field>
            </div>
          </Section>

          <Section title="Catalog hierarchy & packages" actions={<Link to="/catalog-structure" className="text-sm text-pipe-700">Manage Types & family images</Link>}>
            <CatalogFields categoryId={f.categoryId} value={f.catalog} onChange={catalog => setF(x => ({ ...x, catalog, subCategoryId: catalog.typeId !== x.catalog?.typeId ? undefined : x.subCategoryId }))} />
          </Section>
          <Section title="Pricing & tax" actions={<span className="text-xs text-ink-soft">All prices include GST</span>}>
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="MRP (₹)"><NumberInput value={f.mrp} onChange={(v) => set('mrp', v)} /></Field>
              <Field label="List price (₹)"><NumberInput required value={f.listPrice} onChange={(v) => set('listPrice', v)} /></Field>
              <Field label="GST %">
                <Select value={f.gstRate} onChange={(e) => set('gstRate', Number(e.target.value))}>{GST.map((g) => <option key={g} value={g}>{g}%</option>)}</Select>
              </Field>
              <Field label="HSN code"><Input value={f.hsnCode ?? ''} onChange={(e) => set('hsnCode', e.target.value)} /></Field>
              <Field label="Partner discount %" hint={`Partners pay ${money(partnerPrice)}`}><NumberInput value={f.partnerDiscountPercent} onChange={(v) => set('partnerDiscountPercent', v)} /></Field>
              <Field label="Retail discount %" hint={`Website shows ${money(retailPrice)}`}><NumberInput value={f.retailDiscountPercent} onChange={(v) => set('retailDiscountPercent', v)} /></Field>
              <Field label="Reward points per unit" hint="Credited to partners on dispatch"><NumberInput value={f.rewardPointsPerUnit} onChange={(v) => set('rewardPointsPerUnit', v)} /></Field>
              <Field label="Reorder level" hint="Low-stock alert at or below"><NumberInput value={f.reorderLevel} onChange={(v) => set('reorderLevel', v)} /></Field>
            </div>
          </Section>

          <Section title="Search names" actions={<span className="text-xs text-ink-soft">Helps partners find products by local names</span>}>
            <Field label="Aliases" hint="Press Enter after each name, e.g. nal, tonti, tap">
              <ChipInput value={f.aliases} onChange={(v) => set('aliases', v)} />
            </Field>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {LANGS.map((l) => (
                <Field key={l.code} label={`Name in ${l.label}`}>
                  <Input value={f.translations[l.code] ?? ''} onChange={(e) => set('translations', { ...f.translations, [l.code]: e.target.value })} />
                </Field>
              ))}
            </div>
          </Section>

          <Section title="Images">
            <ImageUploader value={f.imageUrls} onChange={(v) => set('imageUrls', v)} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Visibility">
            <div className="space-y-2.5">
              <Toggle checked={f.isActive} onChange={(v) => set('isActive', v)} label="Active (can be sold)" />
              <Toggle checked={f.showOnWeb} onChange={(v) => set('showOnWeb', v)} label="Show on website" />
              <Toggle checked={f.showOnApp} onChange={(v) => set('showOnApp', v)} label="Show in partner app" />
            </div>
          </Section>

          <Section title="Codes">
            <Field label="Manufacturer barcode" hint="Optional — EAN/UPC printed on the box"><Input value={f.barcode ?? ''} onChange={(e) => set('barcode', e.target.value)} /></Field>
            {data && (
              <div className="mt-4 flex items-center gap-3">
                {qr ? <img src={qr} alt={`QR code for ${data.code}`} className="h-28 w-28 rounded border border-line" /> : <div className="h-28 w-28 rounded border border-dashed border-line" />}
                <div className="text-sm">
                  <div className="num font-bold">{data.code}</div>
                  <p className="text-xs text-ink-soft">Print and stick on the shelf or box. Scanning it at the counter or in the partner app adds this product.</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button type="button" size="sm" variant="secondary" icon={<Printer className="h-3.5 w-3.5" />} disabled={!qr} onClick={() => qr && printLabel(qr, data)}>Print label</Button>
                    <Button type="button" size="sm" variant="ghost" icon={<Download className="h-3.5 w-3.5" />}
                      onClick={() => api.download(`/api/admin/products/${data.id}/qr.png`, { size: 20 }, `${data.code}.png`)}>Download QR</Button>
                  </div>
                </div>
              </div>
            )}
          </Section>

          <Section title="Product groups">
            {groups.length === 0 ? <p className="text-sm text-ink-faint">No groups yet.</p> : (
              <div className="space-y-1.5">
                {groups.map((g) => (
                  <label key={g.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={f.groupIds.includes(g.id)}
                      onChange={(e) => set('groupIds', e.target.checked ? [...f.groupIds, g.id] : f.groupIds.filter((x) => x !== g.id))} />
                    {g.name}
                  </label>
                ))}
              </div>
            )}
          </Section>

          {data && (
            <Section title="Stock">
              <KeyVal k="In stock" v={`${qty(data.stockQty)} ${data.unit}`} />
              <KeyVal k="Reserved for paid orders" v={qty(data.reservedQty)} />
              <KeyVal k="Available to sell" v={qty(data.availableQty)} />
              <KeyVal k="Average cost" v={money(data.averageCost)} />
              <KeyVal k="Rack" v={data.rackLocations.join(', ') || '—'} />
              <Link to={`/stock?tab=movements&productId=${data.id}`} className="mt-2 inline-block text-sm text-pipe-700 hover:underline">Stock history</Link>
            </Section>
          )}
        </div>
      </fieldset>
    </form>
  )
}

const round = (v: number) => Math.round(v * 100) / 100

function clean(f: ProductUpsert): ProductUpsert {
  return {
    ...f, barcode: f.barcode || undefined, hsnCode: f.hsnCode || undefined,
    translations: Object.fromEntries(Object.entries(f.translations).filter(([, v]) => v?.trim())),
    variantFamily: f.variantFamily?.trim() || null, variantLabel: f.variantLabel?.trim() || null,
    specs: (f.specs ?? []).map((x) => x.trim()).filter((x) => x.includes(':')),
  }
}

function ChipInput({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const [t, setT] = useState('')
  const add = () => {
    const parts = t.split(',').map((s) => s.trim()).filter(Boolean).filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()))
    if (parts.length) onChange([...value, ...parts])
    setT('')
  }
  return (
    <div className="input flex min-h-[40px] flex-wrap items-center gap-1.5 py-1.5">
      {value.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded bg-pipe-50 px-2 py-0.5 text-sm text-pipe-700">
          {v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input className="min-w-[120px] flex-1 border-0 p-0 text-sm outline-none focus:ring-0" value={t} onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add() } else if (e.key === 'Backspace' && !t && value.length) onChange(value.slice(0, -1)) }}
        onBlur={add} placeholder={value.length ? '' : 'Type a name and press Enter'} />
    </div>
  )
}

/** Opens a 50 × 38 mm label (QR, code, name, MRP) in a print window — fits standard thermal label rolls and A4 sticker sheets. */
async function printLabel(qrUrl: string, p: Product) {
  const blob = await (await fetch(qrUrl)).blob()
  const dataUrl = await new Promise<string>((ok) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.readAsDataURL(blob) })
  const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string))
  const w = window.open('', '_blank', 'width=420,height=360')
  if (!w) return
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.code)}</title><style>
    @page { size: 50mm 38mm; margin: 0 } * { box-sizing: border-box } body { margin: 0; font-family: Arial, sans-serif }
    .l { width: 50mm; height: 38mm; padding: 2mm; display: grid; grid-template-columns: 22mm 1fr; gap: 2mm; align-items: center }
    img { width: 22mm; height: 22mm; image-rendering: pixelated } .c { font: 700 11pt Arial; letter-spacing: .3px; word-break: break-all }
    .n { font-size: 7pt; line-height: 1.2; margin-top: 1mm; max-height: 17mm; overflow: hidden } .m { font: 700 9pt Arial; margin-top: 1mm }
  </style></head><body><div class="l"><img src="${dataUrl}" alt=""><div><div class="c">${esc(p.code)}</div><div class="n">${esc(p.name)}</div>${p.mrp ? `<div class="m">MRP ₹${p.mrp.toLocaleString('en-IN')}</div>` : ''}</div></div>
  <script>window.onload = () => { window.focus(); window.print() }<\/script></body></html>`)
  w.document.close()
}
