import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import ImageUploader from '../components/ImageUploader'
import ProductPicker from '../components/ProductPicker'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import type { Paged, Product, ProductGroup } from '../lib/types'

type Edit = Partial<ProductGroup> & { products: { id: number; name: string; code: string }[] }

export default function ProductGroups() {
  const { can } = useAuth()
  const [edit, setEdit] = useState<Edit | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['groups'], queryFn: () => api.get<ProductGroup[]>('/api/admin/product-groups') })

  const open = async (g?: ProductGroup) => {
    if (!g) return setEdit({ isActive: true, sortOrder: 0, products: [] })
    // Load names for the products in the group.
    const res = await api.get<Paged<Product>>('/api/admin/products', { groupId: g.id, pageSize: 200 })
    const byId = new Map(res.items.map((p) => [p.id, p]))
    setEdit({ ...g, products: g.productIds.map((id) => byId.get(id)).filter(Boolean).map((p) => ({ id: p!.id, name: p!.name, code: p!.code })) })
  }

  const save = useAction((g: Edit) => {
    const body = { name: g.name, description: g.description, imageUrl: g.imageUrl, sortOrder: g.sortOrder ?? 0, isActive: g.isActive ?? true, productIds: g.products.map((p) => p.id) }
    return g.id ? api.put(`/api/admin/product-groups/${g.id}`, body) : api.post('/api/admin/product-groups', body)
  }, { success: 'Group saved', invalidate: ['groups', 'products'], onSuccess: () => setEdit(null) })
  const del = useAction((id: number) => api.del(`/api/admin/product-groups/${id}`), { success: 'Group deleted', invalidate: ['groups'], onSuccess: () => setEdit(null) })

  return (
    <>
      <PageHeader title="Product groups" subtitle="Bundles of related products — e.g. a bathroom fitting kit — that partners can browse together and that you can feature on the home page."
        actions={can(P.catalogManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => open()}>Add group</Button>} />
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.length ? <Empty title="No product groups yet">Groups need at least two products.</Empty> : (
          <table className="tbl">
            <thead><tr><th>Group</th><th className="text-right">Products</th><th className="text-right">Order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.map((g) => (
                <tr key={g.id}>
                  <td><div className="font-semibold">{g.name}</div>{g.description && <div className="text-2xs text-ink-faint">{g.description}</div>}</td>
                  <td className="num text-right">{g.productCount}</td>
                  <td className="num text-right">{g.sortOrder}</td>
                  <td>{g.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="text-right">{can(P.catalogManage) && <Button size="sm" variant="ghost" onClick={() => open(g)}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit group' : 'New group'} width="max-w-2xl"
          footer={<>
            {edit.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} busy={del.isPending} onClick={() => del.mutate(edit.id!)}>Delete</Button>}
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button>
            <Button busy={save.isPending} disabled={edit.products.length < 2} onClick={() => save.mutate(edit)}>Save</Button>
          </>}>
          <div className="space-y-3">
            <Field label="Name"><Input autoFocus value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Display order"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
              <div className="pt-6"><Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" /></div>
            </div>
            <Field label="Image"><ImageUploader folder="groups" max={1} value={edit.imageUrl ? [edit.imageUrl] : []} onChange={(v) => setEdit({ ...edit, imageUrl: v[0] })} /></Field>
            <div>
              <span className="label">Products ({edit.products.length})</span>
              <ProductPicker placeholder="Add products by name or scan" onPick={(p) => !edit.products.some((x) => x.id === p.id) && setEdit({ ...edit, products: [...edit.products, { id: p.id, name: p.name, code: p.code }] })} />
              <ul className="mt-2 divide-y divide-line rounded-md border border-line">
                {edit.products.map((p) => (
                  <li key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span>{p.name} <span className="text-2xs text-ink-faint">{p.code}</span></span>
                    <button onClick={() => setEdit({ ...edit, products: edit.products.filter((x) => x.id !== p.id) })} aria-label={`Remove ${p.name}`}><X className="h-4 w-4 text-ink-faint" /></button>
                  </li>
                ))}
                {edit.products.length < 2 && <li className="px-3 py-2 text-sm text-ink-faint">Add at least two products.</li>}
              </ul>
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}
