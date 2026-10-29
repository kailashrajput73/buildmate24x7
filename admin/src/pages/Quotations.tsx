import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, KeyVal, Loading, PageHeader, Pager, SearchBox, Select, Textarea } from '../components/ui'
import { P, useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { dateTime, human, money, qty, quoteLabel, quoteTone } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import type { Paged, Quotation, QuotationStatus, QuotationSummary } from '../lib/types'

const statuses: QuotationStatus[] = ['Requested', 'Quoted', 'Accepted', 'Declined', 'Expired', 'Cancelled']

/** Same rule as the API (Pricing.UnitPrice): list price less regular + extra discount, to the paisa. */
const unitPrice = (list: number, disc: number, special: number) => Math.round(list * (1 - Math.min(100, disc + special) / 100) * 100) / 100

export default function Quotations() {
  const [f, set] = useUrlState({ search: '', status: '', page: 1 })
  const [openId, setOpenId] = useState<number | null>(null)
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({ queryKey: ['quotations', params], queryFn: () => api.get<Paged<QuotationSummary>>('/api/admin/quotations', params), placeholderData: keepPreviousData })

  return (
    <>
      <PageHeader title="Quotations" subtitle="Customers and partners ask for your price on their cart. Give an extra discount per item and send it; when they accept, it becomes an order they pay online." />
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <SearchBox className="sm:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Quote no, name or mobile" />
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status">
          <option value="">Any status</option>{statuses.map((s) => <option key={s} value={s}>{quoteLabel[s]}</option>)}
        </Select>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No quotations yet">Requests from the website and app appear here.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Quotation</th><th>Customer</th><th>Pickup / delivery</th><th className="text-right">Items</th><th className="text-right">Regular price</th><th className="text-right">Quoted</th><th>Valid till</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((q) => (
                <tr key={q.id} className="cursor-pointer" onClick={() => setOpenId(q.id)}>
                  <td><div className="font-semibold text-pipe-700">{q.quoteNo}</div><div className="text-2xs text-ink-faint">{dateTime(q.createdAt)}</div></td>
                  <td><div className="font-medium">{q.customerName}</div><div className="text-2xs text-ink-faint">{q.customerPhone} · {q.customerKind === 'Partner' ? 'Partner' : 'Customer'}</div></td>
                  <td>{q.fulfilmentType === 'StorePickup' ? 'Store pickup' : 'Home delivery'}</td>
                  <td className="num text-right">{q.itemCount}</td>
                  <td className="num text-right text-ink-soft">{money(q.subTotal)}</td>
                  <td className="num text-right font-semibold">{q.status === 'Requested' ? <span className="text-ink-faint">—</span> : money(q.grandTotal)}</td>
                  <td className="whitespace-nowrap text-ink-soft">{q.validUntil ? dateTime(q.validUntil) : '—'}</td>
                  <td><Badge tone={quoteTone[q.status]}>{quoteLabel[q.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {openId != null && <QuoteDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

function QuoteDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: q, isLoading } = useQuery({ queryKey: ['quotations', 'one', id], queryFn: () => api.get<Quotation>(`/api/admin/quotations/${id}`) })
  return (
    <Drawer open onClose={onClose} width="max-w-3xl" title={q ? `Quotation ${q.quoteNo}` : 'Quotation'}>
      {isLoading || !q ? <Loading /> : <QuoteBody key={q.id + (q.quotedAt ?? '')} q={q} onClose={onClose} />}
    </Drawer>
  )
}

function QuoteBody({ q, onClose }: { q: Quotation; onClose: () => void }) {
  const { can } = useAuth()
  const editable = ['Requested', 'Quoted', 'Expired'].includes(q.status) && can(P.specialDiscount)
  const [extra, setExtra] = useState<Record<number, string>>(() => Object.fromEntries(q.items.map((i) => [i.id, i.specialDiscountPercent ? String(i.specialDiscountPercent) : ''])))
  const [all, setAll] = useState('')
  const [fee, setFee] = useState(String(q.shippingFee))
  const [days, setDays] = useState('7')
  const [message, setMessage] = useState(q.storeMessage ?? '')
  const [closing, setClosing] = useState(false)
  const [reason, setReason] = useState('')

  const lines = useMemo(() => q.items.map((i) => {
    const s = Number(extra[i.id] || 0)
    const price = unitPrice(i.listPrice, i.discountPercent, s)
    const total = Math.round(price * i.quantity * 100) / 100
    const margin = i.averageCost && price > 0 ? (price - i.averageCost) / price : null
    return { ...i, s, price, total, margin }
  }), [q.items, extra])
  const shipping = q.fulfilmentType === 'StorePickup' ? 0 : Number(fee || 0)
  const exact = Math.round((lines.reduce((t, l) => t + l.total, 0) + shipping) * 100) / 100
  const grand = Math.round(exact)
  const badLine = lines.find((l) => l.s < 0 || l.discountPercent + l.s > 100 || Number.isNaN(l.s))

  const send = useAction(() => api.post(`/api/admin/quotations/${q.id}/price`, {
    lines: lines.map((l) => ({ itemId: l.id, specialDiscountPercent: l.s })), shippingFee: shipping, validDays: Number(days), message: message.trim() || null,
  }), { success: `Price sent to ${q.customerName}`, invalidate: ['quotations', 'dashboard'], onSuccess: onClose })
  const cancel = useAction(() => api.post(`/api/admin/quotations/${q.id}/cancel`, { reason }), { success: 'Quotation closed — the customer was told why', invalidate: ['quotations'], onSuccess: onClose })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <KeyVal k="Customer" v={<>{q.customerName} · <a className="text-pipe-700 hover:underline" href={`tel:${q.customerPhone}`}>{q.customerPhone}</a> · {q.customerKind === 'Partner' ? 'Partner' : 'Customer'}</>} />
          <KeyVal k="Asked on" v={`${dateTime(q.createdAt)} · ${human(q.channel)}`} />
          <KeyVal k={q.fulfilmentType === 'StorePickup' ? 'Store pickup' : 'Deliver to'} v={q.fulfilmentType === 'StorePickup' ? (q.preferredAt ? `Around ${dateTime(q.preferredAt)}` : 'Any time') : q.addressText ?? '—'} />
          {q.quotedAt && <KeyVal k="Quoted" v={`${dateTime(q.quotedAt)}${q.quotedByName ? ` by ${q.quotedByName}` : ''} · valid till ${dateTime(q.validUntil)}`} />}
          {q.orderId && <KeyVal k="Order" v={<Link className="font-semibold text-pipe-700 hover:underline" to={`/orders/${q.orderId}`}>{q.orderNo}</Link>} />}
          {q.cancelReason && <KeyVal k="Closed because" v={q.cancelReason} />}
        </div>
        <Badge tone={quoteTone[q.status]}>{quoteLabel[q.status]}</Badge>
      </div>
      {q.customerNotes && <p className="rounded-lg bg-paper p-3 text-sm"><span className="font-semibold">Customer's note: </span>{q.customerNotes}</p>}

      {editable && (
        <div className="flex flex-wrap items-end gap-2 rounded-lg bg-pipe-50 p-3">
          <Field label="Extra discount on every item (%)" className="w-56"><Input inputMode="decimal" value={all} onChange={(e) => setAll(e.target.value)} placeholder="e.g. 3" /></Field>
          <Button variant="secondary" onClick={() => setExtra(Object.fromEntries(q.items.map((i) => [i.id, all])))} disabled={!all}>Apply to all</Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="tbl">
          <thead><tr><th>Item</th><th className="text-right">Qty</th><th className="text-right">List</th><th className="text-right">Their discount</th><th className="text-right">Extra %</th><th className="text-right">Price</th><th className="text-right">Total</th><th className="text-right">Margin</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="min-w-[220px]"><div className="font-medium">{l.name}</div><div className="text-2xs text-ink-faint">{l.code}{l.availableQty != null && ` · ${qty(l.availableQty)} ${l.unit} in stock`}{l.availableQty != null && l.availableQty < l.quantity && <span className="font-semibold text-brick-700"> · short</span>}</div></td>
                <td className="num text-right">{qty(l.quantity)}</td>
                <td className="num text-right text-ink-soft">{money(l.listPrice)}</td>
                <td className="num text-right text-ink-soft">{l.discountPercent}%</td>
                <td className="text-right">
                  {editable
                    ? <Input className="!w-20 text-right" inputMode="decimal" aria-label={`Extra discount for ${l.name}`} value={extra[l.id]} placeholder="0" onChange={(e) => setExtra((x) => ({ ...x, [l.id]: e.target.value }))} />
                    : <span className="num">{l.specialDiscountPercent}%</span>}
                </td>
                <td className="num text-right">{money(l.price)}</td>
                <td className="num text-right font-semibold">{money(l.total)}</td>
                <td className={`num text-right text-xs ${l.margin != null && l.margin < 0.05 ? 'font-semibold text-brick-700' : 'text-ink-soft'}`}>{l.margin == null ? '—' : `${(l.margin * 100).toFixed(1)}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-3">
          {editable && q.fulfilmentType === 'HomeDelivery' && <Field label="Delivery charge (₹)"><Input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></Field>}
          {editable && <Field label="Price valid for"><Select value={days} onChange={(e) => setDays(e.target.value)}>{[1, 3, 7, 15, 30].map((d) => <option key={d} value={d}>{d === 1 ? 'Today' : `${d} days`}</option>)}</Select></Field>}
          {editable ? <Field label="Message to the customer (optional)" hint="Shown with the price — delivery time, terms, brand substitutions."><Textarea value={message} onChange={(e) => setMessage(e.target.value)} /></Field>
            : q.storeMessage && <p className="rounded-lg bg-paper p-3 text-sm"><span className="font-semibold">Your message: </span>{q.storeMessage}</p>}
        </div>
        <div className="rounded-lg border border-line p-4 text-sm">
          <Row k="Regular price (MRP basis)" v={money(q.subTotal)} />
          <Row k="Discount" v={`− ${money(Math.round((q.subTotal - lines.reduce((t, l) => t + l.total, 0)) * 100) / 100)}`} />
          {q.fulfilmentType === 'HomeDelivery' && <Row k="Delivery" v={money(shipping)} />}
          <Row k="Round off" v={money(Math.round((grand - exact) * 100) / 100)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-line pt-2"><span className="font-semibold">Customer pays</span><span className="num font-display text-2xl font-bold">{money(grand)}</span></div>
          {q.rewardPoints > 0 && <p className="mt-1 text-xs text-ink-soft">Partner earns {qty(q.rewardPoints)} points when it's handed over.</p>}
        </div>
      </div>

      {closing ? (
        <div className="space-y-2 rounded-lg border border-brick-500/30 bg-brick-50 p-3">
          <Field label="Why are you closing it? (the customer sees this)"><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item discontinued — we've called you with an alternative" /></Field>
          <div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setClosing(false)}>Back</Button><Button variant="danger" busy={cancel.isPending} disabled={!reason.trim()} onClick={() => cancel.mutate(undefined)}>Close quotation</Button></div>
        </div>
      ) : (
        <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
          {['Requested', 'Quoted', 'Expired'].includes(q.status) && can(P.ordersManage) && <Button variant="ghost" onClick={() => setClosing(true)}>Close without quoting</Button>}
          {editable && <Button busy={send.isPending} disabled={!!badLine} title={badLine ? `Check the discount for ${badLine.name}` : undefined} onClick={() => send.mutate(undefined)}>
            {q.status === 'Requested' ? `Send price ${money(grand)}` : `Send revised price ${money(grand)}`}
          </Button>}
        </div>
      )}
    </div>
  )
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between py-0.5"><span className="text-ink-soft">{k}</span><span className="num">{v}</span></div>
}
