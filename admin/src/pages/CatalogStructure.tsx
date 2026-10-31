import { useState } from 'react'
import { Link } from 'react-router-dom'
import ImageUploader from '../components/ImageUploader'
import { Button, ErrorBox, Field, Input, PageHeader, Section, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import { useBrands, useCategories, useFamilies, useProductTypes, useSubCategories } from '../lib/masters'
import type { CatalogFamily, ProductType } from '../lib/types'

export default function CatalogStructure() {
  const { can } = useAuth()
  const cats = useCategories().data ?? [], brands = useBrands().data ?? []
  const [categoryId, category] = useState(0)
  const types = useProductTypes(categoryId || undefined), families = useFamilies(categoryId || undefined)
  const subs = useSubCategories(categoryId || undefined).data ?? []
  const [type, setType] = useState<Partial<ProductType>>({ name: '', isActive: true, subCategoryIds: [] })
  const [family, setFamily] = useState<Partial<CatalogFamily>>({ name: '' })
  const saveType = useAction(() => {
    const body = { ...type, categoryId, sortOrder: type.sortOrder ?? 0 }
    return type.id ? api.put(`/api/admin/catalog-structure/types/${type.id}`, body) : api.post('/api/admin/catalog-structure/types', body)
  }, { invalidate: ['catalog-types'], success: 'Type saved', onSuccess: () => setType({ name: '', isActive: true, subCategoryIds: [] }) })
  const saveFamily = useAction(() => {
    const body = { ...family, categoryId }
    return family.id ? api.put(`/api/admin/catalog-structure/families/${family.id}`, body) : api.post('/api/admin/catalog-structure/families', body)
  }, { invalidate: ['catalog-families', 'products', 'product'], success: 'Family saved', onSuccess: () => setFamily({ name: '' }) })
  const editable = can(P.catalogManage)
  return <>
    <PageHeader title="Catalog Types & families" subtitle="Predefined Types and Sub-Categories drive import validation. Each brand has separate families." actions={<Link to="/products">Back to products</Link>} />
    <Field label="Category"><Select value={categoryId || ''} onChange={e => { category(Number(e.target.value)); setType({ name: '', isActive: true, subCategoryIds: [] }); setFamily({ name: '' }) }}><option value="">Choose category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <ErrorBox error={types.error || families.error || saveType.error || saveFamily.error} />
    {categoryId > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Section title="Product Types">
        <div className="mb-4 flex flex-wrap gap-2">{types.data?.map(t => <Button key={t.id} variant="secondary" onClick={() => setType(t)}>{t.name}{!t.isActive && ' (inactive)'}</Button>)}</div>
        <form onSubmit={e => { e.preventDefault(); saveType.mutate(undefined) }}><fieldset disabled={!editable} className="space-y-3">
          <Field label="Type name"><Input required value={type.name ?? ''} onChange={e => setType({ ...type, name: e.target.value })} /></Field>
          <Toggle label="Active Type" checked={type.isActive ?? true} onChange={isActive => setType({ ...type, isActive })} />
          <p className="text-sm">Allowed Sub-Categories (manage the list in Categories):</p>
          {subs.filter(s => s.isActive).map(s => <label className="mr-3 inline-flex gap-2" key={s.id}><input type="checkbox" checked={type.subCategoryIds?.includes(s.id) ?? false} onChange={e => setType({ ...type, subCategoryIds: e.target.checked ? [...(type.subCategoryIds ?? []), s.id] : type.subCategoryIds?.filter(id => id !== s.id) })} />{s.name}</label>)}
          <div className="flex gap-2"><Button type="submit" busy={saveType.isPending}>{type.id ? 'Save Type' : 'Add Type'}</Button><Button type="button" variant="secondary" onClick={() => setType({ name: '', isActive: true, subCategoryIds: [] })}>New Type</Button></div>
        </fieldset></form>
      </Section>
      <Section title="Brand-specific family images">
        <Select aria-label="Existing family" value={family.id ?? ''} onChange={e => setFamily(families.data?.find(f => f.id === Number(e.target.value)) ?? { name: '' })}><option value="">New family</option>{families.data?.map(f => <option key={f.id} value={f.id}>{brands.find(b => b.id === f.brandId)?.name} — {f.name}</option>)}</Select>
        <form className="mt-3" onSubmit={e => { e.preventDefault(); saveFamily.mutate(undefined) }}><fieldset disabled={!editable} className="space-y-3">
          <Field label="Brand"><Select required disabled={!!family.id} value={family.brandId ?? ''} onChange={e => setFamily({ ...family, brandId: Number(e.target.value) })}><option value="">Choose brand</option>{brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}</Select></Field>
          <Field label="Family name"><Input required value={family.name ?? ''} onChange={e => setFamily({ ...family, name: e.target.value })} /></Field>
          <ImageUploader value={family.imageUrl ? [family.imageUrl] : []} max={1} onChange={urls => setFamily({ ...family, imageUrl: urls[0] ?? '' })} />
          <p className="text-sm text-ink-soft">Used when a product has no image of its own. Product images are preserved.</p>
          <Button type="submit" busy={saveFamily.isPending}>Save family</Button>
        </fieldset></form>
      </Section>
    </div>}
  </>
}
