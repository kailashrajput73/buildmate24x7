import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Drawer, Empty, ErrorBox, Input, KeyVal, Loading, PageHeader, Pager, SearchBox } from '../components/ui'
import { api } from '../lib/api'
import { date, money, qty } from '../lib/format'
import { useUrlState } from '../lib/hooks'
import type { Paged, PurchaseDetail, PurchaseListItem } from '../lib/types'

export default function Purchases() {
  const nav = useNavigate()
  const [f, set] = useUrlState({ search: '', from: '', to: '', page: 1 })
  const [view, setView] = useState<number | null>(null)
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({ queryKey: ['purchases', params], queryFn: () => api.get<Paged<PurchaseListItem>>('/api/admin/purchases', params), placeholderData: keepPreviousData })

  return (
    <>
      <PageHeader title="Purchases" subtitle="Every purchase adds stock immediately and places items on their rack."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/purchases/new')}>New purchase</Button>} />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchBox className="w-72" value={f.search} onChange={(v) => set({ search: v })} placeholder="Purchase no, supplier or bill no" />
        <Input className="w-40" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <Input className="w-40" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? (
          <Empty title="No purchases yet" action={<Button onClick={() => nav('/purchases/new')}>Enter a purchase</Button>}>Enter supplier bills by hand or upload them from Excel.</Empty>
        ) : (
          <table className="tbl">
            <thead><tr><th>Purchase</th><th>Date</th><th>Supplier</th><th>Bill no.</th><th className="text-right">Lines</th><th className="text-right">Qty</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id} className="cursor-pointer" onClick={() => setView(p.id)}>
                  <td className="font-semibold text-pipe-700">{p.purchaseNo}</td>
                  <td>{date(p.purchaseDate)}</td>
                  <td>{p.supplierName ?? '—'}</td>
                  <td className="text-ink-soft">{p.supplierInvoiceNo ?? '—'}</td>
                  <td className="num text-right">{p.itemCount}</td>
                  <td className="num text-right">{qty(p.totalQuantity)}</td>
                  <td className="num text-right font-semibold">{money(p.totalAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {view && <PurchaseView id={view} onClose={() => setView(null)} />}
    </>
  )
}

function PurchaseView({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useQuery({ queryKey: ['purchase', id], queryFn: () => api.get<PurchaseDetail>(`/api/admin/purchases/${id}`) })
  return (
    <Drawer open onClose={onClose} title={data ? `Purchase ${data.purchaseNo}` : 'Purchase'} width="max-w-3xl">
      {!data ? <Loading /> : (
        <>
          <div className="mb-4 grid gap-x-8 sm:grid-cols-2">
            <KeyVal k="Date" v={date(data.purchaseDate)} />
            <KeyVal k="Supplier" v={data.supplierName} />
            <KeyVal k="Supplier GSTIN" v={data.supplierGstin} />
            <KeyVal k="Bill no." v={data.supplierInvoiceNo} />
          </div>
          <table className="tbl">
            <thead><tr><th>Product</th><th className="text-right">Qty</th><th className="text-right">List</th><th className="text-right">Disc.</th><th className="text-right">Net rate</th><th className="text-right">Amount</th><th>Rack</th></tr></thead>
            <tbody>
              {data.items.map((i, n) => (
                <tr key={n}>
                  <td><div className="font-medium">{i.productName}</div><div className="text-2xs text-ink-faint">{i.productCode}</div></td>
                  <td className="num text-right">{qty(i.quantity)}</td>
                  <td className="num text-right">{money(i.listPrice)}</td>
                  <td className="num text-right">{i.purchaseDiscountPercent}%</td>
                  <td className="num text-right">{money(i.netRate)}</td>
                  <td className="num text-right font-semibold">{money(i.lineTotal)}</td>
                  <td className="text-xs">{i.rackLabel ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-3 text-right text-lg font-bold">Total <span className="num">{money(data.totalAmount)}</span></div>
          {data.notes && <p className="mt-3 text-sm text-ink-soft">{data.notes}</p>}
        </>
      )}
    </Drawer>
  )
}
