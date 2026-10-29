import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Download } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Empty, ErrorBox, Input, Loading, PageHeader, Pager, SearchBox, Select } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, money, orderLabel, orderTone } from '../lib/format'
import { useUrlState } from '../lib/hooks'
import type { OrderListItem, OrderStatus, Paged } from '../lib/types'

const statusTabs: { key: string; label: string }[] = [
  { key: '', label: 'All' },
  { key: 'Paid', label: 'New' },
  { key: 'Processing', label: 'Processing' },
  { key: 'ReadyForPickup', label: 'Ready for pickup' },
  { key: 'OutForDelivery', label: 'Out for delivery' },
  { key: 'Completed', label: 'Completed' },
  { key: 'PendingPayment', label: 'Awaiting payment' },
  { key: 'Cancelled', label: 'Cancelled' },
]

export default function Orders() {
  const nav = useNavigate()
  const [f, set] = useUrlState({ search: '', status: '', channel: '', customerKind: '', fulfilmentType: '', from: '', to: '', page: 1 })
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({
    queryKey: ['orders', params],
    queryFn: () => api.get<Paged<OrderListItem>>('/api/admin/orders', params),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Orders from the partner app, website and counter. New orders refresh every 30 seconds."
        actions={<Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/orders/export', f, 'orders.xlsx')}>Export</Button>}
      />

      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {statusTabs.map((t) => (
          <button key={t.key} onClick={() => set({ status: t.key })}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${f.status === t.key ? 'border-pipe-600 text-pipe-700' : 'border-transparent text-ink-soft hover:text-ink'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <SearchBox className="lg:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Order no, invoice, customer or mobile" />
        <Select value={f.channel} onChange={(e) => set({ channel: e.target.value })} aria-label="Channel">
          <option value="">All channels</option><option value="App">Partner app</option><option value="Web">Website</option><option value="Store">Counter</option>
        </Select>
        <Select value={f.customerKind} onChange={(e) => set({ customerKind: e.target.value })} aria-label="Customer type">
          <option value="">All customers</option><option value="Partner">Referral partners</option><option value="Retail">Retail (online)</option><option value="WalkIn">Walk-in</option>
        </Select>
        <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From date" />
        <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To date" />
      </div>

      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? (
          <Empty title="No orders match these filters">Try another status tab or clear the search.</Empty>
        ) : (
          <table className="tbl">
            <thead>
              <tr><th>Order</th><th>Placed</th><th>Customer</th><th>Channel</th><th>Fulfilment</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Status</th></tr>
            </thead>
            <tbody>
              {data.items.map((o) => (
                <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/orders/${o.id}`)}>
                  <td>
                    <Link to={`/orders/${o.id}`} className="font-semibold text-pipe-700 hover:underline" onClick={(e) => e.stopPropagation()}>{o.orderNo}</Link>
                    {o.invoiceNo && <div className="text-2xs text-ink-faint">{o.invoiceNo}</div>}
                  </td>
                  <td className="whitespace-nowrap text-ink-soft">{dateTime(o.createdAt)}</td>
                  <td className="min-w-[160px]">
                    <div className="font-medium">{o.customerName}</div>
                    <div className="text-2xs text-ink-faint">{[o.customerPhone, o.customerKind === 'Partner' ? 'Partner' : o.customerKind === 'WalkIn' ? 'Walk-in' : 'Retail'].filter(Boolean).join(' · ')}</div>
                  </td>
                  <td>{o.channel === 'App' ? 'App' : o.channel === 'Web' ? 'Website' : 'Counter'}</td>
                  <td className="whitespace-nowrap">
                    {o.fulfilmentType === 'HomeDelivery' ? 'Delivery' : 'Pickup'}
                    {o.scheduledAt && <div className="text-2xs text-ink-faint">{dateTime(o.scheduledAt)}</div>}
                  </td>
                  <td className="num text-right">{o.itemCount}</td>
                  <td className="num text-right font-semibold">
                    {money(o.grandTotal)}
                    {Math.abs(o.balanceDue) > 0.009 && o.status !== 'PendingPayment' && o.status !== 'Cancelled' && (
                      <div className="text-2xs font-normal text-tape-700">{o.balanceDue > 0 ? `${money(o.balanceDue)} to collect` : `${money(-o.balanceDue)} to refund`}</div>
                    )}
                  </td>
                  <td><Badge tone={orderTone[o.status as OrderStatus]}>{orderLabel[o.status as OrderStatus]}</Badge></td>
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
