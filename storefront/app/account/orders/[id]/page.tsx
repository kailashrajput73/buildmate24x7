'use client'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { returnUrl, startPayment } from '@/lib/cashfree'
import { dateTime, money, statusText, statusTone } from '@/lib/format'
import type { CheckoutResult, OrderDetail } from '@/lib/types'

const steps = ['Paid', 'Processing', 'ReadyForPickup|OutForDelivery', 'Completed']

export default function OrderPage() {
  const { id } = useParams<{ id: string }>()
  const [o, setO] = useState<OrderDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api<OrderDetail>(`/api/orders/${id}`).then(setO).catch((e) => toast.error(e.message))
  useEffect(() => { load() }, [id]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!o) return <p className="text-ink-soft">Loading…</p>

  const stepIndex = o.status === 'Completed' ? 3 : ['ReadyForPickup', 'OutForDelivery'].includes(o.status) ? 2 : o.status === 'Processing' ? 1 : o.status === 'Paid' ? 0 : -1
  const pay = async () => { setBusy(true); try { await startPayment(await api<CheckoutResult>(`/api/orders/${o.id}/pay`, { method: 'POST', body: { returnUrl: returnUrl() } })) } catch (e) { toast.error((e as Error).message); setBusy(false) } }
  const cancel = async () => { if (!confirm('Cancel this order?')) return; setO(await api<OrderDetail>(`/api/orders/${o.id}/cancel`, { method: 'POST' })) }

  return (
    <div>
      <Link href="/account/orders" className="text-sm text-ink-soft hover:text-pipe-700">← My orders</Link>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Order {o.orderNo}</h1>
        <span className={`rounded px-2 py-0.5 text-sm font-semibold ${statusTone(o.status)}`}>{statusText[o.status]}</span>
      </div>
      <p className="text-sm text-ink-soft">Placed {dateTime(o.createdAt)} · {o.fulfilmentType === 'HomeDelivery' ? `Delivery to ${[o.shipLine1, o.shipCity, o.shipPincode].filter(Boolean).join(', ')}` : 'Store pickup'}</p>

      {stepIndex >= 0 && (
        <ol className="my-6 grid grid-cols-4 gap-1" aria-label="Order progress">
          {['Confirmed', 'Packing', o.fulfilmentType === 'HomeDelivery' ? 'On the way' : 'Ready', o.fulfilmentType === 'HomeDelivery' ? 'Delivered' : 'Collected'].map((l, n) => (
            <li key={l} className="text-center text-xs font-semibold">
              <div className={`mb-1.5 h-1.5 rounded-full ${n <= stepIndex ? 'bg-leaf-500' : 'bg-line'}`} />
              <span className={n <= stepIndex ? 'text-ink' : 'text-ink-faint'}>{l}</span>
            </li>
          ))}
        </ol>
      )}
      {o.scheduledAt && stepIndex >= 0 && stepIndex < 3 && <p className="mb-4 rounded-lg bg-pipe-50 p-3 text-sm text-pipe-700">{o.fulfilmentType === 'HomeDelivery' ? 'Delivery' : 'Pickup'} scheduled for <b>{dateTime(o.scheduledAt)}</b></p>}
      {o.status === 'PendingPayment' && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg bg-tape-100 p-4">
          <span className="font-semibold text-tape-700">This order isn't paid yet.</span>
          <div className="flex gap-2"><button className="btn-go" disabled={busy} onClick={pay}>Pay {money(o.grandTotal)}</button><button className="btn-ghost" onClick={cancel}>Cancel order</button></div>
        </div>
      )}
      {o.cancelReason && <p className="mb-4 glass-soft rounded-2xl p-3 text-sm">Cancelled: {o.cancelReason}</p>}

      <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
        {o.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-white bg-white">{i.imageUrl && <img src={i.imageUrl} alt="" className="h-full w-full object-cover" />}</div>
            <div className="min-w-0 flex-1"><Link href={`/p/${i.productId}`} className="font-semibold hover:text-pipe-700">{i.productName}</Link><div className="num text-sm text-ink-soft">{i.purchaseUnit === "Box" ? `${i.purchaseQuantity} box(es) of ${i.packSize}` : `${i.quantity} × ${money(i.unitPrice)}`}</div></div>
            <div className="num font-bold">{money(i.lineTotal)}</div>
          </li>
        ))}
      </ul>
      <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt className="text-ink-soft">Items</dt><dd className="num">{money(o.subTotal - o.discountTotal)}</dd></div>
        {o.shippingFee > 0 && <div className="flex justify-between"><dt className="text-ink-soft">Delivery</dt><dd className="num">{money(o.shippingFee)}</dd></div>}
        <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold"><dt>Total</dt><dd className="num">{money(o.grandTotal)}</dd></div>
        <div className="flex justify-between text-ink-soft"><dt>Paid</dt><dd className="num">{money(o.amountPaid)}</dd></div>
      </dl>
      {o.dispatch && <Link href={`/account/orders/${o.id}/invoice`} className="btn-ghost mt-4">Download invoice {o.dispatch.invoiceNo}</Link>}

      <h2 className="mb-2 mt-8 font-bold">Updates</h2>
      <ol className="space-y-2 text-sm">
        {o.events.slice().reverse().map((e, n) => <li key={n}><b>{e.action}</b>{e.details && <span className="text-ink-soft"> — {e.details}</span>}<div className="text-xs text-ink-faint">{dateTime(e.at)}</div></li>)}
      </ol>
    </div>
  )
}
