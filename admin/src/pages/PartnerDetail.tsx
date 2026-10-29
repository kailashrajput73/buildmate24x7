import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, ExternalLink, MapPin, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Drawer, ErrorBox, Field, Input, KeyVal, Loading, Modal, NumberInput, PageHeader, Section, Select, Stat, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { date, dateTime, human, kycTone, money, money0, orderLabel, orderTone, qty } from '../lib/format'
import { useAction } from '../lib/hooks'
import { useManagers } from '../lib/masters'
import type { OrderListItem, Paged, PartnerDetail as PD, RewardTxn } from '../lib/types'
import { ProfileFields, type ProfileForm } from './Partners'

export default function PartnerDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const { data: p, isLoading, error } = useQuery({ queryKey: ['partner', id], queryFn: () => api.get<PD>(`/api/admin/partners/${id}`) })
  const { data: orders } = useQuery({ queryKey: ['orders', { userId: id }], queryFn: () => api.get<Paged<OrderListItem>>('/api/admin/orders', { userId: id, pageSize: 10 }) })
  const { data: rewards } = useQuery({ queryKey: ['partner', id, 'rewards'], queryFn: () => api.get<Paged<RewardTxn>>(`/api/admin/partners/${id}/rewards`) })
  const [dlg, setDlg] = useState<'approve' | 'reject' | 'edit' | 'points' | null>(null)

  if (isLoading) return <Loading />
  if (error || !p) return <ErrorBox error={error} />
  const reviewable = can(P.kyc) && (p.kycStatus === 'Pending' || p.kycStatus === 'Rejected' || p.kycStatus === 'NotSubmitted')

  return (
    <>
      <PageHeader
        back={<Link to="/partners" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-pipe-700"><ArrowLeft className="h-4 w-4" /> Partners</Link>}
        title={p.name || 'Unnamed partner'}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2"><Badge tone={kycTone[p.kycStatus]}>KYC {human(p.kycStatus).toLowerCase()}</Badge>{p.partnerType} · {p.phone}{!p.isActive && <Badge tone="danger">Disabled</Badge>}</span>}
        actions={<>
          {reviewable && <Button variant="success" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => setDlg('approve')}>Approve</Button>}
          {can(P.kyc) && p.kycStatus === 'Pending' && <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setDlg('reject')}>Reject</Button>}
          {can(P.rewards) && <Button variant="secondary" onClick={() => setDlg('points')}>Adjust points</Button>}
          {can(P.partnersManage) && <Button variant="secondary" onClick={() => setDlg('edit')}>Edit profile</Button>}
        </>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total purchases" value={money0(p.stats.totalPurchase)} sub={`${p.stats.orderCount} orders`} />
        <Stat label="Average order" value={money0(p.stats.averageOrderValue)} sub={p.stats.lastOrderAt ? `Last order ${date(p.stats.lastOrderAt)}` : 'No orders yet'} />
        <Stat label="Reward points balance" value={qty(p.rewardBalance)} sub={`${qty(p.stats.pointsEarned)} earned in total`} />
        <Stat label="Partner since" value={date(p.createdAt)} sub={p.lastLoginAt ? `Last seen ${date(p.lastLoginAt)}` : 'Never logged in'} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Section title="KYC documents" actions={p.kycSubmittedAt && <span className="text-xs text-ink-soft">Submitted {dateTime(p.kycSubmittedAt)}</span>}>
            {p.documents.length === 0 ? <p className="text-sm text-ink-faint">No documents uploaded yet.</p> : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {p.documents.map((d) => <KycDoc key={d.id} partnerId={p.userId} doc={d} canView={can(P.kyc)} />)}
              </div>
            )}
            {p.kycReviewedAt && (
              <p className="mt-3 text-sm text-ink-soft">
                {p.kycStatus === 'Approved' ? 'Approved' : 'Reviewed'} by <b>{p.kycReviewedByName}</b> on {dateTime(p.kycReviewedAt)}
                {p.kycRemarks && <> — “{p.kycRemarks}”</>}{p.locationVerified && ' · location verified'}
              </p>
            )}
          </Section>

          <Section title="Recent orders" pad={false} actions={<Link to={`/orders?search=${p.phone ?? ''}`} className="text-xs text-pipe-700 hover:underline">All orders</Link>}>
            {!orders?.items.length ? <p className="p-4 text-sm text-ink-faint">No orders yet.</p> : (
              <table className="tbl">
                <tbody>
                  {orders.items.map((o) => (
                    <tr key={o.id}>
                      <td><Link to={`/orders/${o.id}`} className="font-semibold text-pipe-700 hover:underline">{o.orderNo}</Link><div className="text-2xs text-ink-faint">{dateTime(o.createdAt)}</div></td>
                      <td><Badge tone={orderTone[o.status]}>{orderLabel[o.status]}</Badge></td>
                      <td className="num text-right font-semibold">{money(o.grandTotal)}</td>
                      <td className="num text-right text-leaf-700">{o.rewardPointsEarned > 0 && `+${qty(o.rewardPointsEarned)} pts`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>

          <Section title="Reward points history" pad={false}>
            {!rewards?.items.length ? <p className="p-4 text-sm text-ink-faint">No points yet.</p> : (
              <table className="tbl">
                <thead><tr><th>When</th><th>Type</th><th>Detail</th><th className="text-right">Points</th><th className="text-right">Balance</th></tr></thead>
                <tbody>
                  {rewards.items.map((r) => (
                    <tr key={r.id}>
                      <td className="text-ink-soft">{dateTime(r.createdAt)}</td>
                      <td>{human(r.type)}</td>
                      <td className="text-sm">{r.orderNo ?? r.note}</td>
                      <td className={`num text-right font-semibold ${r.points > 0 ? 'text-leaf-700' : 'text-brick-700'}`}>{r.points > 0 ? '+' : ''}{qty(r.points)}</td>
                      <td className="num text-right">{qty(r.balanceAfter)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Profile">
            <KeyVal k="Business" v={p.businessName} />
            <KeyVal k="GSTIN" v={p.gstin} />
            <KeyVal k="Email" v={p.email} />
            <KeyVal k="Address" v={[p.addressLine, p.area, p.city, p.state, p.pincode].filter(Boolean).join(', ') || '—'} />
            {p.latitude != null && p.longitude != null && (
              <a className="mt-1 inline-flex items-center gap-1 text-sm text-pipe-700 hover:underline" target="_blank" rel="noreferrer"
                href={`https://www.google.com/maps?q=${p.latitude},${p.longitude}`}><MapPin className="h-4 w-4" /> Open shared location <ExternalLink className="h-3 w-3" /></a>
            )}
            <KeyVal k="Sales manager" v={p.managerName} />
            <KeyVal k="Added by" v={p.createdByAdmin ? 'Store team' : 'Self-registered in app'} />
          </Section>
          <Section title="Most bought">
            {p.stats.topProducts.length === 0 ? <p className="text-sm text-ink-faint">Nothing yet.</p> : (
              <ul className="space-y-1.5 text-sm">{p.stats.topProducts.map((t) => (
                <li key={t.id} className="flex justify-between gap-2"><span className="truncate">{t.name}</span><span className="num shrink-0 text-ink-soft">{qty(t.quantity)} · {money0(t.amount)}</span></li>
              ))}</ul>
            )}
          </Section>
        </div>
      </div>

      {(dlg === 'approve' || dlg === 'reject') && <KycDialog partner={p} approve={dlg === 'approve'} onClose={() => setDlg(null)} />}
      {dlg === 'points' && <PointsDialog partner={p} onClose={() => setDlg(null)} />}
      {dlg === 'edit' && <EditDrawer partner={p} onClose={() => setDlg(null)} />}
    </>
  )
}

function KycDoc({ partnerId, doc, canView }: { partnerId: number; doc: PD['documents'][number]; canView: boolean }) {
  const [url, setUrl] = useState<string>()
  const isPdf = doc.fileKey.toLowerCase().endsWith('.pdf')
  useEffect(() => {
    if (!canView) return
    let u: string | undefined
    api.objectUrl(`/api/admin/partners/${partnerId}/kyc/documents/${doc.id}`).then((x) => { u = x; setUrl(x) }).catch(() => undefined)
    return () => { if (u) URL.revokeObjectURL(u) }
  }, [partnerId, doc.id, canView])
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

function KycDialog({ partner, approve, onClose }: { partner: PD; approve: boolean; onClose: () => void }) {
  const [remarks, setRemarks] = useState('')
  const [loc, setLoc] = useState(partner.locationVerified)
  const go = useAction(() => api.post(`/api/admin/partners/${partner.userId}/kyc`, { approve, remarks: remarks || undefined, locationVerified: loc }),
    { success: approve ? 'Partner approved — they have been notified in the app' : 'KYC rejected — the partner has been told what to fix', invalidate: ['partner', 'partners', 'dashboard'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={approve ? `Approve ${partner.name}?` : `Reject KYC for ${partner.name}?`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={approve ? 'success' : 'danger'} busy={go.isPending} disabled={!approve && !remarks.trim()} onClick={() => go.mutate(undefined)}>{approve ? 'Approve' : 'Reject'}</Button></>}>
      <div className="space-y-3">
        {approve && <p className="text-sm text-ink-soft">They'll get partner prices and start earning reward points. Your name is recorded as the approver.</p>}
        <Field label={approve ? 'Note (optional)' : 'What needs fixing? (sent to the partner)'}><Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
        <Toggle checked={loc} onChange={setLoc} label="Shop / site location verified" />
      </div>
    </Modal>
  )
}

function PointsDialog({ partner, onClose }: { partner: PD; onClose: () => void }) {
  const [mode, setMode] = useState<'add' | 'redeem' | 'deduct'>('redeem')
  const [points, setPoints] = useState(0)
  const [note, setNote] = useState('')
  const signed = mode === 'add' ? points : -points
  const go = useAction(() => api.post(`/api/admin/partners/${partner.userId}/rewards`, { points: signed, note: mode === 'redeem' ? `Redeemed: ${note}` : note }),
    { success: 'Points updated', invalidate: ['partner'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title="Adjust reward points"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={go.isPending} disabled={points <= 0 || !note.trim() || (signed < 0 && -signed > partner.rewardBalance)} onClick={() => go.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-3">
        <p className="text-sm">Balance: <b className="num">{qty(partner.rewardBalance)}</b> points</p>
        <div className="grid grid-cols-3 gap-1.5">
          {([['redeem', 'Redeem'], ['add', 'Add'], ['deduct', 'Deduct']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setMode(k)} className={`rounded-md border py-2 text-sm font-semibold ${mode === k ? 'border-pipe-600 bg-pipe-50 text-pipe-700' : 'border-line'}`}>{l}</button>
          ))}
        </div>
        <Field label="Points"><NumberInput value={points} onChange={setPoints} /></Field>
        <Field label={mode === 'redeem' ? 'What was given?' : 'Reason'}><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={mode === 'redeem' ? 'e.g. Diwali gift voucher' : 'e.g. Correction for order BM2610…'} /></Field>
      </div>
    </Modal>
  )
}

function EditDrawer({ partner, onClose }: { partner: PD; onClose: () => void }) {
  const [v, setV] = useState<ProfileForm>({
    name: partner.name, partnerType: partner.partnerType, businessName: partner.businessName, addressLine: partner.addressLine,
    area: partner.area, city: partner.city, state: partner.state, pincode: partner.pincode, gstin: partner.gstin, email: partner.email,
    latitude: partner.latitude, longitude: partner.longitude,
  })
  const [managerId, setManager] = useState(partner.managerId ? String(partner.managerId) : '')
  const [active, setActive] = useState(partner.isActive)
  const managers = useManagers().data ?? []
  const go = useAction(() => api.put(`/api/admin/partners/${partner.userId}`, { profile: v, managerId: managerId ? Number(managerId) : undefined, isActive: active }),
    { success: 'Partner updated', invalidate: ['partner', 'partners'], onSuccess: onClose })
  return (
    <Drawer open onClose={onClose} title="Edit partner" width="max-w-2xl"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button busy={go.isPending} onClick={() => go.mutate(undefined)}>Save</Button></>}>
      <div className="space-y-4">
        <ProfileFields v={v} set={setV} />
        <Field label="Sales manager"><Select value={managerId} onChange={(e) => setManager(e.target.value)}><option value="">—</option>{managers.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</Select></Field>
        <Toggle checked={active} onChange={setActive} label="Account active — disabled partners can't log in" />
      </div>
    </Drawer>
  )
}
