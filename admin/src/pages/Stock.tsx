import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, SlidersHorizontal } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DaysSince, MOVEMENT_LABEL, MovementBadge, MovementHistoryDrawer, MovementSelect } from '../components/Movement'
import ProductPicker from '../components/ProductPicker'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, Pager, SearchBox, Select, Stat, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { date, dateTime, daysAgoIso, human, money, money0, qty, todayIso } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import { useBrands, useCategories, useRackLocations } from '../lib/masters'
import type { MovementCategory, MovementSummary, Paged, ProductLookup, StockMovement, StockRow } from '../lib/types'

export default function Stock() {
  const { can } = useAuth()
  const [f, set] = useUrlState({ tab: 'current', lowOnly: false, categoryId: '', brandId: '', search: '', movement: '', neverDispatched: '', productId: '', type: '', from: daysAgoIso(30), to: todayIso(), page: 1 })
  const [adjusting, setAdjusting] = useState(false)
  const tabs = [['current', 'Current stock'], ['movements', 'Stock in / out'], ['statement', 'Period statement']]

  return (
    <>
      <PageHeader title="Stock" subtitle="Stock goes up with purchases, down on dispatch. Paid orders reserve stock until they're handed over."
        actions={can(P.stockAdjust) && <Button variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />} onClick={() => setAdjusting(true)}>Adjust stock</Button>} />
      <div className="mb-4 flex gap-1 border-b border-line">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => set({ tab: k })} className={`border-b-2 px-3 py-2 text-sm font-semibold ${f.tab === k ? 'border-pipe-600 text-pipe-700' : 'border-transparent text-ink-soft'}`}>{l}</button>
        ))}
      </div>
      {f.tab === 'current' && <Current f={f} set={set} />}
      {f.tab === 'movements' && <Movements f={f} set={set} />}
      {f.tab === 'statement' && <Statement f={f} set={set} />}
      {adjusting && <AdjustDrawer onClose={() => setAdjusting(false)} />}
    </>
  )
}

type F = { lowOnly: boolean; categoryId: string; brandId: string; search: string; movement: string; neverDispatched: string; productId: string; type: string; from: string; to: string; page: number }

function Current({ f, set }: { f: F; set: (p: Partial<F>) => void }) {
  const cats = useCategories().data ?? []
  const brands = useBrands().data ?? []
  const [historyOf, setHistoryOf] = useState<number | null>(null)
  // The API applies every filter (search included) so the list, the cards and the Excel export always agree.
  const base = { lowOnly: f.lowOnly || undefined, categoryId: f.categoryId, brandId: f.brandId, search: f.search.trim() || undefined }
  const params = { ...base, movement: f.movement || undefined, neverDispatched: f.neverDispatched || undefined }
  const { data: rows = [], isLoading, error } = useQuery({ queryKey: ['stock', params], queryFn: () => api.get<StockRow[]>('/api/admin/stock', params), placeholderData: keepPreviousData })
  const { data: summary } = useQuery({ queryKey: ['stock', 'movement-summary', base], queryFn: () => api.get<MovementSummary>('/api/admin/stock/movement-summary', base), placeholderData: keepPreviousData })
  const value = rows.reduce((a, r) => a + r.value, 0)
  const low = rows.filter((r) => r.stockQty <= r.reorderLevel).length
  const cards: [MovementCategory, string, MovementSummary['fast'] | undefined][] = [
    ['Fast', `Dispatched in the last ${summary?.fastMaxDays ?? 30} days`, summary?.fast],
    ['Slow', `Last dispatch ${(summary?.fastMaxDays ?? 30) + 1}–${summary?.slowMaxDays ?? 120} days ago`, summary?.slow],
    ['NonMoving', `No dispatch for over ${summary?.slowMaxDays ?? 120} days`, summary?.nonMoving],
  ]

  return (
    <>
      <div className="mb-3 grid gap-3 sm:grid-cols-3" role="group" aria-label="Movement summary">
        {cards.map(([k, hint, b]) => {
          const on = f.movement === k
          return (
            <button key={k} type="button" aria-pressed={on} onClick={() => set({ movement: on ? '' : k })}
              className={`card px-4 py-3 text-left transition hover:ring-2 hover:ring-pipe-200 ${on ? 'ring-2 ring-pipe-500' : ''}`}>
              <div className="flex items-center justify-between text-xs font-semibold text-ink-soft">
                <span>{MOVEMENT_LABEL[k]}</span>
                <span className={`h-2.5 w-2.5 rounded-full ${k === 'Fast' ? 'bg-leaf-500' : k === 'Slow' ? 'bg-tape-500' : 'bg-brick-500'}`} />
              </div>
              <div className="num mt-1 text-2xl font-display font-bold">{b ? b.products : '—'}</div>
              <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>
              {b && (
                <div className="mt-1 text-xs text-ink-soft">
                  {money0(b.stockValue)} stock{b.neverDispatched > 0 && <> · <span className="font-semibold">{b.neverDispatched} never dispatched</span></>}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Stat label="Products shown" value={rows.length} sub={summary && `Movement as of ${date(summary.asOf)} (India time)`} />
        <Stat label="Stock value (at average cost)" value={money0(value)} />
        <Stat label="At or below reorder level" value={low} tone={low ? 'danger' : undefined} />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchBox className="w-64" value={f.search} onChange={(v) => set({ search: v })} placeholder="Search name, code or barcode" />
        <Select className="w-48" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select className="w-48" value={f.brandId} onChange={(e) => set({ brandId: e.target.value })} aria-label="Brand"><option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</Select>
        <MovementSelect value={f.movement} onChange={(v) => set({ movement: v })} />
        <Select className="w-44" value={f.neverDispatched} onChange={(e) => set({ neverDispatched: e.target.value })} aria-label="Dispatch history">
          <option value="">Dispatched or not</option><option value="false">Dispatched before</option><option value="true">Never dispatched</option>
        </Select>
        <Toggle checked={f.lowOnly} onChange={(v) => set({ lowOnly: v })} label="Low stock only" />
        <Button variant="secondary" className="ml-auto" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/stock/export', params, 'stock.xlsx')}>Export</Button>
      </div>
      <ErrorBox error={error} />
      <div className="card max-h-[70vh] overflow-auto">
        {isLoading ? <Loading /> : !rows.length ? <Empty title="Nothing to show">Change the filters or the search.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Product</th><th>Category</th><th>Movement</th><th>Last dispatch</th><th className="text-right">Days since</th><th>Rack</th><th className="text-right">In stock</th><th className="text-right">Reserved</th><th className="text-right">Available</th><th className="text-right">ROL</th><th className="text-right">Avg cost</th><th className="text-right">Value</th></tr></thead>
            <tbody>
              {rows.map((r) => {
                const lowStock = r.stockQty <= r.reorderLevel
                return (
                  <tr key={r.productId}>
                    <td><Link to={`/products/${r.productId}`} className="font-medium hover:text-pipe-700 hover:underline">{r.name}</Link><div className="text-2xs text-ink-faint">{r.code} · {r.brand}</div></td>
                    <td className="text-ink-soft">{r.category}</td>
                    <td><button type="button" onClick={() => setHistoryOf(r.productId)} className="text-left" title="Movement history"><MovementBadge m={r} /></button></td>
                    <td className="whitespace-nowrap text-xs">{r.lastDispatchedAt ? date(r.lastDispatchedAt) : <span className="text-ink-faint">Never</span>}</td>
                    <td className="text-right text-sm"><button type="button" onClick={() => setHistoryOf(r.productId)} className="hover:text-pipe-700 hover:underline"><DaysSince m={r} /></button></td>
                    <td className="text-xs">{r.racks.join(', ') || '—'}</td>
                    <td className="num text-right font-semibold">{qty(r.stockQty)} <span className="text-2xs font-normal text-ink-faint">{r.unit}</span></td>
                    <td className="num text-right text-ink-soft">{r.reservedQty ? qty(r.reservedQty) : '—'}</td>
                    <td className="num text-right">{qty(r.availableQty)}</td>
                    <td className="num text-right">{lowStock ? <Badge tone="danger">{qty(r.reorderLevel)}</Badge> : <span className="text-ink-soft">{qty(r.reorderLevel)}</span>}</td>
                    <td className="num text-right text-ink-soft">{money(r.averageCost)}</td>
                    <td className="num text-right">{money0(r.value)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      <MovementHistoryDrawer productId={historyOf} onClose={() => setHistoryOf(null)} />
    </>
  )
}

const typeLabel: Record<string, string> = { PurchaseIn: 'Purchase', SaleOut: 'Sale', AdjustmentIn: 'Adjustment +', AdjustmentOut: 'Adjustment −', ReturnIn: 'Return', OpeningStock: 'Opening' }

function Movements({ f, set }: { f: F; set: (p: Partial<F>) => void }) {
  const params = { productId: f.productId, type: f.type, from: f.from, to: f.to, page: f.page, pageSize: 50 }
  const { data, isLoading, error } = useQuery({ queryKey: ['stock', 'movements', params], queryFn: () => api.get<Paged<StockMovement>>('/api/admin/stock/movements', params), placeholderData: keepPreviousData })
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Select className="w-48" value={f.type} onChange={(e) => set({ type: e.target.value })} aria-label="Type">
          <option value="">All movements</option>{Object.entries(typeLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </Select>
        <Input className="w-40" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <Input className="w-40" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
        {f.productId && <Button size="sm" variant="ghost" onClick={() => set({ productId: '' })}>Showing one product · clear</Button>}
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No stock movements in this period" /> : (
          <table className="tbl">
            <thead><tr><th>When</th><th>Product</th><th>Type</th><th>Reference</th><th className="text-right">Qty</th><th className="text-right">Balance</th><th>Note</th></tr></thead>
            <tbody>
              {data.items.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-ink-soft">{dateTime(m.createdAt)}</td>
                  <td><button className="text-left font-medium hover:text-pipe-700" onClick={() => set({ productId: String(m.productId) })}>{m.productName}</button><div className="text-2xs text-ink-faint">{m.productCode}</div></td>
                  <td>{typeLabel[m.type] ?? human(m.type)}</td>
                  <td className="text-xs">{m.referenceNo ?? '—'}</td>
                  <td className={`num text-right font-semibold ${m.quantity > 0 ? 'text-leaf-700' : 'text-brick-700'}`}>{m.quantity > 0 ? '+' : ''}{qty(m.quantity)}</td>
                  <td className="num text-right">{qty(m.balanceAfter)}</td>
                  <td className="max-w-xs truncate text-xs text-ink-soft">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
    </>
  )
}

function Statement({ f, set }: { f: F; set: (p: Partial<F>) => void }) {
  const params = { from: f.from, to: f.to, productId: f.productId }
  const { data, isLoading, error } = useQuery({ queryKey: ['stock', 'statement', params], queryFn: () => api.get<{ productId: number; code: string; name: string; opening: number; in: number; out: number; closing: number }[]>('/api/admin/stock/statement', params) })
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input className="w-40" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <Input className="w-40" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
        <span className="text-sm text-ink-soft">Opening + in − out = closing, for {date(f.from)} to {date(f.to)}</span>
      </div>
      <ErrorBox error={error} />
      <div className="card max-h-[70vh] overflow-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="No stock activity in this period" /> : (
          <table className="tbl">
            <thead><tr><th>Product</th><th className="text-right">Opening</th><th className="text-right">In</th><th className="text-right">Out</th><th className="text-right">Closing</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.productId}>
                  <td><div className="font-medium">{r.name}</div><div className="text-2xs text-ink-faint">{r.code}</div></td>
                  <td className="num text-right">{qty(r.opening)}</td>
                  <td className="num text-right text-leaf-700">{r.in ? `+${qty(r.in)}` : '—'}</td>
                  <td className="num text-right text-brick-700">{r.out ? `−${qty(r.out)}` : '—'}</td>
                  <td className="num text-right font-semibold">{qty(r.closing)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function AdjustDrawer({ onClose }: { onClose: () => void }) {
  const [p, setP] = useState<ProductLookup | null>(null)
  const [increase, setIncrease] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [rack, setRack] = useState('')
  const locs = useRackLocations().data ?? []
  const save = useAction(() => api.post('/api/admin/stock/adjust', { productId: p!.id, quantity, isIncrease: increase, reason, rackLocationId: rack ? Number(rack) : undefined }),
    { success: 'Stock adjusted', invalidate: ['stock', 'products', 'dashboard'], onSuccess: onClose })
  return (
    <Drawer open onClose={onClose} title="Adjust stock"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!p || quantity <= 0 || !reason.trim()} onClick={() => save.mutate(undefined)}>Save adjustment</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Use this for physical count corrections, damage or returns. Purchases should be entered under Purchases.</p>
        {p ? (
          <div className="flex items-center justify-between rounded-md bg-pipe-50 p-3 text-sm">
            <div><div className="font-semibold">{p.name}</div><div className="text-ink-soft">{p.code} · {qty(p.stockQty)} {p.unit} in stock</div></div>
            <Button size="sm" variant="ghost" onClick={() => setP(null)}>Change</Button>
          </div>
        ) : <ProductPicker onPick={setP} autoFocus />}
        <div className="grid grid-cols-2 gap-1.5">
          {[false, true].map((inc) => (
            <button key={String(inc)} type="button" onClick={() => setIncrease(inc)}
              className={`rounded-md border py-2 text-sm font-semibold ${increase === inc ? 'border-pipe-600 bg-pipe-50 text-pipe-700' : 'border-line'}`}>{inc ? 'Add stock' : 'Remove stock'}</button>
          ))}
        </div>
        <Field label="Quantity"><NumberInput value={quantity} onChange={setQuantity} /></Field>
        <Field label="Reason"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Physical count 26 Oct, 2 pcs damaged" /></Field>
        {increase && <Field label="Put on rack (optional)">
          <Select value={rack} onChange={(e) => setRack(e.target.value)}><option value="">—</option>{locs.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</Select>
        </Field>}
      </div>
    </Drawer>
  )
}
