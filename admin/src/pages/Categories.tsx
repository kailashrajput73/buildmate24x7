import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { useState } from 'react'
import ImageUploader from '../components/ImageUploader'
import ImportDialog from '../components/ImportDialog'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, Pager, SearchBox, Select, Textarea, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { useAction, useUrlState } from '../lib/hooks'
import { useCategories } from '../lib/masters'
import type { Category, Paged, SubCategory } from '../lib/types'

export default function Categories() {
  const [f, set] = useUrlState({ tab: 'categories' })
  return (
    <>
      <PageHeader title="Categories" subtitle="Categories and sub categories organise the catalogue on the website and in the app." />
      <div className="mb-4 flex gap-1 border-b border-line">
        {[['categories', 'Categories'], ['subcategories', 'Sub categories']].map(([k, l]) => (
          <button key={k} onClick={() => set({ tab: k })}
            className={`border-b-2 px-3 py-2 text-sm font-semibold ${f.tab === k ? 'border-pipe-600 text-pipe-700' : 'border-transparent text-ink-soft'}`}>{l}</button>
        ))}
      </div>
      {f.tab === 'categories' ? <CategoryList /> : <SubCategoryList />}
    </>
  )
}

function CategoryList() {
  const { can } = useAuth()
  const [search, setSearch] = useState('')
  const [edit, setEdit] = useState<Partial<Category> | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['categories', search], queryFn: () => api.get<Paged<Category>>('/api/admin/categories', { search, pageSize: 200 }) })
  const save = useAction((c: Partial<Category>) => {
    const body = { name: c.name, description: c.description, imageUrl: c.imageUrl, sortOrder: c.sortOrder ?? 0, isActive: c.isActive ?? true }
    return c.id ? api.put(`/api/admin/categories/${c.id}`, body) : api.post('/api/admin/categories', body)
  }, { success: 'Category saved', invalidate: ['categories'], onSuccess: () => setEdit(null) })

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <SearchBox className="w-72" value={search} onChange={setSearch} placeholder="Search categories" />
        {can(P.catalogManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ isActive: true, sortOrder: 0 })}>Add category</Button>}
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No categories yet">Add your first category, e.g. Plumbing or Electrical.</Empty> : (
          <table className="tbl">
            <thead><tr><th /><th>Name</th><th className="text-right">Sub categories</th><th className="text-right">Products</th><th className="text-right">Order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id}>
                  <td className="w-12">{c.imageUrl ? <img src={c.imageUrl} alt="" className="h-9 w-9 rounded border border-line bg-white object-contain" /> : <div className="h-9 w-9 rounded border border-dashed border-line" />}</td>
                  <td><div className="font-semibold">{c.name}</div>{c.description && <div className="text-2xs text-ink-faint">{c.description}</div>}</td>
                  <td className="num text-right">{c.subCategoryCount}</td>
                  <td className="num text-right">{c.productCount}</td>
                  <td className="num text-right">{c.sortOrder}</td>
                  <td>{c.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="text-right">{can(P.catalogManage) && <Button size="sm" variant="ghost" onClick={() => setEdit(c)}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit category' : 'New category'}
          footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Name"><Input autoFocus value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Description"><Textarea value={edit.description ?? ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Display order"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
            <Field label="Image"><ImageUploader folder="categories" max={1} value={edit.imageUrl ? [edit.imageUrl] : []} onChange={(v) => setEdit({ ...edit, imageUrl: v[0] })} /></Field>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active — inactive categories are hidden but keep their history" />
          </div>
        </Drawer>
      )}
    </>
  )
}

function SubCategoryList() {
  const { can } = useAuth()
  const [f, set] = useUrlState({ tab: '', search: '', categoryId: '', page: 1 })
  const [edit, setEdit] = useState<Partial<SubCategory> | null>(null)
  const [importing, setImporting] = useState(false)
  const cats = useCategories().data ?? []
  const params = { search: f.search, categoryId: f.categoryId, page: f.page, pageSize: 50 }
  const { data, isLoading, error } = useQuery({ queryKey: ['subcategories', params], queryFn: () => api.get<Paged<SubCategory>>('/api/admin/subcategories', params), placeholderData: keepPreviousData })
  const save = useAction((s: Partial<SubCategory>) => {
    const body = { categoryId: s.categoryId, name: s.name, sortOrder: s.sortOrder ?? 0, isActive: s.isActive ?? true }
    return s.id ? api.put(`/api/admin/subcategories/${s.id}`, body) : api.post('/api/admin/subcategories', body)
  }, { success: 'Sub category saved', invalidate: ['subcategories', 'categories'], onSuccess: () => setEdit(null) })
  const del = useAction((id: number) => api.del(`/api/admin/subcategories/${id}`), { success: 'Deleted', invalidate: ['subcategories', 'categories'], onSuccess: () => setEdit(null) })

  return (
    <>
      <div className="mb-3 flex flex-wrap justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <SearchBox className="w-64" value={f.search} onChange={(v) => set({ search: v })} placeholder="Search sub categories" />
          <Select className="w-56" value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value })} aria-label="Category">
            <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/subcategories/export', undefined, 'subcategories.xlsx')}>Export</Button>
          {can(P.catalogManage) && <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Import</Button>}
          {can(P.catalogManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ isActive: true, sortOrder: 0, categoryId: Number(f.categoryId) || undefined })}>Add</Button>}
        </div>
      </div>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No sub categories found" /> : (
          <table className="tbl">
            <thead><tr><th>Category</th><th>Sub category</th><th className="text-right">Products</th><th className="text-right">Order</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.items.map((s) => (
                <tr key={s.id}>
                  <td className="text-ink-soft">{s.categoryName}</td>
                  <td className="font-semibold">{s.name}</td>
                  <td className="num text-right">{s.productCount}</td>
                  <td className="num text-right">{s.sortOrder}</td>
                  <td>{s.isActive ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}</td>
                  <td className="text-right">{can(P.catalogManage) && <Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit sub category' : 'New sub category'}
          footer={<>
            {edit.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} busy={del.isPending} disabled={(edit.productCount ?? 0) > 0}
              title={(edit.productCount ?? 0) > 0 ? 'Has products — deactivate instead' : undefined} onClick={() => del.mutate(edit.id!)}>Delete</Button>}
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button>
          </>}>
          <div className="space-y-3">
            <Field label="Category">
              <Select value={edit.categoryId ?? ''} onChange={(e) => setEdit({ ...edit, categoryId: Number(e.target.value) })}>
                <option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </Field>
            <Field label="Name"><Input autoFocus value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Display order"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
          </div>
        </Drawer>
      )}
      <ImportDialog open={importing} onClose={() => setImporting(false)} title="Import sub categories"
        templatePath="/api/admin/subcategories/template" uploadPath="/api/admin/subcategories/import" invalidate={['subcategories', 'categories']}>
        <p className="mb-3 text-sm text-ink-soft">New category names in the sheet are created automatically.</p>
      </ImportDialog>
    </>
  )
}
