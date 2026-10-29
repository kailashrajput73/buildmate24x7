import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, KeyVal, Loading, PageHeader, Pager, SearchBox, Select, Textarea } from '../components/ui'
import { api } from '../lib/api'
import { dateTime, human, srTone } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import type { Paged, PartnerListItem, ServiceRequest, ServiceRequestStatus } from '../lib/types'

const statuses: ServiceRequestStatus[] = ['Pending', 'InProgress', 'Completed', 'Cancelled']

export default function ServiceRequests() {
  const [f, set] = useUrlState({ search: '', serviceType: '', status: '', pincode: '', from: '', to: '', page: 1 })
  const [open, setOpen] = useState<ServiceRequest | null>(null)
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({ queryKey: ['service-requests', params], queryFn: () => api.get<Paged<ServiceRequest>>('/api/admin/service-requests', params), placeholderData: keepPreviousData })

  return (
    <>
      <PageHeader title="Plumber & electrician requests" subtitle="Customers ask for a technician from the website or app. Assign an approved partner and keep the customer updated." />
      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <SearchBox className="lg:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Request no, name, mobile or text" />
        <Select value={f.serviceType} onChange={(e) => set({ serviceType: e.target.value })} aria-label="Service"><option value="">Plumber & electrician</option><option value="Plumber">Plumber</option><option value="Electrician">Electrician</option></Select>
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status"><option value="">Any status</option>{statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}</Select>
        <Input type="date" value={f.from} onChange={(e) => set({ from: e.target.value })} aria-label="From" />
        <Input type="date" value={f.to} onChange={(e) => set({ to: e.target.value })} aria-label="To" />
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No requests" /> : (
          <table className="tbl">
            <thead><tr><th>Request</th><th>Service</th><th>Customer</th><th>Work needed</th><th>Preferred time</th><th>Assigned to</th><th>Status</th></tr></thead>
            <tbody>
              {data.items.map((r) => (
                <tr key={r.id} className="cursor-pointer" onClick={() => setOpen(r)}>
                  <td><div className="font-semibold text-pipe-700">{r.requestNo}</div><div className="text-2xs text-ink-faint">{dateTime(r.createdAt)}</div></td>
                  <td>{r.serviceType}</td>
                  <td><div className="font-medium">{r.contactName}</div><div className="text-2xs text-ink-faint">{r.contactPhone} · {r.pincode}</div></td>
                  <td className="max-w-xs truncate">{r.description}</td>
                  <td className="whitespace-nowrap text-ink-soft">{r.preferredAt ? dateTime(r.preferredAt) : 'Any time'}</td>
                  <td>{r.assignedPartnerName ?? <span className="text-ink-faint">—</span>}</td>
                  <td><Badge tone={srTone[r.status]}>{human(r.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {open && <RequestDrawer req={open} onClose={() => setOpen(null)} />}
    </>
  )
}

function RequestDrawer({ req, onClose }: { req: ServiceRequest; onClose: () => void }) {
  const [status, setStatus] = useState<ServiceRequestStatus>(req.status === 'Pending' ? 'InProgress' : req.status)
  const [partner, setPartner] = useState<{ id: number; name: string } | null>(req.assignedPartnerId ? { id: req.assignedPartnerId, name: req.assignedPartnerName ?? '' } : null)
  const [note, setNote] = useState('')
  const [q, setQ] = useState(req.pincode ?? '')
  const { data: partners } = useQuery({
    queryKey: ['partners', 'assign', req.serviceType, q],
    queryFn: () => api.get<Paged<PartnerListItem>>('/api/admin/partners', { kycStatus: 'Approved', partnerType: req.serviceType, ...(/^\d{6}$/.test(q) ? { pincode: q } : { search: q }), pageSize: 8 }),
  })
  const save = useAction(() => api.put(`/api/admin/service-requests/${req.id}`, { status, assignedPartnerId: partner?.id, note: note || undefined }),
    { success: 'Request updated — the customer has been notified', invalidate: ['service-requests', 'dashboard'], onSuccess: onClose })

  return (
    <Drawer open onClose={onClose} title={`${req.serviceType} request ${req.requestNo}`}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button busy={save.isPending} onClick={() => save.mutate(undefined)}>Save & notify</Button></>}>
      <div className="space-y-4">
        <div>
          <KeyVal k="Customer" v={req.contactName} />
          <KeyVal k="Mobile" v={<a href={`tel:${req.contactPhone}`} className="text-pipe-700 hover:underline">{req.contactPhone}</a>} />
          <KeyVal k="Address" v={[req.address, req.pincode].filter(Boolean).join(', ')} />
          <KeyVal k="Preferred time" v={req.preferredAt ? dateTime(req.preferredAt) : 'Any time'} />
          <p className="mt-2 rounded-md bg-paper p-3 text-sm">{req.description}</p>
        </div>
        <Field label="Status"><Select value={status} onChange={(e) => setStatus(e.target.value as ServiceRequestStatus)}>{statuses.map((s) => <option key={s} value={s}>{human(s)}</option>)}</Select></Field>
        <div>
          <span className="label">Assign a {req.serviceType.toLowerCase()} (approved partners)</span>
          {partner && <div className="mb-2 flex items-center justify-between rounded-md bg-pipe-50 px-3 py-2 text-sm"><b>{partner.name}</b><Button size="sm" variant="ghost" onClick={() => setPartner(null)}>Unassign</Button></div>}
          <SearchBox value={q} onChange={setQ} placeholder="Pincode, name or mobile" />
          <ul className="mt-1 divide-y divide-line rounded-md border border-line">
            {partners?.items.map((p) => (
              <li key={p.userId}><button className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-pipe-50" onClick={() => setPartner({ id: p.userId, name: p.name })}>
                <span>{p.name} <span className="text-ink-faint">· {p.phone}</span></span><span className="text-xs text-ink-soft">{[p.area, p.pincode].filter(Boolean).join(' ')}</span>
              </button></li>
            ))}
            {partners && !partners.items.length && <li className="px-3 py-2 text-sm text-ink-faint">No approved {req.serviceType.toLowerCase()}s found.</li>}
          </ul>
        </div>
        <Field label="Message to the customer (optional)"><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div>
          <span className="label">History</span>
          <ul className="space-y-1 text-sm">{req.history.map((h, i) => <li key={i}><b>{human(h.status)}</b> · {dateTime(h.at)}{h.by && ` · ${h.by}`}{h.note && <div className="text-ink-soft">{h.note}</div>}</li>)}</ul>
        </div>
      </div>
    </Drawer>
  )
}
