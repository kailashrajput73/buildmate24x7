import { useState } from 'react'
import { Link } from 'react-router-dom'
import ImageUploader from '../components/ImageUploader'
import { Button, ErrorBox, Field, Input, PageHeader, Section, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { useAction } from '../lib/hooks'
import { useBrands, useCategories, useFamilies, useFamilyCards, useProductTypes, useSubCategories } from '../lib/masters'
import type { CatalogFamily, FamilyCard, ProductType } from '../lib/types'

export default function CatalogStructure() {
  const { can } = useAuth()
  const cats = useCategories().data ?? [], brands = useBrands().data ?? []
  const [categoryId, category] = useState(0)
  const types = useProductTypes(categoryId || undefined), families = useFamilies(categoryId || undefined)
  const subs = useSubCategories(categoryId || undefined).data ?? []
  const [type, setType] = useState<Partial<ProductType>>({ name: '', isActive: true, subCategoryIds: [] })
  const [family, setFamily] = useState<Partial<CatalogFamily>>({ name: '' })
  const familyCards = useFamilyCards(categoryId || undefined)
  const [card, setCard] = useState<FamilyCard | null>(null)
  const saveType = useAction(() => {
    const body = { ...type, categoryId, sortOrder: type.sortOrder ?? 0, groupAcrossBrands: type.groupAcrossBrandsSetting ?? null, classLabel: type.classLabelSetting || null }
    return type.id ? api.put(`/api/admin/catalog-structure/types/${type.id}`, body) : api.post('/api/admin/catalog-structure/types', body)
  }, { invalidate: ['catalog-types'], success: 'Type saved', onSuccess: () => setType({ name: '', isActive: true, subCategoryIds: [] }) })
  const saveFamily = useAction(() => {
    const body = { ...family, categoryId }
    return family.id ? api.put(`/api/admin/catalog-structure/families/${family.id}`, body) : api.post('/api/admin/catalog-structure/families', body)
  }, { invalidate: ['catalog-families', 'products', 'product'], success: 'Family saved', onSuccess: () => setFamily({ name: '' }) })
  const saveCard = useAction(() => api.put<FamilyCard>('/api/admin/catalog-structure/family-cards', { categoryId, typeId: card!.typeId, familyKey: card!.key, imageUrl: card!.imageUrl || null }),
    { invalidate: ['catalog-family-cards'], success: 'Card photo saved', onSuccess: () => setCard(null) })
  const cardKey = (c: FamilyCard) => `${c.typeId}:${c.key}`
  const editable = can(P.catalogManage)
  return <>
    <PageHeader title="Catalog Types & families" subtitle="Predefined Types and Sub-Categories drive import validation. Each brand has separate families." actions={<Link to="/products">Back to products</Link>} />
    <Field label="Category"><Select value={categoryId || ''} onChange={e => { category(Number(e.target.value)); setType({ name: '', isActive: true, subCategoryIds: [] }); setFamily({ name: '' }); setCard(null) }}><option value="">Choose category</option>{cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
    <ErrorBox error={types.error || families.error || familyCards.error || saveType.error || saveFamily.error || saveCard.error} />
    {categoryId > 0 && <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <Section title="Product Types">
        <div className="mb-4 flex flex-wrap gap-2">{types.data?.map(t => <Button key={t.id} variant="secondary" onClick={() => setType(t)}>{t.name}{!t.isActive && ' (inactive)'}</Button>)}</div>
        <form onSubmit={e => { e.preventDefault(); saveType.mutate(undefined) }}><fieldset disabled={!editable} className="space-y-3">
          <Field label="Type name"><Input required value={type.name ?? ''} onChange={e => setType({ ...type, name: e.target.value })} /></Field>
          <Toggle label="Active Type" checked={type.isActive ?? true} onChange={isActive => setType({ ...type, isActive })} />
          <Field label="Sort order" hint="Lower comes first in the shop. With equal numbers: UPVC, CPVC, PVC, then A–Z."><Input type="number" value={type.sortOrder ?? 0} onChange={e => setType({ ...type, sortOrder: Number(e.target.value) || 0 })} /></Field>
          <Field label="Product cards" hint={`Automatic: ${type.id ? (type.allBrands ? 'one card for all brands' : 'one card per brand') : 'all brands for Pipe & Fitting and Electrical › Cable'}.`}>
            <Select value={type.groupAcrossBrandsSetting == null ? '' : String(type.groupAcrossBrandsSetting)} onChange={e => setType({ ...type, groupAcrossBrandsSetting: e.target.value === '' ? null : e.target.value === 'true' })}>
              <option value="">Automatic</option><option value="true">One card for all brands (e.g. "CPVC PIPE")</option><option value="false">One card per brand</option>
            </Select>
          </Field>
          <Field label="Class label" hint={`Name of the Class option on the product page. Empty = automatic (${type.id ? type.classLabel ?? 'Class' : '"Color" for Electrical › Cable, else "Class"'}).`}>
            <Input maxLength={40} value={type.classLabelSetting ?? ''} placeholder={type.classLabel ?? 'Class'} onChange={e => setType({ ...type, classLabelSetting: e.target.value })} />
          </Field>
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
      <Section title="Card photos (all brands)">
        <p className="mb-3 text-sm text-ink-soft">Families shown once for all brands, like "CPVC PIPE". Pick one and set the photo on its shop card. Brand family images above stay for product pages.</p>
        {familyCards.data?.length === 0 && <p className="text-sm">No family of this category is shown for all brands yet.</p>}
        {!!familyCards.data?.length && <Select aria-label="Family card" value={card ? cardKey(card) : ''} onChange={e => setCard(familyCards.data?.find(c => cardKey(c) === e.target.value) ?? null)}>
          <option value="">Choose a family</option>
          {familyCards.data.map(c => <option key={cardKey(c)} value={cardKey(c)}>{c.title} — {c.brandCount} brand{c.brandCount === 1 ? '' : 's'}{c.imageUrl ? '' : ' (no photo)'}</option>)}
        </Select>}
        {card && <form className="mt-3" onSubmit={e => { e.preventDefault(); saveCard.mutate(undefined) }}><fieldset disabled={!editable} className="space-y-3">
          <p className="text-sm font-semibold">{card.title}</p>
          <ImageUploader value={card.imageUrl ? [card.imageUrl] : []} max={1} onChange={urls => setCard({ ...card, imageUrl: urls[0] ?? '' })} />
          <Button type="submit" busy={saveCard.isPending}>Save card photo</Button>
        </fieldset></form>}
      </Section>
    </div>}
  </>
}
