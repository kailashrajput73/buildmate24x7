import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, Drawer, Empty, ErrorBox, Field, Input, Loading, NumberInput, PageHeader, SearchBox, Section, Toggle } from '../components/ui'
import { api } from '../lib/api'
import { P, useAuth } from '../lib/auth'
import { qty } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { Rack, RackLocation } from '../lib/types'

export default function Racks() {
  const { can } = useAuth()
  const { data: racks, isLoading, error } = useQuery({ queryKey: ['racks'], queryFn: () => api.get<Rack[]>('/api/admin/racks') })
  const [sel, setSel] = useState<number | null>(null)
  const [edit, setEdit] = useState<Partial<Rack> | null>(null)
  const [find, setFind] = useState('')
  useEffect(() => { if (!sel && racks?.length) setSel(racks[0].id) }, [racks, sel])

  const { data: locs } = useQuery({ queryKey: ['racks', sel, 'locations'], queryFn: () => api.get<RackLocation[]>(`/api/admin/racks/${sel}/locations`), enabled: !!sel })
  const { data: found } = useQuery({ queryKey: ['racks', 'find', find], queryFn: () => api.get<RackLocation[]>('/api/admin/racks/find', { q: find }), enabled: find.trim().length >= 2 })
  const save = useAction((r: Partial<Rack>) => {
    const body = { code: r.code, name: r.name, rows: r.rows, columns: r.columns, isActive: r.isActive ?? true }
    return r.id ? api.put<Rack>(`/api/admin/racks/${r.id}`, body) : api.post<Rack>('/api/admin/racks', body)
  }, { success: 'Rack saved', invalidate: ['racks', 'racklocations'], onSuccess: (r) => { setEdit(null); setSel((r as Rack).id) } })

  const rack = racks?.find((r) => r.id === sel)
  const highlight = new Set(found?.map((l) => l.id))

  return (
    <>
      <PageHeader title="Racks" subtitle="Each cell gets a printable label like R1-B3. Purchases put stock on a cell so the team can find it during dispatch."
        actions={can(P.racks) && <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEdit({ rows: 4, columns: 6, isActive: true })}>Add rack</Button>} />
      <ErrorBox error={error} />
      {isLoading ? <Loading /> : !racks?.length ? <div className="card"><Empty title="No racks yet">Add a rack with rows and columns — locations are generated for you.</Empty></div> : (
        <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
          <div className="space-y-2">
            {racks.map((r) => (
              <button key={r.id} onClick={() => setSel(r.id)}
                className={`card w-full px-3 py-2 text-left ${sel === r.id ? 'border-pipe-500 ring-2 ring-pipe-100' : ''}`}>
                <div className="font-bold">{r.code} <span className="font-normal text-ink-soft">{r.name}</span></div>
                <div className="text-2xs text-ink-faint">{r.rows} × {r.columns} · {r.occupiedCount}/{r.locationCount} cells in use</div>
              </button>
            ))}
          </div>
          <div className="space-y-4">
            <SearchBox value={find} onChange={setFind} placeholder="Where is…? Type a product name or code" />
            {found && find.trim().length >= 2 && (
              <Section title={`Found in ${found.length} location${found.length === 1 ? '' : 's'}`}>
                {found.length === 0 ? <p className="text-sm text-ink-faint">Not on any rack.</p> : (
                  <ul className="space-y-1 text-sm">{found.map((l) => <li key={l.id}><b>{l.label}</b> — {l.products.map((p) => `${p.name} (${qty(p.quantity)})`).join(', ')}</li>)}</ul>
                )}
              </Section>
            )}
            {rack && (
              <Section title={`Rack ${rack.code}${rack.name ? ` · ${rack.name}` : ''}`} actions={can(P.racks) && <Button size="sm" variant="secondary" onClick={() => setEdit(rack)}>Edit rack</Button>}>
                {!locs ? <Loading /> : (
                  <div className="overflow-x-auto">
                    <div className="grid min-w-[600px] gap-1.5" style={{ gridTemplateColumns: `repeat(${rack.columns}, minmax(0, 1fr))` }}>
                      {locs.map((l) => (
                        <div key={l.id} title={l.products.map((p) => `${p.name}: ${qty(p.quantity)}`).join('\n')}
                          className={`min-h-[72px] rounded border p-1.5 text-2xs ${highlight.has(l.id) ? 'border-tape-500 bg-tape-100' : l.products.length ? 'border-pipe-100 bg-pipe-50' : 'border-dashed border-line'}`}>
                          <div className="font-bold text-ink">{l.label}</div>
                          {l.products.slice(0, 2).map((p) => <div key={p.productId} className="truncate text-ink-soft">{p.name}</div>)}
                          {l.products.length > 2 && <div className="text-ink-faint">+{l.products.length - 2} more</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Section>
            )}
          </div>
        </div>
      )}
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? `Edit rack ${edit.code}` : 'New rack'}
          footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button busy={save.isPending} onClick={() => save.mutate(edit)}>Save</Button></>}>
          <div className="space-y-3">
            <Field label="Rack code" hint="Short, printed on labels. e.g. R1, A, M2"><Input autoFocus value={edit.code ?? ''} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Name (optional)"><Input value={edit.name ?? ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Pipes wall, Electrical aisle…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rows (shelves)"><NumberInput value={edit.rows} onChange={(v) => setEdit({ ...edit, rows: v })} /></Field>
              <Field label="Columns (bays)"><NumberInput value={edit.columns} onChange={(v) => setEdit({ ...edit, columns: v })} /></Field>
            </div>
            <p className="text-sm text-ink-soft">Labels: {edit.code || 'R1'}-A1 … {edit.code || 'R1'}-{String.fromCharCode(64 + Math.min(26, edit.rows || 1))}{edit.columns || 1}</p>
            <Toggle checked={edit.isActive ?? true} onChange={(v) => setEdit({ ...edit, isActive: v })} label="Active" />
          </div>
        </Drawer>
      )}
    </>
  )
}
