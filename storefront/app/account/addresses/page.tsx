'use client'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import AddressForm, { type AddressInput } from '@/components/AddressForm'
import { api } from '@/lib/api'
import type { Address } from '@/lib/types'

export default function Addresses() {
  const [list, setList] = useState<Address[] | null>(null)
  const [edit, setEdit] = useState<Address | 'new' | null>(null)
  const [busy, setBusy] = useState(false)
  const load = () => api<Address[]>('/api/account/addresses').then(setList)
  useEffect(() => { load() }, [])
  const save = async (a: AddressInput) => {
    setBusy(true)
    try { await api(edit === 'new' ? '/api/account/addresses' : `/api/account/addresses/${(edit as Address).id}`, { method: edit === 'new' ? 'POST' : 'PUT', body: a }); setEdit(null); await load(); toast.success('Address saved') }
    catch (e) { toast.error((e as Error).message) } finally { setBusy(false) }
  }
  const del = async (id: number) => { await api(`/api/account/addresses/${id}`, { method: 'DELETE' }); load() }
  return (
    <div>
      <div className="mb-4 flex items-center justify-between"><h1 className="text-2xl font-extrabold">Addresses</h1>{!edit && <button className="btn-primary" onClick={() => setEdit('new')}>Add address</button>}</div>
      {edit ? <AddressForm busy={busy} initial={edit === 'new' ? undefined : edit} onSave={save} onCancel={() => setEdit(null)} /> : !list ? <p className="text-ink-soft">Loading…</p> : !list.length ? <p className="glass-soft rounded-[22px] p-8 text-center text-ink-soft">No saved addresses.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {list.map((a) => (
            <li key={a.id} className="glass rounded-[22px] p-4 text-sm">
              <div className="font-bold">{a.name} {a.isDefault && <span className="ml-1 rounded bg-pipe-50 px-1.5 text-xs text-pipe-700">Default</span>}</div>
              <p className="mt-1 text-ink-soft">{[a.line1, a.line2, a.landmark, a.city, a.state, a.pincode].filter(Boolean).join(', ')}<br />{a.phone}</p>
              <div className="mt-3 flex gap-3"><button className="font-semibold text-pipe-700" onClick={() => setEdit(a)}>Edit</button><button className="text-ink-soft hover:text-brick-700" onClick={() => del(a.id)}>Remove</button></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
