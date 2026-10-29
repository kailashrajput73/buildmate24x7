import { useQuery } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Button, Empty, ErrorBox, Input, Loading, PageHeader, Section, Select } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, daysAgoIso, money, money0, moneyShort, qty, todayIso } from '../lib/format'
import { useUrlState } from '../lib/hooks'
import { useBrands, useCategories, useManagers } from '../lib/masters'
import type { NamedValue } from '../lib/types'

const tabs: [string, string][] = [['sales', 'Sales'], ['products', 'Products'], ['partners', 'Partners'], ['categories', 'Categories & brands'], ['purchases', 'Purchases'], ['dispatches', 'Dispatches']]
const presets: [string, string, string][] = [['Last 7 days', daysAgoIso(6), todayIso()], ['Last 30 days', daysAgoIso(29), todayIso()], ['Last 90 days', daysAgoIso(89), todayIso()], ['Last 12 months', daysAgoIso(364), todayIso()]]

export default function Reports() {
  const [f, set] = useUrlState({ tab: 'sales', from: daysAgoIso(29), to: todayIso(), groupBy: 'Day', kind: '', channel: '', categoryId: '', brandId: '', managerId: '', purchaseGroup: 'supplier' })
  const range = { from: f.from, to: f.to }
  return (
    <>
      <PageHeader title="Reports" subtitle="Sales use the payment date. Export any table to Excel." />
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {tabs.map(([k, l]) => <button key={k} onClick={() => set({ tab: k })} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${f.tab === k ? 'border-pipe-600 text-pipe-700' : 'border-transparent text-ink-soft'}`}>{l}</button>)}
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input className="w-40" type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <span className="text-ink-faint">to</span>
        <Input className="w-40" type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
        {presets.map(([l, a, b]) => <Button key={l} size="sm" variant={f.from === a && f.to === b ? 'primary' : 'ghost'} onClick={() => set({ from: a, to: b })}>{l}</Button>)}
      </div>
      {f.tab === 'sales' && <Sales f={f} set={set} range={range} />}
      {f.tab === 'products' && <Products f={f} set={set} range={range} />}
      {f.tab === 'partners' && <Partners f={f} set={set} range={range} />}
      {f.tab === 'categories' && <CatBrand range={range} />}
      {f.tab === 'purchases' && <Purchases f={f} set={set} range={range} />}
      {f.tab === 'dispatches' && <Dispatches range={range} />}
    </>
  )
}

type Props = { f: Record<string, string>; set: (p: Record<string, string>) => void; range: { from: string; to: string } }

function Sales({ f, set, range }: Props) {
  const params = { ...range, groupBy: f.groupBy, kind: f.kind, channel: f.channel }
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'sales', params], queryFn: () => api.get<{ period: string; orders: number; gross: number; discount: number; tax: number; net: number; partnerSales: number; retailSales: number }[]>('/api/admin/reports/sales', params) })
  const total = (k: 'orders' | 'gross' | 'discount' | 'tax' | 'net' | 'partnerSales' | 'retailSales') => (data ?? []).reduce((s, r) => s + r[k], 0)
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select className="w-40" value={f.groupBy} onChange={(e) => set({ groupBy: e.target.value })} aria-label="Group by">
          {['Day', 'Week', 'Month', 'Quarter', 'Year'].map((g) => <option key={g} value={g}>By {g.toLowerCase()}</option>)}
        </Select>
        <Select className="w-44" value={f.kind} onChange={(e) => set({ kind: e.target.value })} aria-label="Customer"><option value="">All customers</option><option value="Partner">Partners</option><option value="Retail">Retail online</option><option value="WalkIn">Walk-in</option></Select>
        <Select className="w-40" value={f.channel} onChange={(e) => set({ channel: e.target.value })} aria-label="Channel"><option value="">All channels</option><option value="App">App</option><option value="Web">Website</option><option value="Store">Counter</option></Select>
        <Button variant="secondary" className="ml-auto" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/reports/sales', { ...params, export: true }, 'sales.xlsx')}>Export</Button>
      </div>
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : !data?.length ? <div className="card"><Empty title="No sales in this period" /></div> : (
        <div className="space-y-4">
          <Section>
            <div className="h-64">
              <ResponsiveContainer>
                <BarChart data={data}>
                  <CartesianGrid vertical={false} stroke="#E6EBF2" />
                  <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#8A96AB' }} tickLine={false} axisLine={false} />
                  <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#8A96AB' }} width={56} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(v: number) => money0(v)} cursor={{ fill: '#EEF4FC' }} />
                  <Bar dataKey="partnerSales" name="Partners" stackId="a" fill="#1A63C7" />
                  <Bar dataKey="retailSales" name="Retail" stackId="a" fill="#2E9B3E" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Section>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Period</th><th className="text-right">Orders</th><th className="text-right">At list price</th><th className="text-right">Discounts</th><th className="text-right">GST</th><th className="text-right">Net sales</th><th className="text-right">Partners</th><th className="text-right">Retail</th></tr></thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.period}><td className="font-medium">{r.period}</td><td className="num text-right">{r.orders}</td><td className="num text-right">{money0(r.gross)}</td><td className="num text-right text-leaf-700">{money0(r.discount)}</td><td className="num text-right">{money0(r.tax)}</td><td className="num text-right font-semibold">{money0(r.net)}</td><td className="num text-right">{money0(r.partnerSales)}</td><td className="num text-right">{money0(r.retailSales)}</td></tr>
                ))}
                <tr className="font-bold"><td>Total</td><td className="num text-right">{total('orders')}</td><td className="num text-right">{money0(total('gross'))}</td><td className="num text-right">{money0(total('discount'))}</td><td className="num text-right">{money0(total('tax'))}</td><td className="num text-right">{money0(total('net'))}</td><td className="num text-right">{money0(total('partnerSales'))}</td><td className="num text-right">{money0(total('retailSales'))}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

function Products({ f, set, range }: Props) {
  const cats = useCategories().data ?? []
  const brands = useBrands().data ?? []
  const params = { ...range, categoryId: f.categoryId, brandId: f.brandId }
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'products', params], queryFn: () => api.get<{ productId: number; code: string; name: string; category: string; brand: string; quantitySold: number; revenue: number; orders: number; averagePrice: number; stockQty: number; margin: number }[]>('/api/admin/reports/products', params) })
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select className="w-48" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Category"><option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Select className="w-48" value={f.brandId} onChange={(e) => set({ brandId: e.target.value })} aria-label="Brand"><option value="">All brands</option>{brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
        <Button variant="secondary" className="ml-auto" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/reports/products', { ...params, export: true }, 'products.xlsx')}>Export</Button>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="No product sales in this period" /> : (
          <table className="tbl">
            <thead><tr><th>Product</th><th>Category</th><th className="text-right">Qty sold</th><th className="text-right">Orders</th><th className="text-right">Avg price</th><th className="text-right">Revenue</th><th className="text-right">Est. margin</th><th className="text-right">Stock now</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.productId}>
                  <td><div className="font-medium">{r.name}</div><div className="text-2xs text-ink-faint">{r.code} · {r.brand}</div></td>
                  <td className="text-ink-soft">{r.category}</td>
                  <td className="num text-right">{qty(r.quantitySold)}</td><td className="num text-right">{r.orders}</td>
                  <td className="num text-right">{money(r.averagePrice)}</td><td className="num text-right font-semibold">{money0(r.revenue)}</td>
                  <td className={`num text-right ${r.margin < 0 ? 'text-brick-700' : ''}`}>{money0(r.margin)}</td><td className="num text-right">{qty(r.stockQty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-faint">Estimated margin = revenue excluding GST − quantity × current average purchase cost.</p>
    </>
  )
}

function Partners({ f, set, range }: Props) {
  const managers = useManagers().data ?? []
  const params = { ...range, managerId: f.managerId }
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'partners', params], queryFn: () => api.get<{ userId: number; name: string; phone?: string; city?: string; manager?: string; orders: number; revenue: number; averageOrderValue: number; pointsEarned: number; lastOrderAt?: string }[]>('/api/admin/reports/partners', params) })
  return (
    <>
      <div className="mb-3 flex flex-wrap gap-2">
        <Select className="w-56" value={f.managerId} onChange={(e) => set({ managerId: e.target.value })} aria-label="Manager"><option value="">All managers</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
        <Button variant="secondary" className="ml-auto" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/reports/partners', { ...params, export: true }, 'partners.xlsx')}>Export</Button>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="No approved partners" /> : (
          <table className="tbl">
            <thead><tr><th>Partner</th><th>City</th><th>Manager</th><th className="text-right">Orders</th><th className="text-right">Revenue</th><th className="text-right">Avg order</th><th className="text-right">Points</th><th>Last order</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.userId} className={r.orders === 0 ? 'text-ink-faint' : ''}>
                  <td><div className="font-medium">{r.name}</div><div className="text-2xs">{r.phone}</div></td><td>{r.city ?? '—'}</td><td>{r.manager ?? '—'}</td>
                  <td className="num text-right">{r.orders}</td><td className="num text-right font-semibold">{money0(r.revenue)}</td><td className="num text-right">{money0(r.averageOrderValue)}</td>
                  <td className="num text-right">{qty(r.pointsEarned)}</td><td>{r.lastOrderAt ? dateTime(r.lastOrderAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

function CatBrand({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'catbrand', range], queryFn: () => api.get<{ categories: NamedValue[]; brands: NamedValue[] }>('/api/admin/reports/category-brand', range) })
  if (isLoading) return <Loading />
  if (error) return <ErrorBox error={error} />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(['categories', 'brands'] as const).map((k) => (
        <Section key={k} title={k === 'categories' ? 'By category' : 'By brand'} pad={false}>
          {!data?.[k].length ? <Empty title="No sales" /> : (
            <table className="tbl">
              <thead><tr><th>{k === 'categories' ? 'Category' : 'Brand'}</th><th className="text-right">Qty</th><th className="text-right">Orders</th><th className="text-right">Revenue</th></tr></thead>
              <tbody>{data[k].map((r) => <tr key={r.id}><td className="font-medium">{r.name}</td><td className="num text-right">{qty(r.quantity)}</td><td className="num text-right">{r.orders}</td><td className="num text-right font-semibold">{money0(r.amount)}</td></tr>)}</tbody>
            </table>
          )}
        </Section>
      ))}
    </div>
  )
}

function Purchases({ f, set, range }: Props) {
  const params = { ...range, groupBy: f.purchaseGroup }
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'purchases', params], queryFn: () => api.get<{ group: string; purchases: number; quantity: number; amount: number }[]>('/api/admin/reports/purchases', params) })
  return (
    <>
      <Select className="mb-3 w-48" value={f.purchaseGroup} onChange={(e) => set({ purchaseGroup: e.target.value })} aria-label="Group by">
        <option value="supplier">By supplier</option><option value="product">By product</option><option value="month">By month</option>
      </Select>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="No purchases in this period" /> : (
          <table className="tbl">
            <thead><tr><th>{f.purchaseGroup === 'product' ? 'Product' : f.purchaseGroup === 'month' ? 'Month' : 'Supplier'}</th><th className="text-right">Purchases</th><th className="text-right">Quantity</th><th className="text-right">Amount</th></tr></thead>
            <tbody>{data.map((r) => <tr key={r.group}><td className="font-medium">{r.group}</td><td className="num text-right">{r.purchases}</td><td className="num text-right">{qty(r.quantity)}</td><td className="num text-right font-semibold">{money0(r.amount)}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </>
  )
}

function Dispatches({ range }: { range: { from: string; to: string } }) {
  const { data, isLoading, error } = useQuery({ queryKey: ['report', 'dispatches', range], queryFn: () => api.get<{ invoiceNo: string; dispatchNo: string; dispatchedAt: string; orderNo: string; customer: string; kind: string; fulfilment: string; amount: number; dispatchedBy?: string }[]>('/api/admin/reports/dispatches', range) })
  return (
    <>
      <div className="mb-3 flex justify-end"><Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/reports/dispatches', { ...range, export: true }, 'dispatches.xlsx')}>Export</Button></div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="Nothing dispatched in this period" /> : (
          <table className="tbl">
            <thead><tr><th>Invoice</th><th>When</th><th>Order</th><th>Customer</th><th>Type</th><th className="text-right">Amount</th><th>By</th></tr></thead>
            <tbody>{data.map((r) => <tr key={r.invoiceNo}><td className="font-semibold">{r.invoiceNo}</td><td className="text-ink-soft">{dateTime(r.dispatchedAt)}</td><td>{r.orderNo}</td><td>{r.customer}</td><td>{r.fulfilment === 'HomeDelivery' ? 'Delivery' : 'Pickup'}</td><td className="num text-right font-semibold">{money(r.amount)}</td><td className="text-ink-soft">{r.dispatchedBy}</td></tr>)}</tbody>
          </table>
        )}
      </div>
    </>
  )
}
