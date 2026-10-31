import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, Plus, Upload } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import ImportDialog from '../components/ImportDialog'
import { DaysSince, MovementBadge, MovementHistoryDrawer, MovementSelect } from '../components/Movement'
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Pager, SearchBox, Input, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { money, qty } from '../lib/format'
import { useAction, useUrlState } from '../lib/hooks'
import { useBrands, useCategories, useGroups, useProductTypes, useFamilies, useSubCategories } from '../lib/masters'
import type { Paged, Product } from '../lib/types'

export default function Products() {
  const nav = useNavigate()
  const { can } = useAuth()
  const [importing, setImporting] = useState(false)
  const [createMasters, setCreateMasters] = useState(false)
  const [f, set] = useUrlState({ search: '', categoryId: '', typeId: '', subCategoryId: '', class: '', familyId: '', size: '', length: '', brandId: '', groupId: '', isActive: '', lowStockOnly: false, movement: '', sort: '', page: 1 })
  const [selected, select] = useState<number[]>([])
  const types = useProductTypes(Number(f.categoryId) || undefined).data ?? []
  const families = useFamilies(Number(f.categoryId) || undefined, Number(f.brandId) || undefined).data ?? []
  const subs = useSubCategories(Number(f.categoryId) || undefined).data ?? []
  const params = { ...f, lowStockOnly: f.lowStockOnly || undefined, movement: f.movement || undefined, pageSize: 25 }
  const [historyOf, setHistoryOf] = useState<number | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['products', params], queryFn: () => api.get<Paged<Product>>('/api/admin/products', params), placeholderData: keepPreviousData })
  const cats = useCategories().data ?? []
  const brands = useBrands().data ?? []
  const groups = useGroups().data ?? []
  const toggle = useAction((v: { id: number; value: boolean }) => api.post(`/api/admin/products/${v.id}/active`, undefined, { value: v.value }), { invalidate: ['products'] })

  return (
    <>
      <PageHeader title="Products"
        subtitle="One catalogue for the website, the partner app and the counter."
        actions={<>
          <Button variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/products/export', f, 'products.xlsx')}>Export filtered</Button>
          <Button variant="secondary" onClick={() => api.download('/api/admin/products/export', {}, 'all-products.xlsx')}>Export all</Button>
          <Button variant="secondary" disabled={!selected.length} onClick={() => api.download('/api/admin/products/export', { ids: selected.join(',') }, 'selected-products.xlsx')}>Export selected ({selected.length})</Button>
          <Link to="/catalog-structure" className="text-sm text-pipe-700">Types & family images</Link>
          {can(P.catalogManage) && <Button variant="secondary" icon={<Upload className="h-4 w-4" />} onClick={() => setImporting(true)}>Import</Button>}
          {can(P.catalogManage) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => nav('/products/new')}>Add product</Button>}
        </>}
      />

      <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <SearchBox className="lg:col-span-2" value={f.search} onChange={(v) => set({ search: v })} placeholder="Name, code, barcode or local name" />
        <Select value={f.categoryId} onChange={(e) => set({ categoryId: e.target.value, typeId: '', subCategoryId: '', familyId: '', class: '', size: '', length: '', page: 1 })} aria-label="Category">
          <option value="">All categories</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </Select>
        <Select value={f.brandId} onChange={(e) => set({ brandId: e.target.value })} aria-label="Brand">
          <option value="">All brands</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
        <Select value={f.groupId} onChange={(e) => set({ groupId: e.target.value })} aria-label="Group">
          <option value="">All groups</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </Select>
        <div className="flex items-center gap-3">
          <Select value={f.isActive} onChange={(e) => set({ isActive: e.target.value })} aria-label="Status">
            <option value="">Any status</option><option value="true">Active</option><option value="false">Inactive</option>
          </Select>
        </div>
      </div>
      <div className="mb-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Select aria-label="Type" value={f.typeId} onChange={e => set({ typeId: e.target.value, subCategoryId: '', class: '', size: '', length: '', page: 1 })}><option value="">All Types</option>{types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</Select>
        <Select aria-label="Sub-Category" value={f.subCategoryId} onChange={e => set({ subCategoryId: e.target.value, page: 1 })}><option value="">All Sub-Categories</option>{subs.filter(s => !f.typeId || types.find(t => t.id === Number(f.typeId))?.subCategoryIds.includes(s.id)).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        <Select aria-label="Family" value={f.familyId} onChange={e => set({ familyId: e.target.value, page: 1 })}><option value="">All families</option>{families.map(x => <option key={x.id} value={x.id}>{brands.find(b => b.id === x.brandId)?.name} — {x.name}</option>)}</Select>
        {(['class', 'size', 'length'] as const).map(key => <Input key={key} aria-label={key} placeholder={`Filter ${key}`} value={f[key]} onChange={e => set({ [key]: e.target.value, page: 1 })} />)}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        <MovementSelect value={f.movement} onChange={(v) => set({ movement: v, page: 1 })} />
        <Toggle checked={f.lowStockOnly} onChange={(v) => set({ lowStockOnly: v })} label="Only at or below reorder level" />
      </div>

      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? (
          <Empty title="No products found" action={can(P.catalogManage) && <Button onClick={() => nav('/products/new')}>Add product</Button>}>
            Change the filters, or add products one by one or with an Excel import.
          </Empty>
        ) : (
          <table className="tbl">
            <thead><tr><th><input type="checkbox" aria-label="Select current page" checked={!!data.items.length && data.items.every(p => selected.includes(p.id))} onChange={e => select(e.target.checked ? [...new Set([...selected, ...data.items.map(p => p.id)])] : selected.filter(id => !data.items.some(p => p.id === id)))} /></th><th /><th>Product</th><th>Category</th><th className="text-right">List</th><th className="text-right">Partner</th><th className="text-right">Retail</th><th className="text-right">Stock</th><th>Movement</th><th>Rack</th><th>Active</th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}><td><input type="checkbox" aria-label={`Select ${p.code}`} checked={selected.includes(p.id)} onChange={e => select(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /></td>
                  <td className="w-12">
                    {(p.imageUrls[0] || p.catalog?.familyImageUrl) ? <img src={p.imageUrls[0] || p.catalog?.familyImageUrl} alt="" className="h-10 w-10 rounded border border-line object-cover" /> : <div className="h-10 w-10 rounded border border-dashed border-line" />}
                  </td>
                  <td>
                    <Link to={`/products/${p.id}`} className="font-semibold text-ink hover:text-pipe-700 hover:underline">{p.name}</Link>
                    <div className="text-2xs text-ink-faint">{p.code} · {p.brandName}{!p.showOnWeb && ' · hidden on web'}{!p.showOnApp && ' · hidden in app'}</div>
                  </td>
                  <td className="text-ink-soft">{p.categoryName}<div className="text-2xs">{[p.catalog?.typeName, p.catalog?.class, p.catalog?.productFamily, p.catalog?.size, p.catalog?.length].filter(Boolean).join(" · ")}</div>{p.subCategoryName && <div className="text-2xs">{p.subCategoryName}</div>}</td>
                  <td className="num text-right">{money(p.listPrice)}</td>
                  <td className="num text-right">{money(p.partnerPrice)}<div className="text-2xs text-ink-faint">−{p.partnerDiscountPercent}%</div></td>
                  <td className="num text-right">{money(p.retailPrice)}<div className="text-2xs text-ink-faint">−{p.retailDiscountPercent}%</div></td>
                  <td className="num text-right">
                    <span className={p.isLowStock ? 'font-semibold text-brick-700' : ''}>{qty(p.stockQty)}</span> <span className="text-2xs text-ink-faint">{p.unit}</span>
                    {p.reservedQty > 0 && <div className="text-2xs text-ink-faint">{qty(p.reservedQty)} reserved</div>}
                    {p.isLowStock && <div><Badge tone="danger">Reorder</Badge></div>}
                  </td>
                  <td>
                    <button type="button" className="text-left" onClick={() => setHistoryOf(p.id)} title="Movement history">
                      <MovementBadge m={p} />
                      <div className="mt-0.5 text-2xs text-ink-faint"><DaysSince m={p} /></div>
                    </button>
                  </td>
                  <td className="text-xs">{p.rackLocations.join(', ') || '—'}</td>
                  <td><Toggle checked={p.isActive} disabled={!can(P.catalogManage)} onChange={(v) => toggle.mutate({ id: p.id, value: v })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={(p) => set({ page: p })} />}
      </div>

      <MovementHistoryDrawer productId={historyOf} onClose={() => setHistoryOf(null)} />
      <ImportDialog open={importing} onClose={() => setImporting(false)} title="Import products from Excel"
        templatePath="/api/admin/products/template" uploadPath="/api/admin/products/import" params={{ createMissingMasters: createMasters }}
        invalidate={['products', 'categories', 'brands', 'subcategories']}>
        <p className="mb-3 text-sm text-ink-soft">
          A <b>Code</b> that already exists updates that product. A new code (e.g. the brand’s code) creates the product under it; leave Code blank to get a BM code.
          Rows with the same <b>Variant Family</b> appear as one item with a size picker. Only the first sheet is read.
        </p>
        <div className="mb-3"><Toggle checked={createMasters} onChange={setCreateMasters} label="Create missing categories, sub categories and brands" /></div>
      </ImportDialog>
    </>
  )
}
