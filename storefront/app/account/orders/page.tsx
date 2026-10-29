'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { dateTime, money, statusText, statusTone } from '@/lib/format'
import type { OrderSummary, Paged } from '@/lib/types'

export default function MyOrders() {
  const [data, setData] = useState<Paged<OrderSummary> | null>(null)
  const [page, setPage] = useState(1)
  useEffect(() => { api<Paged<OrderSummary>>(`/api/orders?page=${page}`).then(setData).catch(() => undefined) }, [page])
  if (!data) return <p className="text-ink-soft">Loading orders…</p>
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">My orders</h1>
      {!data.items.length ? (
        <div className="glass-soft rounded-[22px] p-10 text-center"><p className="font-semibold">No orders yet.</p><Link href="/products" className="btn-primary mt-4">Start shopping</Link></div>
      ) : (
        <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
          {data.items.map((o) => (
            <li key={o.id}>
              <Link href={`/account/orders/${o.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-white/60">
                <div><div className="font-bold">{o.orderNo}</div><div className="text-sm text-ink-soft">{dateTime(o.createdAt)} · {o.itemCount} items · {o.fulfilmentType === 'HomeDelivery' ? 'Delivery' : 'Store pickup'}</div></div>
                <div className="flex items-center gap-3"><span className={`rounded px-2 py-0.5 text-sm font-semibold ${statusTone(o.status)}`}>{statusText[o.status]}</span><span className="num font-bold">{money(o.grandTotal)}</span></div>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {data.total > data.pageSize && (
        <div className="mt-4 flex justify-center gap-2">
          <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button className="btn-ghost" disabled={page * data.pageSize >= data.total} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
