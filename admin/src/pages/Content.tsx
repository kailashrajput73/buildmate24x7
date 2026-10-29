import { useQuery } from '@tanstack/react-query'
import { Globe, Plus, Smartphone, Trash2 } from 'lucide-react'
import { useState } from 'react'
import ImageUploader from '../components/ImageUploader'
import { Badge, Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, Section, Select, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { date } from '../lib/format'
import { useAction } from '../lib/hooks'
import { useBrands, useCategories, useGroups } from '../lib/masters'
import type { Banner, BannerLinkType, ContentPlacement, HomeSection, HomeSectionType } from '../lib/types'

const placementLabel: Record<ContentPlacement, string> = { Both: 'Website + app', Web: 'Website only', App: 'App only' }

function PlacementBadge({ p }: { p: ContentPlacement }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink-soft">
      {p !== 'App' && <Globe className="h-3.5 w-3.5" />}{p !== 'Web' && <Smartphone className="h-3.5 w-3.5" />}{placementLabel[p]}
    </span>
  )
}

export default function Content() {
  return (
    <>
      <PageHeader title="Home page content" subtitle="Banners and product rails for the website and the partner app. Changes go live as soon as you save — no app update needed." />
      <div className="space-y-6">
        <Banners />
        <Sections />
      </div>
    </>
  )
}

function Banners() {
  const { data, isLoading, error } = useQuery({ queryKey: ['banners'], queryFn: () => api.get<Banner[]>('/api/admin/content/banners') })
  const [edit, setEdit] = useState<Partial<Banner> | null>(null)
  const cats = useCategories().data ?? []
  const brands = useBrands().data ?? []
  const groups = useGroups().data ?? []
  const save = useAction((b: Partial<Banner>) => {
    const body = { ...b, linkType: b.linkType ?? 'None', placement: b.placement ?? 'Both', sortOrder: b.sortOrder ?? 0, isActive: b.isActive ?? true }
    return b.id ? api.put(`/api/admin/content/banners/${b.id}`, body) : api.post('/api/admin/content/banners', body)
  }, { success: 'Banner saved', invalidate: ['banners'], onSuccess: () => setEdit(null) })
  const del = useAction((id: number) => api.del(`/api/admin/content/banners/${id}`), { success: 'Banner removed', invalidate: ['banners'], onSuccess: () => setEdit(null) })

  const now = Date.now()
  const live = (b: Banner) => b.isActive && (!b.startsAt || new Date(b.startsAt).getTime() <= now) && (!b.endsAt || new Date(b.endsAt).getTime() > now)

  return (
    <Section title="Banners" pad={false} actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ placement: 'Both', linkType: 'None', isActive: true, sortOrder: (data?.length ?? 0) + 1 })}>Add banner</Button>}>
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : !data?.length ? <Empty title="No banners">Add a banner to headline offers on the home page.</Empty> : (
        <ul className="divide-y divide-line">
          {data.map((b) => (
            <li key={b.id} className="flex items-center gap-4 px-4 py-3">
              <img src={b.imageUrl} alt="" className="h-16 w-40 shrink-0 rounded border border-line bg-paper object-cover" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">{b.title}</div>
                <div className="truncate text-sm text-ink-soft">{b.subtitle}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <PlacementBadge p={b.placement} />
                  {live(b) ? <Badge tone="success">Live</Badge> : <Badge>{b.isActive ? 'Scheduled / ended' : 'Off'}</Badge>}
                  {(b.startsAt || b.endsAt) && <span className="text-2xs text-ink-faint">{date(b.startsAt)} → {date(b.endsAt)}</span>}
                </div>
              </div>
              <span className="num text-xs text-ink-faint">#{b.sortOrder}</span>
              <Button size="sm" variant="ghost" onClick={() => setEdit(b)}>Edit</Button>
            </li>
          ))}
        </ul>
      )}
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit banner' : 'New banner'}
          footer={<>
            {edit.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} busy={del.isPending} onClick={() => del.mutate(edit.id!)}>Remove</Button>}
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button>
          </>}>
          <div className="space-y-3">
            <Field label="Headline"><Input autoFocus value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Supporting line"><Input value={edit.subtitle ?? ''} onChange={(e) => setEdit({ ...edit, subtitle: e.target.value })} /></Field>
            <Field label="Wide image (website)" hint="1600 × 500 px works best"><ImageUploader folder="banners" max={1} value={edit.imageUrl ? [edit.imageUrl] : []} onChange={(v) => setEdit({ ...edit, imageUrl: v[0] })} /></Field>
            <Field label="Phone image (optional)" hint="1080 × 600 px; falls back to the wide image"><ImageUploader folder="banners" max={1} value={edit.mobileImageUrl ? [edit.mobileImageUrl] : []} onChange={(v) => setEdit({ ...edit, mobileImageUrl: v[0] })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Opens">
                <Select value={edit.linkType} onChange={(e) => setEdit({ ...edit, linkType: e.target.value as BannerLinkType, linkValue: '' })}>
                  <option value="None">Nothing (display only)</option><option value="Category">A category</option><option value="Brand">A brand</option>
                  <option value="ProductGroup">A product group</option><option value="Product">A product (by ID)</option><option value="Url">A web link</option>
                </Select>
              </Field>
              <Field label="Target">
                {edit.linkType === 'Category' ? <Select value={edit.linkValue ?? ''} onChange={(e) => setEdit({ ...edit, linkValue: e.target.value })}><option value="">Choose…</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                  : edit.linkType === 'Brand' ? <Select value={edit.linkValue ?? ''} onChange={(e) => setEdit({ ...edit, linkValue: e.target.value })}><option value="">Choose…</option>{brands.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                  : edit.linkType === 'ProductGroup' ? <Select value={edit.linkValue ?? ''} onChange={(e) => setEdit({ ...edit, linkValue: e.target.value })}><option value="">Choose…</option>{groups.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</Select>
                  : <Input disabled={edit.linkType === 'None'} value={edit.linkValue ?? ''} onChange={(e) => setEdit({ ...edit, linkValue: e.target.value })} placeholder={edit.linkType === 'Url' ? 'https://…' : ''} />}
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Show on"><Select value={edit.placement} onChange={(e) => setEdit({ ...edit, placement: e.target.value as ContentPlacement })}>{Object.entries(placementLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
              <Field label="Position"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
              <Field label="Start (optional)"><Input type="date" value={edit.startsAt?.slice(0, 10) ?? ''} onChange={(e) => setEdit({ ...edit, startsAt: e.target.value ? `${e.target.value}T00:00:00+05:30` : undefined })} /></Field>
              <Field label="End (optional)"><Input type="date" value={edit.endsAt?.slice(0, 10) ?? ''} onChange={(e) => setEdit({ ...edit, endsAt: e.target.value ? `${e.target.value}T23:59:59+05:30` : undefined })} /></Field>
            </div>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
          </div>
        </Drawer>
      )}
    </Section>
  )
}

const sectionTypes: { value: HomeSectionType; label: string; needsRef: boolean }[] = [
  { value: 'ProductGroup', label: 'Products from a group', needsRef: true },
  { value: 'Category', label: 'Products from a category', needsRef: true },
  { value: 'Brand', label: 'Products from a brand', needsRef: true },
  { value: 'Discounted', label: 'Best discounts', needsRef: false },
  { value: 'NewArrivals', label: 'New arrivals', needsRef: false },
]

function Sections() {
  const { data, isLoading, error } = useQuery({ queryKey: ['sections'], queryFn: () => api.get<HomeSection[]>('/api/admin/content/sections') })
  const [edit, setEdit] = useState<Partial<HomeSection> | null>(null)
  const cats = useCategories().data ?? []
  const brands = useBrands().data ?? []
  const groups = useGroups().data ?? []
  const save = useAction((s: Partial<HomeSection>) => {
    const body = { title: s.title, type: s.type, referenceId: s.referenceId, maxItems: s.maxItems ?? 12, placement: s.placement ?? 'Both', sortOrder: s.sortOrder ?? 0, isActive: s.isActive ?? true }
    return s.id ? api.put(`/api/admin/content/sections/${s.id}`, body) : api.post('/api/admin/content/sections', body)
  }, { success: 'Section saved', invalidate: ['sections'], onSuccess: () => setEdit(null) })
  const del = useAction((id: number) => api.del(`/api/admin/content/sections/${id}`), { success: 'Section removed', invalidate: ['sections'], onSuccess: () => setEdit(null) })
  const refOptions = edit?.type === 'Category' ? cats : edit?.type === 'Brand' ? brands : edit?.type === 'ProductGroup' ? groups : []

  return (
    <Section title="Product rails" pad={false} actions={<Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ type: 'ProductGroup', placement: 'Both', isActive: true, maxItems: 12, sortOrder: (data?.length ?? 0) + 1 })}>Add rail</Button>}>
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : !data?.length ? <Empty title="No product rails">Rails show a row of products on the home screen, e.g. “Bathroom fitting kit”.</Empty> : (
        <table className="tbl">
          <thead><tr><th className="w-12">#</th><th>Title</th><th>Shows</th><th>Where</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.map((s) => (
              <tr key={s.id}>
                <td className="num text-ink-faint">{s.sortOrder}</td>
                <td className="font-semibold">{s.title}</td>
                <td className="text-ink-soft">{sectionTypes.find((t) => t.value === s.type)?.label}{s.referenceName && `: ${s.referenceName}`} · up to {s.maxItems}</td>
                <td><PlacementBadge p={s.placement} /></td>
                <td>{s.isActive ? <Badge tone="success">On</Badge> : <Badge>Off</Badge>}</td>
                <td className="text-right"><Button size="sm" variant="ghost" onClick={() => setEdit(s)}>Edit</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? 'Edit rail' : 'New rail'}
          footer={<>
            {edit.id && <Button variant="danger" className="mr-auto" icon={<Trash2 className="h-4 w-4" />} busy={del.isPending} onClick={() => del.mutate(edit.id!)}>Remove</Button>}
            <Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button>
          </>}>
          <div className="space-y-3">
            <Field label="Title shown to customers"><Input autoFocus value={edit.title ?? ''} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></Field>
            <Field label="Shows"><Select value={edit.type} onChange={(e) => setEdit({ ...edit, type: e.target.value as HomeSectionType, referenceId: undefined })}>{sectionTypes.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select></Field>
            {sectionTypes.find((t) => t.value === edit.type)?.needsRef && (
              <Field label="Which one?"><Select value={edit.referenceId ?? ''} onChange={(e) => setEdit({ ...edit, referenceId: Number(e.target.value) || undefined })}><option value="">Choose…</option>{refOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</Select></Field>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Max products"><NumberInput value={edit.maxItems ?? 12} onChange={(v) => setEdit({ ...edit, maxItems: v })} /></Field>
              <Field label="Position"><NumberInput value={edit.sortOrder ?? 0} onChange={(v) => setEdit({ ...edit, sortOrder: v })} /></Field>
              <Field label="Show on"><Select value={edit.placement} onChange={(e) => setEdit({ ...edit, placement: e.target.value as ContentPlacement })}>{Object.entries(placementLabel).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
            </div>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
          </div>
        </Drawer>
      )}
    </Section>
  )
}
