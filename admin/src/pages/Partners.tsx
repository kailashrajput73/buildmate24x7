import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, PageHeader, Pager, SearchBox, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { date, human, kycTone, money0, qty } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import { useManagers } from '../lib/masters'
import type { KycStatus, Paged, PartnerDetail, PartnerListItem, PartnerType } from '../lib/types'

export const partnerTypes: PartnerType[] = ['Plumber', 'Electrician', 'Contractor', 'Builder', 'Flooring', 'Other']
const kycTabs: [string, string][] = [['', 'All'], ['Pending', 'KYC to review'], ['Approved', 'Approved'], ['Rejected', 'Rejected'], ['NotSubmitted', 'Not submitted']]

export default function Partners() {
  const nav = useNavigate()
  const { can } = useAuth()
  const [adding, setAdding] = useState(false)
  const [f, set] = useUrlState({ search: '', kycStatus: '', partnerType: '', pincode: '', city: '', managerId: '', sort: '', page: 1 })
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({ queryKey: ['partners', params], queryFn: () => api.get<Paged<PartnerListItem>>('/api/admin/partners', params), placeholderData: keepPreviousData })
  const managers = useManagers().data ?? []

  return (
    <>
      <PageHeader title="Referral partners" subtitle="Plumbers, electricians and contractors who order through the partner app."
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/partners/export', f, 'partners.xlsx')}>Export</Button>
          {can(P.partnersManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setAdding(true)}>Add partner</Button>}
        </>} />
      <div className="mb-3 flex gap-1 overflow-x-auto border-b border-line">
        {kycTabs.map(([k, l]) => (
          <button key={k} onClick={() => set({ kycStatus: k })} className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold ${f.kycStatus === k ? 'border-pipe-600 text-pipe-700' : 'border-transparent text-ink-soft'}`}>{l}</button>
        ))}
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <SearchBox className="lg:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Name, mobile or business" />
        <Select value={f.partnerType} onChange={(e) => set({ partnerType: e.target.value })} aria-label="Type"><option value="">All types</option>{partnerTypes.map((t) => <option key={t}>{t}</option>)}</Select>
        <Input value={f.city} onChange={(e) => set({ city: e.target.value })} placeholder="City / area" aria-label="City" />
        <Input value={f.pincode} onChange={(e) => set({ pincode: e.target.value })} placeholder="Pincode" inputMode="numeric" maxLength={6} aria-label="Pincode" />
        <Select value={f.managerId} onChange={(e) => set({ managerId: e.target.value })} aria-label="Manager"><option value="">Any manager</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No partners match">Partners appear here after they register in the app, or when you add them.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Partner</th><th>Type</th><th>Location</th><th>Manager</th><th>KYC</th>
              <th className="text-right"><button onClick={() => set({ sort: 'purchase' })} className={f.sort === 'purchase' ? 'text-pipe-700' : ''}>Purchases</button></th>
              <th className="text-right"><button onClick={() => set({ sort: 'rewards' })} className={f.sort === 'rewards' ? 'text-pipe-700' : ''}>Points</button></th>
              <th>Joined</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.userId} className="cursor-pointer" onClick={() => nav(`/partners/${p.userId}`)}>
                  <td><Link to={`/partners/${p.userId}`} className="font-semibold hover:text-pipe-700 hover:underline" onClick={(e) => e.stopPropagation()}>{p.name || 'Unnamed'}</Link>
                    <div className="text-2xs text-ink-faint">{p.phone}{p.businessName && ` · ${p.businessName}`}{!p.isActive && ' · disabled'}</div></td>
                  <td>{p.partnerType}</td>
                  <td className="text-ink-soft">{[p.area, p.city].filter(Boolean).join(', ') || '—'}<div className="text-2xs">{p.pincode}</div></td>
                  <td className="text-ink-soft">{p.managerName ?? '—'}</td>
                  <td><Badge tone={kycTone[p.kycStatus as KycStatus]}>{human(p.kycStatus)}</Badge></td>
                  <td className="num text-right">{money0(p.totalPurchase)}<div className="text-2xs text-ink-faint">{p.orderCount} orders</div></td>
                  <td className="num text-right">{qty(p.rewardBalance)}</td>
                  <td className="text-ink-soft">{date(p.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {adding && <AddPartner onClose={() => setAdding(false)} onCreated={(id) => nav(`/partners/${id}`)} />}
    </>
  )
}

export type ProfileForm = {
  name: string; partnerType: PartnerType; businessName?: string; addressLine?: string; area?: string; city?: string; state?: string
  pincode?: string; gstin?: string; email?: string; preferredLanguage?: string; latitude?: number; longitude?: number
}

export function ProfileFields({ v, set }: { v: ProfileForm; set: (v: ProfileForm) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name"><Input value={v.name} onChange={(e) => set({ ...v, name: e.target.value })} /></Field>
      <Field label="Partner type"><Select value={v.partnerType} onChange={(e) => set({ ...v, partnerType: e.target.value as PartnerType })}>{partnerTypes.map((t) => <option key={t}>{t}</option>)}</Select></Field>
      <Field label="Business / shop name"><Input value={v.businessName ?? ''} onChange={(e) => set({ ...v, businessName: e.target.value })} /></Field>
      <Field label="GSTIN"><Input value={v.gstin ?? ''} maxLength={15} onChange={(e) => set({ ...v, gstin: e.target.value.toUpperCase() })} /></Field>
      <Field label="Address" className="sm:col-span-2"><Input value={v.addressLine ?? ''} onChange={(e) => set({ ...v, addressLine: e.target.value })} /></Field>
      <Field label="Area"><Input value={v.area ?? ''} onChange={(e) => set({ ...v, area: e.target.value })} /></Field>
      <Field label="City"><Input value={v.city ?? ''} onChange={(e) => set({ ...v, city: e.target.value })} /></Field>
      <Field label="State"><Input value={v.state ?? ''} onChange={(e) => set({ ...v, state: e.target.value })} /></Field>
      <Field label="Pincode"><Input value={v.pincode ?? ''} inputMode="numeric" maxLength={6} onChange={(e) => set({ ...v, pincode: e.target.value.replace(/\D/g, '') })} /></Field>
      <Field label="Email (optional)"><Input type="email" value={v.email ?? ''} onChange={(e) => set({ ...v, email: e.target.value })} /></Field>
      <Field label="App language"><Select value={v.preferredLanguage ?? 'en'} onChange={(e) => set({ ...v, preferredLanguage: e.target.value })}><option value="en">English</option><option value="hi">हिन्दी</option></Select></Field>
    </div>
  )
}

function AddPartner({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const [phone, setPhone] = useState('')
  const [profile, setProfile] = useState<ProfileForm>({ name: '', partnerType: 'Plumber' })
  const [managerId, setManager] = useState('')
  const [approve, setApprove] = useState(true)
  const { can } = useAuth()
  const managers = useManagers().data ?? []
  const save = useAction(() => api.post<PartnerDetail>('/api/admin/partners', { phone, profile, managerId: managerId ? Number(managerId) : undefined, approveNow: approve && can(P.kyc) }),
    { success: 'Partner added. They can log in to the app with this mobile number.', invalidate: ['partners', 'dashboard'], onSuccess: (p) => onCreated(p.userId) })
  return (
    <Drawer open onClose={onClose} title="Add referral partner" width="max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={save.isPending} disabled={!phone || !profile.name} onClick={() => save.mutate(undefined)}>Add partner</Button></>}>
      <div className="space-y-4">
        <Field label="Mobile number" hint="They'll log in to the partner app with an OTP on this number"><Input autoFocus inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" /></Field>
        <ProfileFields v={profile} set={setProfile} />
        <Field label="Sales manager"><Select value={managerId} onChange={(e) => setManager(e.target.value)}><option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        {can(P.kyc) && <Toggle checked={approve} onChange={setApprove} label="Approve now (I've verified this partner)" />}
      </div>
    </Drawer>
  )
}
