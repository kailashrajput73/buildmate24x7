import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, PageHeader, SearchBox, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { useAction } from '../lib/hooks'
import type { DeliveryArea, PincodePlace } from '../lib/types'

type Draft = { pincode: string; city: string; district: string; state: string; isActive: boolean }
const empty: Draft = { pincode: '', city: '', district: '', state: '', isActive: true }
const validPin = (v: string) => /^[1-9]\d{5}$/.test(v.trim())

/**
 * Delivery Areas: the serviceable PIN codes. Customers can add to cart, buy and check out with home delivery only
 * when their selected delivery PIN code is listed here and switched on — wherever they are browsing from.
 */
export default function DeliveryAreas() {
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [looking, setLooking] = useState(false)
  const { data, isLoading, error } = useQuery({ queryKey: ['delivery-areas'], queryFn: () => api.get<DeliveryArea[]>('/api/admin/delivery-areas') })

  const add = useAction((d: Draft) => api.post<DeliveryArea>('/api/admin/delivery-areas', {
    pincode: d.pincode.trim(), city: d.city.trim() || null, district: d.district.trim() || null, state: d.state.trim() || null, isActive: d.isActive,
  }), { success: (a) => `${(a as DeliveryArea).pincode} added`, invalidate: ['delivery-areas', 'settings'], onSuccess: () => setDraft(null) })
  const toggle = useAction((v: { pincode: string; isActive: boolean }) => api.put(`/api/admin/delivery-areas/${v.pincode}`, { isActive: v.isActive }),
    { invalidate: ['delivery-areas', 'settings'] })
  const remove = useAction((pincode: string) => api.del(`/api/admin/delivery-areas/${pincode}`),
    { success: 'PIN code removed', invalidate: ['delivery-areas', 'settings'] })

  const lookup = async (pin: string) => {
    if (!validPin(pin)) return
    setLooking(true)
    try {
      const p = await api.get<PincodePlace>(`/api/admin/delivery-areas/lookup/${pin.trim()}`)
      setDraft((d) => d && d.pincode.trim() === pin.trim()
        ? { ...d, city: d.city || p.city || '', district: d.district || p.district || '', state: d.state || p.state || '' }
        : d)
    } catch { /* Lookup is only a convenience; the fields can be typed in. */ }
    finally { setLooking(false) }
  }

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data ?? []).filter((a) => !q || [a.pincode, a.city, a.district, a.state].some((v) => v?.toLowerCase().includes(q)))
  }, [data, search])
  const activeCount = (data ?? []).filter((a) => a.isActive).length

  return (
    <>
      <PageHeader title="Delivery areas"
        subtitle={<>Serviceable PIN codes. Customers anywhere can shop, but Add to Cart, Buy Now and home-delivery checkout work only for an <b>active</b> PIN code in this list. Empty list = no deliveries.</>}
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...empty })}>Add PIN code</Button>} />
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <SearchBox className="w-72" value={search} onChange={setSearch} placeholder="Search PIN, city, district, state" />
        {data && <span className="text-sm text-ink-soft">{activeCount} active of {data.length}</span>}
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !rows.length ? (
          <Empty title={data?.length ? 'No PIN code matches' : 'No serviceable PIN codes yet'}
            action={!data?.length && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setDraft({ ...empty })}>Add PIN code</Button>}>
            {!data?.length && 'Until you add PIN codes, customers cannot order home delivery.'}
          </Empty>
        ) : (
          <table className="tbl">
            <thead><tr><th>PIN code</th><th>City</th><th>District</th><th>State</th><th>Status</th><th className="text-right">Actions</th></tr></thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.pincode} className={a.isActive ? '' : 'opacity-70'}>
                  <td className="num font-semibold">{a.pincode}</td>
                  <td>{a.city ?? <span className="text-ink-faint">—</span>}</td>
                  <td>{a.district ?? <span className="text-ink-faint">—</span>}</td>
                  <td>{a.state ?? <span className="text-ink-faint">—</span>}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Toggle checked={a.isActive} onChange={(v) => toggle.mutate({ pincode: a.pincode, isActive: v })} />
                      <Badge tone={a.isActive ? 'success' : 'neutral'}>{a.isActive ? 'Serviceable' : 'Disabled'}</Badge>
                    </div>
                  </td>
                  <td className="text-right">
                    <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} aria-label={`Remove ${a.pincode}`}
                      onClick={() => { if (confirm(`Remove ${a.pincode}? Customers there will no longer be able to order home delivery.`)) remove.mutate(a.pincode) }}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {draft && (
        <Drawer open onClose={() => setDraft(null)} title="Add serviceable PIN code"
          footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
            <Button busy={add.isPending} disabled={!validPin(draft.pincode)} onClick={() => add.mutate(draft)}>Add</Button></>}>
          <div className="space-y-3">
            <Field label="PIN code" hint={looking ? 'Looking up city, district and state…' : 'City, district and state fill in automatically where known.'}
              error={draft.pincode && !validPin(draft.pincode) ? 'Enter a 6-digit PIN code' : undefined}>
              <Input autoFocus inputMode="numeric" maxLength={6} value={draft.pincode} placeholder="370421"
                onChange={(e) => {
                  const pin = e.target.value.replace(/\D/g, '').slice(0, 6)
                  setDraft({ ...draft, pincode: pin })
                  if (validPin(pin)) void lookup(pin)
                }} />
            </Field>
            <Field label="City / area"><Input value={draft.city} onChange={(e) => setDraft({ ...draft, city: e.target.value })} /></Field>
            <Field label="District"><Input value={draft.district} onChange={(e) => setDraft({ ...draft, district: e.target.value })} placeholder="Kachchh" /></Field>
            <Field label="State"><Input value={draft.state} onChange={(e) => setDraft({ ...draft, state: e.target.value })} placeholder="Gujarat" /></Field>
            <Toggle checked={draft.isActive} onChange={(v) => setDraft({ ...draft, isActive: v })} label="Serviceable (active)" />
          </div>
        </Drawer>
      )}
    </>
  )
}
