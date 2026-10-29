import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { date, dateTime, human, qty } from '../lib/format'
import type { MovementCategory, MovementFields, ProductMovementHistory } from '../lib/types'
import { Badge, Drawer, Empty, ErrorBox, KeyVal, Loading } from './ui'

/**
 * Product movement classification, as worked out by the API (Inventory/ProductMovement.cs):
 * days are India-time calendar days since the last successful dispatch — 0–30 Fast, 31–120 Slow, 121+ Non-moving.
 * Products never dispatched are aged from their first stock receipt and always carry a "Never dispatched" tag,
 * so newly stocked items aren't mistaken for fast sellers.
 */
export const MOVEMENT_LABEL: Record<MovementCategory, string> = { Fast: 'Fast moving', Slow: 'Slow moving', NonMoving: 'Non-moving' }
const TONE = { Fast: 'success', Slow: 'warn', NonMoving: 'danger' } as const

export function MovementBadge({ m }: { m: MovementFields }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={TONE[m.movement]}>{MOVEMENT_LABEL[m.movement]}</Badge>
      {m.neverDispatched && <Badge tone="neutral" className="border border-dashed border-ink-faint/60">Never dispatched</Badge>}
    </span>
  )
}

/** "12 days" since the last dispatch, or since stock was received for never-dispatched products. */
export function DaysSince({ m }: { m: MovementFields }) {
  return (
    <span className="num">
      {m.daysSinceMovement === 0 ? 'Today' : `${m.daysSinceMovement} day${m.daysSinceMovement === 1 ? '' : 's'}`}
      {m.neverDispatched && <span className="block text-2xs font-normal text-ink-faint">since stock received</span>}
    </span>
  )
}

export function MovementSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select className="input w-auto" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Movement">
      <option value="">Any movement</option>
      <option value="Fast">Fast moving (0–30 days)</option>
      <option value="Slow">Slow moving (31–120 days)</option>
      <option value="NonMoving">Non-moving (121+ days)</option>
    </select>
  )
}

/** Product-wise movement history: current class, aging reference and every successful dispatch. */
export function MovementHistoryDrawer({ productId, onClose }: { productId: number | null; onClose: () => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['stock', 'movement', productId],
    queryFn: () => api.get<ProductMovementHistory>(`/api/admin/stock/${productId}/movement`),
    enabled: productId != null,
  })
  return (
    <Drawer open={productId != null} onClose={onClose} title={data ? data.name : 'Movement history'} width="max-w-2xl">
      <ErrorBox error={error} />
      {isLoading || !data ? <Loading /> : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <MovementBadge m={data} />
            <span className="text-sm text-ink-soft">{data.code} · {qty(data.stockQty)} {data.unit} in stock</span>
          </div>
          <div className="card px-4 py-2">
            <KeyVal k="Last successful dispatch" v={data.lastDispatchedAt ? dateTime(data.lastDispatchedAt) : 'Never dispatched'} />
            <KeyVal k={data.neverDispatched ? 'Aged from (first stock receipt)' : 'Days counted from'} v={dateTime(data.movementReferenceAt)} />
            <KeyVal k="Days since movement" v={<DaysSince m={data} />} />
            {data.neverDispatched && !data.firstReceiptAt && <KeyVal k="Note" v="No stock receipt recorded — aged from the date the product was created" />}
            <KeyVal k="Dispatched in last 30 days" v={`${qty(data.qtyLast30Days)} ${data.unit}`} />
            <KeyVal k="Dispatched in last 120 days" v={`${qty(data.qtyLast120Days)} ${data.unit}`} />
          </div>
          <div>
            <div className="mb-2 flex items-baseline justify-between">
              <h3 className="font-bold">Dispatches ({data.dispatchCount})</h3>
              <Link to={`/stock?tab=movements&productId=${data.productId}&from=&to=`} className="text-sm text-pipe-700 hover:underline" onClick={onClose}>All stock in / out</Link>
            </div>
            {!data.dispatches.length ? <Empty title="No dispatches yet">Classified by the age of its stock until its first dispatch.</Empty> : (
              <div className="card overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Dispatched</th><th>Invoice</th><th>Order</th><th>Customer</th><th className="text-right">Qty</th></tr></thead>
                  <tbody>
                    {data.dispatches.map((d) => (
                      <tr key={d.orderId}>
                        <td className="whitespace-nowrap">{date(d.dispatchedAt)}<div className="text-2xs text-ink-faint">{dateTime(d.dispatchedAt).split(', ').pop()}</div></td>
                        <td className="num text-xs">{d.invoiceNo}</td>
                        <td><Link to={`/orders/${d.orderId}`} className="num text-xs text-pipe-700 hover:underline" onClick={onClose}>{d.orderNo}</Link><div className="text-2xs text-ink-faint">{human(d.channel)}</div></td>
                        <td className="text-sm">{d.customer}</td>
                        <td className="num text-right font-semibold">{qty(d.quantity)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}
