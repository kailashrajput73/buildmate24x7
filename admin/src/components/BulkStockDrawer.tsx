import { useQueryClient } from '@tanstack/react-query'
import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Badge, Button, Drawer, Field, Select, Toggle } from './ui'
import { api, session } from '../lib/api'
import { qty } from '../lib/format'

type Row = {
  row: number; productCode?: string | null; productId?: number | null; productName?: string | null; mode: string
  quantity?: number | null; currentStock?: number | null; newStock?: number | null; rack?: string | null; note?: string | null
  status: string; errors: string[]
}
type Preview = { fileName: string; defaultMode: string; totalRows: number; changeRows: number; unchangedRows: number; errorRows: number; rows: Row[] }
type ApplyResult = { applied: boolean; fileName: string; updated: number; skipped: number; failed: number; rows: Row[] }

const MAX_BYTES = 5 * 1024 * 1024
const SHOW_ROWS = 500
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

/** Multipart POST with upload progress (large files). */
function send<T>(path: string, form: FormData, onProgress: (pct: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE}${path}`)
    const token = session.get()?.accessToken
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100)) }
    xhr.onload = () => {
      let body: unknown = null
      try { body = JSON.parse(xhr.responseText) } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300) resolve(body as T)
      else reject(new Error((body as { title?: string } | null)?.title
        ?? (xhr.status === 401 ? 'Your session expired. Sign in again.' : xhr.status === 403 ? "You don't have permission to do this." : `Request failed (${xhr.status})`)))
    }
    xhr.onerror = () => reject(new Error("Couldn't reach the server. Check your connection and try again."))
    xhr.send(form)
  })
}

const tone = (s: string) => (s === 'OK' || s === 'Updated' ? 'success' : s === 'Error' || s === 'Failed' ? 'danger' : 'neutral') as 'success' | 'danger' | 'neutral'

function errorReport(rows: Row[], fileName: string) {
  const cell = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const lines = [['row', 'product_code', 'product_name', 'quantity', 'mode', 'status', 'errors'].join(',')]
  for (const r of rows.filter((x) => x.errors.length)) lines.push([r.row, r.productCode, r.productName, r.quantity, r.mode, r.status, r.errors.join(' | ')].map(cell).join(','))
  const url = URL.createObjectURL(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: `${fileName.replace(/\.[^.]+$/, '')}-errors.csv` })
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

/** Inventory › Stock › Bulk update stock: template → upload → preview → confirm → summary. */
export default function BulkStockDrawer({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<'set' | 'add'>('set')
  const [skipInvalid, setSkipInvalid] = useState(false)
  const [onlyErrors, setOnlyErrors] = useState(false)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [progress, setProgress] = useState(0)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<ApplyResult | null>(null)

  const reset = () => { setPreview(null); setResult(null); setOnlyErrors(false) }
  const pick = (f: File | null) => {
    reset()
    if (f && f.size > MAX_BYTES) { toast.error('The file is larger than 5 MB. Split it into smaller files.'); setFile(null); if (input.current) input.current.value = ''; return }
    if (f && !/\.(csv|xlsx)$/i.test(f.name)) { toast.error('Upload a .csv or .xlsx file.'); setFile(null); if (input.current) input.current.value = ''; return }
    setFile(f)
  }
  const form = () => { const fd = new FormData(); fd.append('file', file!); fd.append('defaultMode', mode); return fd }

  const validate = async () => {
    if (!file || busy) return
    setBusy('preview'); setProgress(0); setResult(null)
    try { setPreview(await send<Preview>('/api/admin/stock/bulk/preview', form(), setProgress)) }
    catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(null) }
  }

  const apply = async () => {
    if (!file || !preview || busy) return
    setBusy('apply'); setProgress(0)
    try {
      const fd = form(); fd.append('skipInvalid', String(skipInvalid))
      const r = await send<ApplyResult>('/api/admin/stock/bulk/apply', fd, setProgress)
      setResult(r)
      if (r.applied) {
        toast.success(`Stock updated for ${r.updated} product${r.updated === 1 ? '' : 's'}.`)
        for (const k of ['stock', 'products', 'stock-movements']) qc.invalidateQueries({ queryKey: [k] })
      } else toast.error(`${r.failed} row(s) have errors. Nothing was changed.`)
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Something went wrong') }
    finally { setBusy(null) }
  }

  const rows = result?.rows ?? preview?.rows ?? []
  const shown = (onlyErrors ? rows.filter((r) => r.errors.length) : rows).slice(0, SHOW_ROWS)
  const errorCount = rows.filter((r) => r.errors.length).length
  const canApply = !!preview && !result?.applied && preview.changeRows > 0 && (skipInvalid || preview.errorRows === 0)

  return (
    <Drawer open onClose={() => !busy && onClose()} title="Bulk update stock" width="max-w-5xl"
      footer={<>
        <Button variant="secondary" disabled={!!busy} onClick={onClose}>{result?.applied ? 'Close' : 'Cancel'}</Button>
        {!result?.applied && <Button variant="secondary" icon={<Upload className="h-4 w-4" />} disabled={!file || !!busy} busy={busy === 'preview'} onClick={validate}>
          {preview ? 'Validate again' : 'Validate & preview'}</Button>}
        {!result?.applied && <Button disabled={!canApply || !!busy} busy={busy === 'apply'} onClick={apply}>
          Confirm & apply{preview ? ` (${preview.changeRows})` : ''}</Button>}
      </>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-ink-soft">1. Download the template (every product, pre-filled with its current stock):</span>
          <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/stock/bulk/template', { format: 'xlsx' }, 'bulk-stock-template.xlsx')}>Template (.xlsx)</Button>
          <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => api.download('/api/admin/stock/bulk/template', { format: 'csv' }, 'bulk-stock-template.csv')}>Template (.csv)</Button>
        </div>
        <p className="text-xs text-ink-faint">Columns: product_code (or barcode), quantity, mode (set = replace stock, add = increase stock), rack (optional), note (optional). product_name and current_stock are for reference only.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="2. File (.csv or .xlsx, up to 5 MB)">
            <input ref={input} type="file" accept=".csv,.xlsx" disabled={!!busy} onChange={(e) => pick(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-pipe-50 file:px-3 file:py-2 file:font-semibold file:text-pipe-700" />
          </Field>
          <Field label="Default mode" hint="Used for rows whose mode column is blank.">
            <Select value={mode} disabled={!!busy} onChange={(e) => { setMode(e.target.value as 'set' | 'add'); reset() }}>
              <option value="set">Set — replace stock with the quantity</option>
              <option value="add">Add — increase stock by the quantity</option>
            </Select>
          </Field>
        </div>

        {busy && (
          <div aria-live="polite">
            <div className="mb-1 text-sm text-ink-soft">{progress < 100 ? `Uploading… ${progress}%` : busy === 'preview' ? 'Checking every row…' : 'Updating stock…'}</div>
            <div className="h-2 overflow-hidden rounded bg-line"><div className="h-full bg-pipe-600 transition-all" style={{ width: `${progress < 100 ? progress : 100}%` }} /></div>
          </div>
        )}

        {preview && !result && (
          <div className="rounded-xl border border-line p-3">
            <div className="flex flex-wrap gap-4 text-sm">
              <span><b>{preview.totalRows}</b> rows</span>
              <span className="text-leaf-700"><b>{preview.changeRows}</b> will change</span>
              <span><b>{preview.unchangedRows}</b> no change</span>
              <span className={preview.errorRows ? 'text-brick-700' : ''}><b>{preview.errorRows}</b> with errors</span>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="bulk-errors" checked={!skipInvalid} onChange={() => setSkipInvalid(false)} /> Cancel if any row has an error</label>
              <label className="inline-flex items-center gap-2 text-sm"><input type="radio" name="bulk-errors" checked={skipInvalid} onChange={() => setSkipInvalid(true)} /> Skip invalid rows and apply the valid ones</label>
            </div>
            {preview.errorRows > 0 && !skipInvalid && <p className="mt-2 text-sm text-brick-700">Fix the errors and validate again, or choose “Skip invalid rows”.</p>}
            <p className="mt-2 text-xs text-ink-faint">Stock is checked again when you apply, and every change is saved in one go — if anything fails, nothing is changed.</p>
          </div>
        )}

        {result && (
          <div className={`rounded-xl border p-3 ${result.applied ? 'border-leaf-100 bg-leaf-50' : 'border-brick-50 bg-brick-50'}`}>
            <div className="font-semibold">{result.applied ? 'Stock updated' : 'Nothing was changed'}</div>
            <div className="mt-1 flex flex-wrap gap-4 text-sm">
              <span>Updated: <b>{result.updated}</b></span><span>Skipped (no change): <b>{result.skipped}</b></span><span>Failed: <b>{result.failed}</b></span>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Toggle checked={onlyErrors} onChange={setOnlyErrors} label={`Show only rows with errors (${errorCount})`} />
              {errorCount > 0 && <Button size="sm" variant="secondary" icon={<Download className="h-4 w-4" />} onClick={() => errorReport(rows, (result ?? preview)!.fileName)}>Download error report (CSV)</Button>}
            </div>
            <div className="card overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Row</th><th>Product</th><th>Mode</th><th className="text-right">Current stock</th><th className="text-right">New stock</th><th>Status</th></tr></thead>
                <tbody>
                  {shown.map((r) => (
                    <tr key={r.row}>
                      <td className="num">{r.row}</td>
                      <td>{r.productName ?? '—'}<div className="text-2xs text-ink-faint">{r.productCode}{r.rack ? ` · rack ${r.rack}` : ''}{r.note ? ` · ${r.note}` : ''}</div></td>
                      <td>{r.mode}{r.quantity != null && <div className="text-2xs text-ink-faint">qty {qty(r.quantity)}</div>}</td>
                      <td className="num text-right">{r.currentStock != null ? qty(r.currentStock) : '—'}</td>
                      <td className="num text-right">{r.newStock != null ? qty(r.newStock) : '—'}</td>
                      <td><Badge tone={tone(r.status)}>{r.status}</Badge>{r.errors.map((e) => <div key={e} className="text-2xs text-brick-700">{e}</div>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > SHOW_ROWS && <p className="text-xs text-ink-faint">Showing the first {SHOW_ROWS} rows{onlyErrors ? ' with errors' : ''}. The error report has every row with an error.</p>}
          </>
        )}
      </div>
    </Drawer>
  )
}
