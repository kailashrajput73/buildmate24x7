import { ArrowLeft, FileSpreadsheet, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import ProductPicker from '../components/ProductPicker'
import { Button, Field, ImportErrors, Input, NumberInput, PageHeader, Section, Select } from '../components/ui'
import { api, ApiError } from '../lib/api'
import { money, todayIso } from '../lib/format'
import { useAction } from '../lib/hooks'
import { useRackLocations } from '../lib/masters'
import type { ImportError, ProductLookup, PurchaseDetail } from '../lib/types'

type Line = { p: ProductLookup; quantity: number; listPrice: number; discount: number; rackId: string }

export default function PurchaseNew() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'manual' | 'excel'>('manual')
  const [head, setHead] = useState({ supplierName: '', supplierGstin: '', supplierInvoiceNo: '', purchaseDate: todayIso(), notes: '' })
  const [lines, setLines] = useState<Line[]>([])
  const [errors, setErrors] = useState<ImportError[]>()
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const locs = useRackLocations().data ?? []
  const net = (l: Line) => Math.round(l.listPrice * (1 - l.discount / 100) * 10000) / 10000
  const total = lines.reduce((s, l) => s + Math.round(net(l) * l.quantity * 100) / 100, 0)

  const save = useAction(() => api.post<PurchaseDetail>('/api/admin/purchases', {
    ...head, items: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity, listPrice: l.listPrice, purchaseDiscountPercent: l.discount, rackLocationId: l.rackId ? Number(l.rackId) : undefined })),
  }), { success: (p) => `${p.purchaseNo} saved — stock updated`, invalidate: ['purchases', 'stock', 'products', 'dashboard'], onSuccess: () => nav('/purchases') })

  const upload = async () => {
    if (!file) return
    setUploading(true)
    setErrors(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      Object.entries(head).forEach(([k, v]) => v && fd.append(k, v))
      const p = await api.upload<PurchaseDetail>('/api/admin/purchases/upload', fd)
      toast.success(`${p.purchaseNo} saved with ${p.items.length} lines — stock updated`)
      nav('/purchases')
    } catch (e) {
      if (e instanceof ApiError && e.rowErrors) setErrors(e.rowErrors)
      else toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally { setUploading(false) }
  }

  return (
    <>
      <PageHeader back={<Link to="/purchases" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-pipe-700"><ArrowLeft className="h-4 w-4" /> Purchases</Link>}
        title="New purchase" subtitle="Stock is added as soon as you save." />

      <Section title="Supplier bill" className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Supplier"><Input value={head.supplierName} onChange={(e) => setHead({ ...head, supplierName: e.target.value })} /></Field>
          <Field label="Supplier GSTIN"><Input value={head.supplierGstin} maxLength={15} onChange={(e) => setHead({ ...head, supplierGstin: e.target.value.toUpperCase() })} /></Field>
          <Field label="Bill no."><Input value={head.supplierInvoiceNo} onChange={(e) => setHead({ ...head, supplierInvoiceNo: e.target.value })} /></Field>
          <Field label="Purchase date"><Input type="date" value={head.purchaseDate} onChange={(e) => setHead({ ...head, purchaseDate: e.target.value })} /></Field>
        </div>
      </Section>

      <div className="mb-3 inline-flex rounded-md border border-line bg-white p-0.5">
        {(['manual', 'excel'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`rounded px-3 py-1.5 text-sm font-semibold ${mode === m ? 'bg-pipe-600 text-white' : 'text-ink-soft'}`}>
            {m === 'manual' ? 'Enter items' : 'Upload Excel'}
          </button>
        ))}
      </div>

      {mode === 'manual' ? (
        <Section title={`Items (${lines.length})`}>
          <ProductPicker autoFocus onPick={(p) => setLines((ls) => ls.some((l) => l.p.id === p.id) ? ls : [...ls, { p, quantity: 1, listPrice: 0, discount: 0, rackId: '' }])} />
          {lines.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Product</th><th className="w-24 text-right">Qty</th><th className="w-28 text-right">List price</th><th className="w-24 text-right">Disc. %</th><th className="w-32">Rack</th><th className="text-right">Net amount</th><th /></tr></thead>
                <tbody>
                  {lines.map((l) => {
                    const upd = (patch: Partial<Line>) => setLines((ls) => ls.map((x) => (x.p.id === l.p.id ? { ...x, ...patch } : x)))
                    return (
                      <tr key={l.p.id}>
                        <td><div className="font-medium">{l.p.name}</div><div className="text-2xs text-ink-faint">{l.p.code}{l.p.rackLocations.length > 0 && ` · usually ${l.p.rackLocations.join(', ')}`}</div></td>
                        <td><NumberInput className="text-right" value={l.quantity} onChange={(v) => upd({ quantity: v })} aria-label="Quantity" /></td>
                        <td><NumberInput className="text-right" value={l.listPrice} onChange={(v) => upd({ listPrice: v })} aria-label="List price" /></td>
                        <td><NumberInput className="text-right" value={l.discount} onChange={(v) => upd({ discount: v })} aria-label="Discount" /></td>
                        <td><Select value={l.rackId} onChange={(e) => upd({ rackId: e.target.value })} aria-label="Rack"><option value="">—</option>{locs.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</Select></td>
                        <td className="num text-right font-semibold">{money(net(l) * l.quantity)}</td>
                        <td><Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.p.id !== l.p.id))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t border-line pt-3">
            <span className="text-sm">Total <b className="num ml-1 text-lg">{money(total)}</b></span>
            <Button busy={save.isPending} disabled={!lines.length || lines.some((l) => l.quantity <= 0)} onClick={() => save.mutate(undefined)}>Save purchase & add stock</Button>
          </div>
        </Section>
      ) : (
        <Section title="Upload items from Excel">
          <p className="mb-3 text-sm text-ink-soft">
            Columns: Product Code, Quantity, List Price, Purchase Discount %, Rack Location.{' '}
            <button className="font-semibold text-pipe-700 hover:underline" onClick={() => api.download('/api/admin/purchases/template', undefined, 'purchase-template.xlsx')}>Download the template</button>.
          </p>
          <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-md border-2 border-dashed border-line px-4 py-6 text-left hover:border-pipe-500">
            <FileSpreadsheet className="h-8 w-8 text-leaf-600" /><span className="text-sm">{file ? <b>{file.name}</b> : 'Choose an .xlsx file'}</span>
          </button>
          <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors(undefined) }} />
          <ImportErrors errors={errors} />
          <div className="mt-4 flex justify-end"><Button busy={uploading} disabled={!file} onClick={upload}>Upload & add stock</Button></div>
        </Section>
      )}
    </>
  )
}
