'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Plug, Droplets } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { dateTime } from '@/lib/format'
import { useShop } from '@/lib/shop'
import type { ServiceRequest } from '@/lib/types'

const statusLabel = { Pending: 'Received', InProgress: 'Technician assigned', Completed: 'Completed', Cancelled: 'Cancelled' }

export default function Services() {
  const { user, ready } = useShop()
  const [type, setType] = useState<'Plumber' | 'Electrician'>('Plumber')
  const [form, setForm] = useState({ description: '', contactName: '', contactPhone: '', address: '', pincode: '', preferredAt: '' })
  const [mine, setMine] = useState<ServiceRequest[]>([])
  const [busy, setBusy] = useState(false)
  useEffect(() => { if (user) { setForm((f) => ({ ...f, contactName: user.name, contactPhone: user.phone ?? '' })); api<ServiceRequest[]>('/api/service-requests').then(setMine).catch(() => undefined) } }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api<ServiceRequest>('/api/service-requests', { method: 'POST', body: { serviceType: type, ...form, preferredAt: form.preferredAt ? new Date(`${form.preferredAt}:00+05:30`).toISOString() : undefined } })
      setMine((m) => [r, ...m]); setForm((f) => ({ ...f, description: '' }))
      toast.success(`Request ${r.requestNo} sent. We'll call you shortly.`)
    } catch (err) { toast.error((err as Error).message) } finally { setBusy(false) }
  }
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value })

  return (
    <div className="wrap grid gap-8 py-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <h1 className="text-3xl font-extrabold">Book a plumber or electrician</h1>
        <p className="mt-2 text-ink-soft">We assign a verified technician from our partner network. They'll call to confirm the visit and quote for labour; materials can be picked from our store.</p>
        {!ready ? null : !user ? (
          <div className="mt-6 glass-soft rounded-[22px] p-6"><p className="font-semibold">Log in with your mobile number to book.</p><Link href="/login?next=/services" className="btn-primary mt-3">Log in</Link></div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {([['Plumber', Droplets, 'Leaks, fittings, tanks, bathrooms'], ['Electrician', Plug, 'Wiring, MCB, fans, lights']] as const).map(([t, I, s]) => (
                <button key={t} type="button" onClick={() => setType(t)} className={`rounded-2xl border-2 bg-white/45 p-4 text-left ${type === t ? 'border-pipe-600 bg-pipe-50' : 'border-white/80'}`}>
                  <I className="h-6 w-6 text-pipe-600" /><div className="mt-2 font-bold">{t}</div><div className="text-sm text-ink-soft">{s}</div>
                </button>
              ))}
            </div>
            <label className="block"><span className="label">What needs doing?</span><textarea className="input min-h-[100px]" required minLength={5} value={form.description} onChange={set('description')} placeholder={type === 'Plumber' ? 'e.g. Kitchen sink leaking from below' : 'e.g. Install 2 ceiling fans in bedroom'} /></label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label><span className="label">Contact name</span><input className="input" required value={form.contactName} onChange={set('contactName')} /></label>
              <label><span className="label">Mobile</span><input className="input" required inputMode="numeric" maxLength={10} value={form.contactPhone} onChange={set('contactPhone')} /></label>
              <label className="sm:col-span-2"><span className="label">Address</span><input className="input" required value={form.address} onChange={set('address')} /></label>
              <label><span className="label">Pincode</span><input className="input" required inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} /></label>
              <label><span className="label">Preferred time</span><input type="datetime-local" className="input" value={form.preferredAt} onChange={set('preferredAt')} /></label>
            </div>
            <button className="btn-primary h-12" disabled={busy}>{busy ? 'Sending…' : `Request a ${type.toLowerCase()}`}</button>
          </form>
        )}
      </div>
      <div>
        <h2 className="mb-3 text-xl font-extrabold">Your requests</h2>
        {!mine.length ? <p className="glass-soft rounded-[22px] p-6 text-ink-soft">No requests yet.</p> : (
          <ul className="space-y-3">
            {mine.map((r) => (
              <li key={r.id} className="glass rounded-[22px] p-4 text-sm">
                <div className="flex justify-between gap-2"><b>{r.serviceType} · {r.requestNo}</b><span className="font-semibold text-pipe-700">{statusLabel[r.status]}</span></div>
                <p className="mt-1">{r.description}</p>
                <p className="mt-1 text-xs text-ink-faint">{dateTime(r.createdAt)}</p>
                {r.assignedPartnerName && <p className="mt-2 rounded bg-leaf-50 p-2 text-leaf-700">{r.assignedPartnerName} will visit{r.assignedPartnerPhone && <> · <a href={`tel:${r.assignedPartnerPhone}`} className="font-semibold underline">{r.assignedPartnerPhone}</a></>}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
