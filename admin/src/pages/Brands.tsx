import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import ImageUploader from '../components/ImageUploader'
import { Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, SearchBox, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import type { Brand, Paged } from '../lib/types'

export default function Brands() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Partial<Brand> | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['brands', search], queryFn: () => api.get<Paged<Brand>>('/api/admin/brands', { search, pageSize: 200 }) })
  const save = useAction((b: Partial<Brand>) => {
    const body = { name: b.name, logoUrl: b.logoUrl, sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true }
    return b.id ? api.put(`/api/admin/brands/${b.id}`, body) : api.post('/api/admin/brands', body)
  }, { success: 'Brand saved', invalidate: ['brands'], onSuccess: () => setEdit(null) })
  const toggle = useAction((v: { id: number; value: boolean }) => api.post(`/api/admin/brands/${v.id}/active`, undefined, { value: v.value }), { invalidate: ['brands'] })

  return (
    <>
      <PageHeader title="Brands" subtitle="Partners often search by brand first. Brand logos show on the website and app."
        actions={can(P.catalogManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ isActive: true, sortOrder: 0 })}>Add brand</Button>} />
      <SearchBox className="mb-3 w-72" value={search} onChange={setSearch} placeholder="Search brands" />
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : !data?.items.length ? <div className="card"><Empty title="No brands yet" /></div> : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {data.items.map((b) => (
            <div key={b.id} className={`card flex flex-col p-3 ${b.isActive ? '' : 'opacity-60'}`}>
              <div className="flex h-16 items-center justify-center rounded bg-paper">
                {b.logoUrl ? <img src={b.logoUrl} alt="" className="max-h-12 max-w-[80%] object-contain" /> : <span className="text-lg font-display font-bold text-ink-faint">{b.name}</span>}
              </div>
              <div className="mt-2 flex items-center justify-between">
                <div><div className="font-semibold">{b.name}</div><div className="text-2xs text-ink-faint">{b.productCount} products</div></div>
                {can(P.catalogManage) && <Toggle checked={b.isActive} onChange={(v) => toggle.mutate({ id: b.id, value: v })} />}
              </div>
              {can(P.catalogManage) && <Button size="sm" variant="ghost" className="mt-1 self-start" onClick={() => setEdit(b)}>Edit</Button>}
            </div>
          ))}
        </div>
      )}
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit brand' : 'New brand'}
          footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Brand name"><Input autoFocus value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Display order"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
            <Field label="Logo"><ImageUploader folder="brands" max={1} value={edit.logoUrl ? [edit.logoUrl] : []} onChange={(v) => setEdit({ ...edit, logoUrl: v[0] })} /></Field>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
          </div>
        </Drawer>
      )}
    </>
  )
}
