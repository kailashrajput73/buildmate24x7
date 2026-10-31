import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CalendarClock, FileText, PackageCheck, Pencil, Trash2, Truck, XCircle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import ProductPicker from '../components/ProductPicker'
import { Badge, Button, ErrorBox, Field, Input, KeyVal, Loading, Modal, NumberInput, PageHeader, Section, Select, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { dateTime, human, money, orderLabel, orderTone, payTone, qty } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { FulfilmentType, OrderDetail as O, PaymentMethod, ProductLookup } from '../lib/types'

type EditLine = { purchaseUnit?: "Piece" | "Box"; packSize?: number; productId: number; code: string; name: string; quantity: number; special: number; listPrice: number; discount: number; gst: number; available?: number; isNew: boolean }

export default function OrderDetail() {
  const { id } = useParams()
  const { can } = useAuth()
  const key = ['order', id]
  const { data: o, isLoading, error } = useQuery({ queryKey: key, queryFn: () => api.get<O>(`/api/admin/orders/${id}`) })
  const [editing, setEditing] = useState(false)
  const [dlg, setDlg] = useState<'schedule' | 'dispatch' | 'cancel' | null>(null)

  const inv = ['order', 'orders', 'dashboard']
  const setStatus = useAction((s: string) => api.post<O>(`/api/admin/orders/${id}/status`, { status: s }), { success: 'Status updated', invalidate: inv })
  const delivered = useAction(() => api.post<O>(`/api/admin/orders/${id}/delivered`), { success: 'Marked delivered', invalidate: inv })
  const addNote = useAction((note: string) => api.post<O>(`/api/admin/orders/${id}/notes`, { note }), { success: 'Note added', invalidate: inv })

  if (isLoading) return <Loading />
  if (error || !o) return <ErrorBox error={error} />

  const back = <Link to="/orders" className="mb-1 inline-flex items-center gap-1 text-sm text-ink-soft hover:text-pipe-700"><ArrowLeft className="h-4 w-4" /> Orders</Link>
  const balance = o.balanceDue

  return (
    <>
      <PageHeader
        back={back}
        title={`Order ${o.orderNo}`}
        subtitle={<span className="inline-flex flex-wrap items-center gap-2">
          <Badge tone={orderTone[o.status]}>{orderLabel[o.status]}</Badge>
          <span>{dateTime(o.createdAt)}</span>
          <span>·</span><span>{o.channel === 'App' ? 'Partner app' : o.channel === 'Web' ? 'Website' : 'Counter sale'}</span>
        </span>}
        actions={<>
          {o.dispatch && <Link to={`/orders/${o.id}/invoice`} target="_blank"><Button variant="secondary" icon={<FileText className="h-4 w-4" />}>Invoice {o.dispatch.invoiceNo}</Button></Link>}
          {o.canEdit && can(P.ordersManage) && <Button variant="secondary" icon={<CalendarClock className="h-4 w-4" />} onClick={() => setDlg('schedule')}>Schedule</Button>}
          {o.status === 'Paid' && can(P.ordersManage) && <Button variant="secondary" busy={setStatus.isPending} onClick={() => setStatus.mutate('Processing')}>Start packing</Button>}
          {o.canEdit && o.fulfilmentType === 'StorePickup' && o.status !== 'ReadyForPickup' && can(P.ordersManage) &&
            <Button variant="secondary" icon={<PackageCheck className="h-4 w-4" />} busy={setStatus.isPending} onClick={() => setStatus.mutate('ReadyForPickup')}>Ready for pickup</Button>}
          {o.canDispatch && can(P.dispatch) && !editing && <Button variant="success" icon={<Truck className="h-4 w-4" />} onClick={() => setDlg('dispatch')}>
            {o.fulfilmentType === 'HomeDelivery' ? 'Dispatch' : 'Hand over & invoice'}</Button>}
          {o.status === 'OutForDelivery' && can(P.dispatch) && <Button variant="success" busy={delivered.isPending} onClick={() => delivered.mutate(undefined)}>Mark delivered</Button>}
          {o.canCancel && can(P.ordersManage) && <Button variant="danger" icon={<XCircle className="h-4 w-4" />} onClick={() => setDlg('cancel')}>Cancel</Button>}
        </>}
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {editing ? (
            <ItemEditor order={o} onDone={() => setEditing(false)} />
          ) : (
            <Section title={`Items (${o.items.length})`} pad={false}
              actions={o.canEdit && can(P.dispatch) && <Button size="sm" variant="secondary" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>Edit items</Button>}>
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Product</th><th>Rack</th><th className="text-right">Qty</th><th className="text-right">List</th><th className="text-right">Disc.</th><th className="text-right">Rate</th><th className="text-right">Amount</th></tr></thead>
                  <tbody>
                    {o.items.map((i) => (
                      <tr key={i.id}>
                        <td>
                          <div className="font-medium">{i.productName}</div>
                          <div className="text-2xs text-ink-faint">{i.productCode} · GST {i.gstRate}%{i.addedAtStore && ' · added at store'}</div>
                        </td>
                        <td className="text-xs">{i.rackLocations.join(', ') || '—'}</td>
                        <td className="num text-right font-semibold">{i.purchaseUnit === "Box" ? `${qty(i.purchaseQuantity!)} box(es) × ${qty(i.packSize!)} ${i.baseUnit ?? "units"}` : qty(i.quantity)}</td>
                        <td className="num text-right text-ink-soft">{money(i.listPrice)}</td>
                        <td className="num text-right text-ink-soft">{i.discountPercent}%{i.specialDiscountPercent > 0 && <span className="text-leaf-700"> +{i.specialDiscountPercent}%</span>}</td>
                        <td className="num text-right">{money(i.unitPrice)}</td>
                        <td className="num text-right font-semibold">{money(i.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="ml-auto max-w-xs space-y-0.5 border-t border-line px-4 py-3">
                <KeyVal k="List total" v={<span className="num">{money(o.subTotal)}</span>} />
                <KeyVal k="Discounts" v={<span className="num text-leaf-700">−{money(o.discountTotal)}</span>} />
                {o.shippingFee > 0 && <KeyVal k="Delivery" v={<span className="num">{money(o.shippingFee)}</span>} />}
                <KeyVal k="Includes GST" v={<span className="num text-ink-soft">{money(o.taxTotal)}</span>} />
                <div className="flex justify-between border-t border-line pt-1.5 text-base font-bold"><span>Total</span><span className="num">{money(o.grandTotal)}</span></div>
                <KeyVal k="Paid" v={<span className="num">{money(o.amountPaid)}</span>} />
                {Math.abs(balance) > 0.009 && o.status !== 'PendingPayment' && o.status !== 'Cancelled' && (
                  <div className={`flex justify-between rounded px-2 py-1 text-sm font-semibold ${balance > 0 ? 'bg-tape-100 text-tape-700' : 'bg-pipe-50 text-pipe-700'}`}>
                    <span>{balance > 0 ? 'Collect at counter' : 'Refund due'}</span><span className="num">{money(Math.abs(balance))}</span>
                  </div>
                )}
              </div>
            </Section>
          )}

          <Section title="History">
            <ol className="relative space-y-3 border-l border-line pl-4">
              {o.events.slice().reverse().map((e, n) => (
                <li key={n} className="text-sm">
                  <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-pipe-500" />
                  <div className="font-semibold">{e.action}</div>
                  {e.details && <div className="text-ink-soft">{e.details}</div>}
                  <div className="text-2xs text-ink-faint">{dateTime(e.at)}{e.by && ` · ${e.by}`}</div>
                </li>
              ))}
            </ol>
            <NoteBox onAdd={(n) => addNote.mutate(n)} busy={addNote.isPending} />
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Customer">
            <div className="font-semibold">{o.customerName}</div>
            <div className="text-sm text-ink-soft">{o.customerPhone && <a href={`tel:${o.customerPhone}`} className="hover:underline">{o.customerPhone}</a>}</div>
            <div className="mt-1 flex gap-1.5"><Badge tone={o.customerKind === 'Partner' ? 'info' : 'neutral'}>{o.customerKind === 'Partner' ? 'Referral partner' : o.customerKind === 'WalkIn' ? 'Walk-in' : 'Retail customer'}</Badge></div>
            {o.customerGstin && <KeyVal k="GSTIN" v={o.customerGstin} />}
            {o.customerKind === 'Partner' && o.userId && <Link to={`/partners/${o.userId}`} className="mt-2 inline-block text-sm text-pipe-700 hover:underline">View partner profile</Link>}
            {o.customerNotes && <p className="mt-3 rounded bg-tape-100 px-2 py-1.5 text-sm">“{o.customerNotes}”</p>}
          </Section>

          <Section title={o.fulfilmentType === 'HomeDelivery' ? 'Home delivery' : 'Store pickup'}>
            <KeyVal k="Scheduled for" v={o.scheduledAt ? dateTime(o.scheduledAt) : 'Not scheduled'} />
            {o.fulfilmentType === 'HomeDelivery' && (
              <p className="mt-2 text-sm">{[o.shipLine1, o.shipLine2, o.shipCity, o.shipState, o.shipPincode].filter(Boolean).join(', ')}</p>
            )}
            {o.dispatch && <>
              <div className="my-2 border-t border-line" />
              <KeyVal k="Invoice" v={o.dispatch.invoiceNo} />
              <KeyVal k="Dispatched" v={dateTime(o.dispatch.dispatchedAt)} />
              <KeyVal k="By" v={o.dispatch.dispatchedBy} />
              {o.dispatch.vehicleNo && <KeyVal k="Vehicle" v={o.dispatch.vehicleNo} />}
              {o.dispatch.deliveryPerson && <KeyVal k="Delivery person" v={o.dispatch.deliveryPerson} />}
            </>}
          </Section>

          <Section title="Payments">
            {o.payments.length === 0 ? <p className="text-sm text-ink-faint">No payments yet.</p> : (
              <ul className="space-y-2">
                {o.payments.map((p) => (
                  <li key={p.id} className="flex items-start justify-between gap-2 text-sm">
                    <div><div className="font-medium">{human(p.method).replace('at store', '(counter)')}</div><div className="text-2xs text-ink-faint">{dateTime(p.at)}{p.reference && ` · ${p.reference}`}</div></div>
                    <div className="text-right"><div className="num font-semibold">{money(p.amount)}</div><Badge tone={payTone[p.status]}>{human(p.status)}</Badge></div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {o.customerKind === 'Partner' && (
            <Section title="Reward points">
              <div className="num text-2xl font-display font-bold">{qty(o.rewardPointsEarned)}</div>
              <p className="text-sm text-ink-soft">{o.rewardsCredited ? 'Credited to the partner.' : 'Will be credited when the order is dispatched.'}</p>
            </Section>
          )}
          {o.cancelReason && <Section title="Cancelled"><p className="text-sm">{o.cancelReason}</p></Section>}
        </div>
      </div>

      {dlg === 'schedule' && <ScheduleDialog order={o} onClose={() => setDlg(null)} />}
      {dlg === 'dispatch' && <DispatchDialog order={o} onClose={() => setDlg(null)} />}
      {dlg === 'cancel' && <CancelDialog order={o} onClose={() => setDlg(null)} />}
    </>
  )
}

function NoteBox({ onAdd, busy }: { onAdd: (n: string) => void; busy: boolean }) {
  const [n, setN] = useState('')
  return (
    <form className="mt-4 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (n.trim()) { onAdd(n.trim()); setN('') } }}>
      <Input value={n} onChange={(e) => setN(e.target.value)} placeholder="Add an internal note (customers don't see it)" />
      <Button type="submit" variant="secondary" busy={busy} disabled={!n.trim()}>Add</Button>
    </form>
  )
}

// ---------------------------------------------------------------- Edit items at the counter

function ItemEditor({ order, onDone }: { order: O; onDone: () => void }) {
  const { can } = useAuth()
  const isPartner = order.customerKind === 'Partner'
  const [lines, setLines] = useState<EditLine[]>(() => order.items.map((i) => ({
    purchaseUnit: i.purchaseUnit ?? "Piece", packSize: i.packSize, productId: i.productId, code: i.productCode, name: i.purchaseUnit === "Box" ? `${i.productName} (box of ${i.packSize})` : i.productName, quantity: i.purchaseUnit === "Box" ? i.purchaseQuantity! : i.quantity, special: i.specialDiscountPercent,
    listPrice: i.purchaseUnit === "Box" ? i.boxPrice! : i.listPrice, discount: i.purchaseUnit === "Box" ? 0 : i.discountPercent, gst: i.gstRate, isNew: false,
  })))
  const [shipping, setShipping] = useState(order.shippingFee)
  const [note, setNote] = useState('')

  const add = (p: ProductLookup) => setLines((ls) => {
    const ex = ls.find((l) => l.productId === p.id && l.purchaseUnit !== "Box")
    if (ex) return ls.map((l) => (l.productId === p.id && l.purchaseUnit !== "Box" ? { ...l, quantity: l.quantity + 1 } : l))
    return [...ls, { productId: p.id, code: p.code, name: p.name, quantity: 1, special: 0, listPrice: p.listPrice,
      discount: isPartner ? p.partnerDiscountPercent : p.retailDiscountPercent, gst: p.gstRate, available: p.availableQty, isNew: true }]
  })

  const total = useMemo(() => lines.reduce((s, l) => s + Math.round(l.listPrice * (1 - Math.min(100, l.discount + l.special) / 100) * 100) / 100 * l.quantity, 0) + shipping, [lines, shipping])

  const save = useAction(
    () => api.put<O>(`/api/admin/orders/${order.id}/items`, { lines: lines.map((l) => ({ productId: l.productId, purchaseUnit: l.purchaseUnit ?? "Piece", quantity: l.quantity * (l.purchaseUnit === "Box" ? l.packSize! : 1), specialDiscountPercent: l.special })), shippingFee: shipping, note: note || undefined }),
    { success: 'Order updated', invalidate: ['order', 'orders'], onSuccess: onDone },
  )

  return (
    <Section title="Edit items before handover" actions={<span className="text-xs text-ink-soft">Changes are logged with your name</span>}>
      <ProductPicker onPick={add} autoFocus />
      <div className="mt-3 overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Product</th><th className="w-28 text-right">Qty</th>{can(P.specialDiscount) && <th className="w-28 text-right">Extra disc. %</th>}<th className="text-right">Amount</th><th /></tr></thead>
          <tbody>
            {lines.map((l) => {
              const rate = Math.round(l.listPrice * (1 - Math.min(100, l.discount + l.special) / 100) * 100) / 100
              return (
                <tr key={`${l.productId}:${l.purchaseUnit}`}>
                  <td><div className="font-medium">{l.name}</div><div className="text-2xs text-ink-faint">{l.code} · {money(rate)} each{l.isNew && ' · new'}</div></td>
                  <td><NumberInput className="text-right" value={l.quantity} onChange={(v) => setLines((ls) => ls.map((x) => (x.productId === l.productId && x.purchaseUnit === l.purchaseUnit ? { ...x, quantity: v } : x)))} aria-label={`Quantity for ${l.name}`} /></td>
                  {can(P.specialDiscount) && <td><NumberInput className="text-right" value={l.special} onChange={(v) => setLines((ls) => ls.map((x) => (x.productId === l.productId && x.purchaseUnit === l.purchaseUnit ? { ...x, special: v } : x)))} aria-label={`Extra discount for ${l.name}`} /></td>}
                  <td className="num text-right font-semibold">{money(rate * l.quantity)}</td>
                  <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setLines((ls) => ls.filter((x) => x.productId !== l.productId || x.purchaseUnit !== l.purchaseUnit))} aria-label={`Remove ${l.name}`}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[160px_1fr]">
        <Field label="Delivery fee (₹)"><NumberInput value={shipping} onChange={setShipping} /></Field>
        <Field label="Reason for change (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Customer asked for 2 more elbows at the counter" /></Field>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
        <div className="text-sm">New total <span className="num ml-1 text-lg font-bold">{money(total)}</span>
          {total - order.amountPaid > 0.009 && <span className="ml-2 text-tape-700">({money(total - order.amountPaid)} to collect)</span>}
          {order.amountPaid - total > 0.009 && <span className="ml-2 text-pipe-700">({money(order.amountPaid - total)} to refund)</span>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onDone}>Discard</Button>
          <Button busy={save.isPending} disabled={!lines.length || lines.some((l) => l.quantity <= 0)} onClick={() => save.mutate(undefined)}>Save changes</Button>
        </div>
      </div>
    </Section>
  )
}

// ---------------------------------------------------------------- Dialogs

function toLocalInput(iso?: string) {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600e3)
  return d.toISOString().slice(0, 16)
}
function fromLocalInput(v: string) {
  return v ? new Date(`${v}:00+05:30`).toISOString() : undefined
}

function ScheduleDialog({ order, onClose }: { order: O; onClose: () => void }) {
  const [type, setType] = useState<FulfilmentType>(order.fulfilmentType)
  const [when, setWhen] = useState(toLocalInput(order.scheduledAt))
  const [note, setNote] = useState('')
  const save = useAction(() => api.post<O>(`/api/admin/orders/${order.id}/schedule`, { fulfilmentType: type, scheduledAt: fromLocalInput(when), note }),
    { success: 'Schedule saved — the customer has been notified', invalidate: ['order', 'orders'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title="Schedule pickup or delivery"
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button busy={save.isPending} onClick={() => save.mutate(undefined)}>Save & notify</Button></>}>
      <div className="space-y-3">
        <Field label="How will the customer get it?">
          <Select value={type} onChange={(e) => setType(e.target.value as FulfilmentType)}>
            <option value="StorePickup">Store pickup</option>
            <option value="HomeDelivery" disabled={!order.shipLine1}>Home delivery{!order.shipLine1 && ' (no address on order)'}</option>
          </Select>
        </Field>
        <Field label="Date and time (IST)"><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        <Field label="Message for the customer (optional)"><Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Collect from counter 2" /></Field>
      </div>
    </Modal>
  )
}

function DispatchDialog({ order, onClose }: { order: O; onClose: () => void }) {
  const balance = order.balanceDue
  const [vehicleNo, setVehicle] = useState('')
  const [person, setPerson] = useState('')
  const [notes, setNotes] = useState('')
  const [method, setMethod] = useState<PaymentMethod>('CashAtStore')
  const [ref, setRef] = useState('')
  const delivery = order.fulfilmentType === 'HomeDelivery'
  const go = useAction(() => api.post<O>(`/api/admin/orders/${order.id}/dispatch`, {
    vehicleNo: vehicleNo || undefined, deliveryPerson: person || undefined, notes: notes || undefined,
    balanceCollectedVia: balance > 0.009 ? method : undefined, balanceReference: ref || undefined,
  }), { success: (o) => `Invoice ${o.dispatch?.invoiceNo} created. Stock updated.`, invalidate: ['order', 'orders', 'dashboard', 'stock'], onSuccess: onClose })

  return (
    <Modal open onClose={onClose} title={delivery ? 'Dispatch for delivery' : 'Hand over to customer'}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button variant="success" busy={go.isPending} onClick={() => go.mutate(undefined)}>{delivery ? 'Dispatch & create invoice' : 'Hand over & create invoice'}</Button></>}>
      <div className="space-y-3 text-sm">
        <p className="text-ink-soft">This deducts stock, creates the GST invoice{order.customerKind === 'Partner' && ` and credits ${qty(order.rewardPointsEarned)} reward points`}. It can't be undone.</p>
        {balance > 0.009 && (
          <div className="rounded-md bg-tape-100 p-3">
            <p className="font-semibold text-tape-700">Collect {money(balance)} before handing over</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} aria-label="Payment method">
                <option value="CashAtStore">Cash</option><option value="UpiAtStore">UPI</option><option value="CardAtStore">Card</option>
              </Select>
              <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="UPI / card ref (optional)" />
            </div>
          </div>
        )}
        {balance < -0.009 && <p className="rounded-md bg-pipe-50 p-3 text-pipe-700">The customer paid {money(-balance)} more than the new total. Refund the difference after handover.</p>}
        {delivery && <div className="grid grid-cols-2 gap-2">
          <Field label="Vehicle no."><Input value={vehicleNo} onChange={(e) => setVehicle(e.target.value.toUpperCase())} placeholder="RJ27 AB 1234" /></Field>
          <Field label="Delivery person"><Input value={person} onChange={(e) => setPerson(e.target.value)} /></Field>
        </div>}
        <Field label="Notes (optional)"><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  )
}

function CancelDialog({ order, onClose }: { order: O; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const paidOnline = order.payments.some((p) => p.method === 'Cashfree' && p.status === 'Success')
  const [refund, setRefund] = useState(paidOnline)
  useEffect(() => setRefund(paidOnline), [paidOnline])
  const go = useAction(() => api.post<O>(`/api/admin/orders/${order.id}/cancel`, { reason, refundOnline: refund }),
    { success: 'Order cancelled', invalidate: ['order', 'orders', 'dashboard'], onSuccess: onClose })
  return (
    <Modal open onClose={onClose} title={`Cancel order ${order.orderNo}?`}
      footer={<><Button variant="secondary" onClick={onClose}>Keep order</Button><Button variant="danger" busy={go.isPending} disabled={!reason.trim()} onClick={() => go.mutate(undefined)}>Cancel order</Button></>}>
      <div className="space-y-3">
        <Field label="Reason (sent to the customer)"><Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Item out of stock with supplier" /></Field>
        {paidOnline && <Toggle checked={refund} onChange={setRefund} label={`Refund ${money(order.amountPaid)} to the original payment method via Cashfree`} />}
        <p className="text-xs text-ink-soft">Reserved stock is released immediately.</p>
      </div>
    </Modal>
  )
}
