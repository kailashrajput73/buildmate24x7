import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, KeyVal, Loading, Modal, PageHeader, Pager, SearchBox, Select, Textarea } from '../components/ui'
import { P, useAuth } from '../lib/auth'
import { api } from '../lib/api'
import { dateTime, human, kycTone } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import type { KycStatus, Paged } from '../lib/types'

type CustomerRow = {
  userId: number; name: string; phone?: string | null; createdAt: string; kycStatus: KycStatus; kycSubmittedAt?: string | null
  rewardBalance: number; referralCode?: string | null; documentCount: number
}
type KycDocument = { id: number; documentType: string; documentNumberMasked?: string | null; fileKey: string; uploadedAt: string }
type CustomerDetail = {
  userId: number; name: string; phone?: string | null; email?: string | null; createdAt: string; kycStatus: KycStatus
  kycSubmittedAt?: string | null; kycReviewedAt?: string | null; kycRemarks?: string | null; gstin?: string | null
  rewardBalance: number; referralCode?: string | null; referredByName?: string | null; documents: KycDocument[]
}

const kycLabel: Record<KycStatus, string> = { NotSubmitted: 'Not submitted', Pending: 'Waiting for review', Approved: 'Approved', Rejected: 'Rejected' }

/** Retail customers: KYC documents to review, reward points and Refer & Earn codes. Partners stay on Referral partners. */
export default function Customers() {
  const [f, set] = useUrlState({ search: '', status: '', page: 1 })
  const [openId, setOpenId] = useState<number | null>(null)
  const params = { ...f, pageSize: 25 }
  const { data, isLoading, error } = useQuery({ queryKey: ['customers', params], queryFn: () => api.get<Paged<CustomerRow>>('/api/admin/customers', params), placeholderData: keepPreviousData })

  return (
    <>
      <PageHeader title="Customers" subtitle="Retail customers who signed up on the website or app. Review their KYC documents and manage reward points. Customers waiting for KYC review are listed first." />
      <div className="mb-3 grid gap-2 sm:grid-cols-3">
        <SearchBox className="sm:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Name, mobile or referral code" />
        <Select value={f.status} onChange={(e) => set({ status: e.target.value })} aria-label="KYC status">
          <option value="">Any KYC status</option>
          {(Object.keys(kycLabel) as KycStatus[]).map((s) => <option key={s} value={s}>{kycLabel[s]}</option>)}
        </Select>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No customers found">Customers appear here after they sign up.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Customer</th><th>Joined</th><th>KYC</th><th className="text-right">Documents</th><th className="text-right">Points</th><th>Referral code</th></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.userId} className="cursor-pointer" onClick={() => setOpenId(c.userId)}>
                  <td><div className="font-medium">{c.name || 'No name yet'}</div><div className="text-2xs text-ink-faint">{c.phone}</div></td>
                  <td className="whitespace-nowrap text-ink-soft">{dateTime(c.createdAt)}</td>
                  <td><Badge tone={kycTone[c.kycStatus]}>{kycLabel[c.kycStatus]}</Badge></td>
                  <td className="num text-right">{c.documentCount}</td>
                  <td className="num text-right">{Math.round(c.rewardBalance)}</td>
                  <td className="num">{c.referralCode ?? <span className="text-ink-faint">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {openId != null && <CustomerDrawer id={openId} onClose={() => setOpenId(null)} />}
    </>
  )
}

function CustomerDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { can } = useAuth()
  const { data: c, isLoading, error } = useQuery({ queryKey: ['customers', 'one', id], queryFn: () => api.get<CustomerDetail>(`/api/admin/customers/${id}`) })
  const [decide, setDecide] = useState<null | 'approve' | 'reject'>(null)
  const [points, setPoints] = useState(false)

  return (
    <Drawer open onClose={onClose} title={c ? c.name || 'Customer' : 'Customer'}
      footer={c && (
        <>
          {can(P.rewards) && <Button variant="secondary" onClick={() => setPoints(true)}>Adjust points</Button>}
          {can(P.kyc) && c.documents.length > 0 && c.kycStatus !== 'Rejected' && <Button variant="danger" onClick={() => setDecide('reject')}>Reject KYC</Button>}
          {can(P.kyc) && c.documents.length > 0 && c.kycStatus !== 'Approved' && <Button variant="success" onClick={() => setDecide('approve')}>Approve KYC</Button>}
        </>
      )}>
      <ErrorBox error={error} />
      {isLoading || !c ? <Loading /> : (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <KeyVal k="Mobile" v={c.phone ?? '—'} />
            <KeyVal k="Email" v={c.email ?? '—'} />
            <KeyVal k="Joined" v={dateTime(c.createdAt)} />
            <KeyVal k="KYC" v={<Badge tone={kycTone[c.kycStatus]}>{kycLabel[c.kycStatus]}</Badge>} />
            {c.kycSubmittedAt && <KeyVal k="Submitted" v={dateTime(c.kycSubmittedAt)} />}
            {c.kycReviewedAt && <KeyVal k="Reviewed" v={dateTime(c.kycReviewedAt)} />}
            {c.gstin && <KeyVal k="GSTIN" v={<span className="num">{c.gstin}</span>} />}
            <KeyVal k="Reward points" v={<span className="num">{Math.round(c.rewardBalance)}</span>} />
            <KeyVal k="Referral code" v={c.referralCode ?? '—'} />
            {c.referredByName && <KeyVal k="Invited by" v={c.referredByName} />}
          </div>
          {c.kycRemarks && <p className="rounded-md bg-paper px-3 py-2 text-sm"><b>Remarks:</b> {c.kycRemarks}</p>}
          <div>
            <h3 className="mb-2 text-sm font-semibold">KYC documents</h3>
            {c.documents.length === 0 ? <p className="text-sm text-ink-soft">No documents uploaded yet.</p> : (
              <div className="grid gap-3 sm:grid-cols-2">
                {c.documents.map((d) => <KycDoc key={d.id} userId={c.userId} doc={d} canView={can(P.kyc)} />)}
              </div>
            )}
          </div>
        </div>
      )}
      {c && decide && <KycDialog customer={c} approve={decide === 'approve'} onClose={() => setDecide(null)} />}
      {c && points && <PointsDialog customer={c} onClose={() => setPoints(false)} />}
    </Drawer>
  )
}

function KycDoc({ userId, doc, canView }: { userId: number; doc: KycDocument; canView: boolean }) {
  const [url, setUrl] = useState<string>()
  const isPdf = doc.fileKey.toLowerCase().endsWith('.pdf')
  useEffect(() => {
    if (!canView) return
    let u: string | undefined
    api.objectUrl(`/api/admin/customers/${userId}/kyc/documents/${doc.id}`).then((x) => { u = x; setUrl(x) }).catch(() => undefined)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [userId, doc.id, canView])
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="flex h-40 items-center justify-center bg-paper">
        {!canView ? <span className="text-xs text-ink-faint">Restricted</span> : !url ? <span className="text-xs text-ink-faint">Loading…</span>
          : isPdf ? <a href={url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-pipe-700">Open PDF</a>
          : <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={doc.documentType} className="max-h-40 object-contain" /></a>}
      </div>
      <div className="px-3 py-2 text-sm"><b>{human(doc.documentType)}</b>{doc.documentNumberMasked && <span className="num ml-2 text-ink-soft">{doc.documentNumberMasked}</span>}</div>
    </div>
  )
}

function KycDialog({ customer, approve, onClose }: { customer: CustomerDetail; approve: boolean; onClose: () => void }) {
  const [remarks, setRemarks] = useState('')
  const go = useAction(() => api.post(`/api/admin/customers/${customer.userId}/kyc`, { approve, remarks: remarks || undefined, locationVerified: false }),
    { success: approve ? 'KYC approved — the customer has been notified' : 'KYC rejected — the customer has been told what to fix', invalidate: ['customers'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={approve ? `Approve KYC for ${customer.name}?` : `Reject KYC for ${customer.name}?`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={approve ? 'success' : 'danger'} busy={go.isPending} disabled={!approve && !remarks.trim()} onClick={() => go.mutate(undefined)}>{approve ? 'Approve' : 'Reject'}</Button></>}>
      <Field label={approve ? 'Note (optional)' : 'Reason — the customer sees this'}>
        <Textarea rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={approve ? '' : 'e.g. PAN photo is blurred, please upload again'} />
      </Field>
    </Modal>
  )
}

function PointsDialog({ customer, onClose }: { customer: CustomerDetail; onClose: () => void }) {
  const [points, setPoints] = useState('')
  const [note, setNote] = useState('')
  const n = Number(points)
  const go = useAction(() => api.post(`/api/admin/customers/${customer.userId}/rewards`, { points: n, note }),
    { success: 'Points updated', invalidate: ['customers'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={`Adjust points — ${customer.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={go.isPending} disabled={!n || !note.trim()} onClick={() => go.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-ink-soft">Current balance: <b className="num">{Math.round(customer.rewardBalance)}</b> points. Use a negative number to deduct (write "redeemed" in the note when points are used).</p>
        <Field label="Points (+ add, − deduct)"><Input inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.replace(/[^\d-]/g, ''))} placeholder="e.g. 50 or -20" /></Field>
        <Field label="Note — the customer sees this"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Diwali bonus" /></Field>
      </div>
    </Modal>
  )
}
