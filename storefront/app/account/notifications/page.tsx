'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { dateTime } from '@/lib/format'
import type { Notification, Paged } from '@/lib/types'

const hrefFor = (link?: string) => link?.startsWith('order:') ? `/account/orders/${link.slice(6)}` : link?.startsWith('quote:') ? `/quotations/${link.slice(6)}` : link?.startsWith('service:') ? '/services' : null

export default function Notifications() {
  const [data, setData] = useState<Paged<Notification> | null>(null)
  useEffect(() => { api<Paged<Notification>>('/api/account/notifications').then((d) => { setData(d); api('/api/account/notifications/read', { method: 'POST' }).catch(() => undefined) }) }, [])
  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">Notifications</h1>
      {!data ? <p className="text-ink-soft">Loading…</p> : !data.items.length ? <p className="glass-soft rounded-[22px] p-8 text-center text-ink-soft">Order and service updates will appear here.</p> : (
        <ul className="glass divide-y divide-line overflow-hidden rounded-[22px]">
          {data.items.map((n) => {
            const href = hrefFor(n.link)
            const body = <><div className={`font-semibold ${n.isRead ? '' : 'text-pipe-700'}`}>{n.title}</div><div className="text-sm text-ink-soft">{n.body}</div><div className="text-xs text-ink-faint">{dateTime(n.createdAt)}</div></>
            return <li key={n.id} className="p-4">{href ? <Link href={href} className="block hover:opacity-80">{body}</Link> : body}</li>
          })}
        </ul>
      )}
    </div>
  )
}
