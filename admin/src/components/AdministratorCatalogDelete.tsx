import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button, ErrorBox, Field, Input, Loading, Modal } from './ui'
import { api } from '../lib/api'
import { useAction } from '../lib/hooks'

type Impact = {
  kind: string; id: number; name: string; productCount: number; orderCount: number; quotationCount: number
  purchaseCount: number; stockMovementCount: number; cartCount: number; wishlistCount: number
  locationCount: number; groupCount: number; currentStock: number; reservedStock: number
  uses: { area: string; reference: string }[]; blockReasons: string[]; canDelete: boolean
}

export default function AdministratorCatalogDelete({ kind, id, label, onClose, onDeleted }: { kind: string; id: number; label: string; onClose: () => void; onDeleted?: () => void }) {
  const [password, setPassword] = useState('')
  const { data, isLoading, error } = useQuery({
    queryKey: ['catalog-delete-preview', kind, id],
    queryFn: () => api.get<Impact>(`/api/admin/catalog-deletion/${kind}/${id}/preview`),
  })
  const remove = useAction<void>(() => api.post(`/api/admin/catalog-deletion/${kind}/${id}/delete`, { password }), {
    success: `${label} deleted`, invalidate: ['products', 'brands', 'categories', 'subcategories', 'catalog-types', 'catalog-families', 'catalog-family-cards'], onSuccess: () => { onDeleted?.(); onClose() },
  })
  return <Modal open onClose={onClose} title={`Administrator delete: ${label}`} footer={<>
    <Button variant="secondary" onClick={onClose}>Cancel</Button>
    <Button variant="danger" busy={remove.isPending} disabled={!data?.canDelete || !password} onClick={() => remove.mutate(undefined)}>Confirm delete</Button>
  </>}>
    <div className="space-y-3 text-sm">
      <p>Review all connected records. Order, quotation, purchase, stock ledger, or nonzero stock usage blocks deletion to preserve business history.</p>
      {isLoading && <Loading />}
      <ErrorBox error={error} />
      {data && <>
        <div className="rounded-lg bg-paper p-3">
          <div className="font-semibold">{data.productCount} product(s) connected</div>
          <div>Orders: {data.orderCount} · Quotes: {data.quotationCount} · Purchases: {data.purchaseCount}</div>
          <div>Stock ledger: {data.stockMovementCount} · Current stock: {data.currentStock} · Reserved: {data.reservedStock}</div>
          <div>Cart: {data.cartCount} · Wishlists: {data.wishlistCount} · Rack locations: {data.locationCount} · Product groups: {data.groupCount}</div>
        </div>
        {!!data.uses.length && <div><p className="mb-1 font-semibold">References and connected data</p><ul className="max-h-40 list-inside list-disc overflow-auto">
          {data.uses.map((x, i) => <li key={`${x.area}-${i}`}><b>{x.area}:</b> {x.reference}</li>)}
        </ul></div>}
        {!!data.blockReasons.length && <div className="rounded border border-brick-500/30 bg-brick-50 p-3 text-brick-700"><b>Deletion blocked</b><ul className="list-inside list-disc">{data.blockReasons.map(x => <li key={x}>{x}</li>)}</ul></div>}
        {data.canDelete && <Field label="Re-enter your Administrator password"><Input type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} /></Field>}
      </>}
    </div>
  </Modal>
}
