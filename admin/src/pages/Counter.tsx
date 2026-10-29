import { Trash2, UserRound, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ProductPicker from '../components/ProductPicker'
import { Button, Field, Input, NumberInput, PageHeader, Section } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { money, qty } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { OrderDetail, Paged, PartnerListItem, PaymentMethod, ProductLookup } from '../lib/types'

type Line = { p: ProductLookup; quantity: number; special: number }

/** Walk-in billing: scan items, take cash/UPI/card, print invoice. Stock is deducted on completion. */
export default function Counter() {
  const nav = useNavigate()
  const { can } = useAuth()
  const [lines, setLines] = useState<Line[]>([])
  const [partner, setPartner] = useState<PartnerListItem | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [gstin, setGstin] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CashAtStore')
  const [ref, setRef] = useState('')

  const discountOf = (p: ProductLookup) => (partner ? p.partnerDiscountPercent : p.retailDiscountPercent)
  const rate = (l: Line) => Math.round(l.p.listPrice * (1 - Math.min(100, discountOf(l.p) + l.special) / 100) * 100) / 100
  // the bill is rounded to the rupee, same as the invoice
  const total = useMemo(() => lines.reduce((s, l) => s + Math.round(rate(l) * l.quantity * 100) / 100, 0), [lines, partner]) // eslint-disable-line
  const payable = Math.round(total)

  const add = (p: ProductLookup) => setLines((ls) => {
    const ex = ls.find((l) => l.p.id === p.id)
    return ex ? ls.map((l) => (l.p.id === p.id ? { ...l, quantity: l.quantity + 1 } : l)) : [...ls, { p, quantity: 1, special: 0 }]
  })

  const sell = useAction(() => api.post<OrderDetail>('/api/admin/orders/counter-sale', {
    customerName: name || undefined, customerPhone: phone || undefined, customerGstin: gstin || undefined,
    partnerUserId: partner?.userId, paymentMethod: method, paymentReference: ref || undefined,
    lines: lines.map((l) => ({ productId: l.p.id, quantity: l.quantity, specialDiscountPercent: l.special })),
  }), {
    success: (o) => `Sale complete — invoice ${o.dispatch?.invoiceNo}`,
    invalidate: ['orders', 'dashboard', 'stock'],
    onSuccess: (o) => { setLines([]); setPartner(null); setName(''); setPhone(''); setGstin(''); setRef(''); window.open(`/orders/${o.id}/invoice`, '_blank'); nav(`/orders/${o.id}`) },
  })

  const shortages = lines.filter((l) => l.quantity > l.p.availableQty)

  return (
    <>
      <PageHeader title="Counter billing" subtitle="Scan or search products, take payment, and print the invoice. Stock is deducted when you complete the sale." />
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Section title="Items">
          <ProductPicker onPick={add} autoFocus />
          {lines.length === 0 ? (
            <p className="py-12 text-center text-sm text-ink-soft">Scan the first product to start the bill.</p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Product</th><th className="w-24 text-right">Qty</th>{can(P.specialDiscount) && <th className="w-24 text-right">Extra %</th>}<th className="text-right">Rate</th><th className="text-right">Amount</th><th /></tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.p.id}>
                      <td>
                        <div className="font-medium">{l.p.name}</div>
                        <div className={`text-2xs ${l.quantity > l.p.availableQty ? 'text-brick-700' : 'text-ink-faint'}`}>
                          {l.p.code} · {qty(l.p.availableQty)} {l.p.unit} available{l.p.rackLocations.length ? ` · ${l.p.rackLocations.join(', ')}` : ''}
                        </div>
                      </td>
                      <td><NumberInput className="text-right" value={l.quantity} onChange={(v) => setLines((ls) => ls.map((x) => (x.p.id === l.p.id ? { ...x, quantity: v } : x)))} aria-label="Quantity" /></td>
                      {can(P.specialDiscount) && <td><NumberInput className="text-right" value={l.special} onChange={(v) => setLines((ls) => ls.map((x) => (x.p.id === l.p.id ? { ...x, special: v } : x)))} aria-label="Extra discount" /></td>}
                      <td className="num text-right text-ink-soft">{money(rate(l))}</td>
                      <td className="num text-right font-semibold">{money(rate(l) * l.quantity)}</td>
                      <td><Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.p.id !== l.p.id))} aria-label="Remove"><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <div className="space-y-4">
          <Section title="Customer">
            {partner ? (
              <div className="flex items-start justify-between rounded-md bg-pipe-50 p-3">
                <div><div className="font-semibold">{partner.name}</div><div className="text-sm text-ink-soft">{partner.phone} · partner pricing · earns points</div></div>
                <Button size="sm" variant="ghost" onClick={() => setPartner(null)} aria-label="Remove partner"><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <div className="space-y-3">
                <PartnerLookup onPick={setPartner} />
                <div className="text-center text-2xs text-ink-faint">or bill as a walk-in customer</div>
                <Field label="Name (optional)"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in customer" /></Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Mobile"><Input inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
                  <Field label="GSTIN"><Input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase())} maxLength={15} /></Field>
                </div>
              </div>
            )}
          </Section>

          <Section title="Payment">
            {Math.abs(payable - total) >= 0.005 && (
              <div className="mb-1 flex justify-between text-sm text-ink-soft">
                <span>Items {money(total)} · Round off</span>
                <span className="num">{payable > total ? '+' : '−'}{money(Math.abs(payable - total))}</span>
              </div>
            )}
            <div className="mb-3 flex items-baseline justify-between">
              <span className="text-sm text-ink-soft">To collect (incl. GST)</span>
              <span className="num text-3xl font-display font-bold">{money(payable)}</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['CashAtStore', 'UpiAtStore', 'CardAtStore'] as PaymentMethod[]).map((m) => (
                <button key={m} onClick={() => setMethod(m)}
                  className={`rounded-md border py-2 text-sm font-semibold ${method === m ? 'border-pipe-600 bg-pipe-50 text-pipe-700' : 'border-line'}`}>
                  {m === 'CashAtStore' ? 'Cash' : m === 'UpiAtStore' ? 'UPI' : 'Card'}
                </button>
              ))}
            </div>
            {method !== 'CashAtStore' && <Input className="mt-2" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="Transaction reference (optional)" />}
            {shortages.length > 0 && <p className="mt-3 text-sm text-brick-700">Not enough stock for {shortages.map((s) => s.p.name).join(', ')}.</p>}
            <Button variant="success" className="mt-4 h-11 w-full text-base" busy={sell.isPending}
              disabled={!lines.length || shortages.length > 0 || lines.some((l) => l.quantity <= 0)} onClick={() => sell.mutate(undefined)}>
              Complete sale · {money(payable)}
            </Button>
          </Section>
        </div>
      </div>
    </>
  )
}

function PartnerLookup({ onPick }: { onPick: (p: PartnerListItem) => void }) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<PartnerListItem[]>([])
  useEffect(() => {
    if (q.trim().length < 3) { setRows([]); return }
    const t = setTimeout(() => api.get<Paged<PartnerListItem>>('/api/admin/partners', { search: q, kycStatus: 'Approved', pageSize: 6 }).then((r) => setRows(r.items)).catch(() => setRows([])), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <UserRound className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
      <input className="input pl-8" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find referral partner by mobile or name" aria-label="Find partner" />
      {rows.length > 0 && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border border-line bg-white py-1 shadow-xl">
          {rows.map((p) => (
            <li key={p.userId}><button className="w-full px-3 py-2 text-left text-sm hover:bg-pipe-50" onClick={() => { onPick(p); setQ(''); setRows([]) }}>
              <span className="font-medium">{p.name}</span> <span className="text-ink-faint">· {p.phone} · {p.partnerType}</span>
            </button></li>
          ))}
        </ul>
      )}
    </div>
  )
}
