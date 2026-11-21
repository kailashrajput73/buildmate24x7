import { FileSpreadsheet, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '../lib/api'
import type { ImportError, ImportSummary, ProductImportPreview } from '../lib/types'
import { Button, ImportErrors, Modal } from './ui'

/** Excel import: download template → fill → upload. All-or-nothing: if any row is wrong nothing is saved. */
export default function ImportDialog({ open, onClose, title, templatePath, uploadPath, previewPath, params, invalidate, children }: {
  open: boolean; onClose: () => void; title: string; templatePath: string; uploadPath: string; previewPath?: string
  params?: Record<string, unknown>; invalidate: string[]; children?: ReactNode
}) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>()
  const [preview, setPreview] = useState<ProductImportPreview | null>(null)
  const [confirmSimilar, setConfirmSimilar] = useState(false)
  const paramsKey = JSON.stringify(params ?? {})
  useEffect(() => { setPreview(null); setConfirmSimilar(false); setErrors(undefined) }, [file, paramsKey])

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setErrors(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (previewPath && !preview) {
        setPreview(await api.upload<ProductImportPreview>(previewPath, fd, params))
      } else {
        const r = await api.upload<ImportSummary>(uploadPath, fd, { ...params, allowSimilarMasterNames: confirmSimilar })
        const masterMessage = r.mastersCreated ? `, ${r.mastersCreated} master records created` : ''
        toast.success(`Imported: ${r.created} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} unchanged` : ''}${masterMessage}`)
        invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
        setFile(null)
        setPreview(null)
        onClose()
      }
    } catch (e) {
      if (e instanceof ApiError && e.rowErrors) setErrors(e.rowErrors)
      else toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={<Upload className="h-4 w-4" />} busy={busy}
        disabled={!file || (!!preview && (preview.missingMasters > 0 || (preview.reviewItems > 0 && !confirmSimilar)))} onClick={upload}>
        {previewPath && !preview ? 'Review upload' : 'Import'}
      </Button></>}>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li><button className="font-semibold text-pipe-700 hover:underline" onClick={() => api.download(templatePath, undefined, 'template.xlsx')}>Download the template</button> (or an export from this page).</li>
        <li>Fill one row per record. Keep the header row.</li>
        <li>Upload it. Rows are checked first — nothing is saved if any row has a problem.</li>
      </ol>
      {children}
      {preview && <div className="mb-3 space-y-2 rounded-md border border-line bg-surface p-3 text-sm">
        <div className="font-semibold">Preview: {preview.productRows} product rows</div>
        <div className="text-ink-soft">{preview.reusedMasters} existing master values will be reused; {preview.newMasters} new master records will be created.</div>
        {preview.masters.length > 0 && <div className="max-h-56 overflow-auto rounded border border-line">
          <table className="w-full text-left text-xs"><thead><tr className="bg-surface-container"><th className="px-2 py-1">Master</th><th className="px-2 py-1">Sheet value</th><th className="px-2 py-1">Action</th></tr></thead>
            <tbody>{preview.masters.map((m, i) => <tr key={`${m.kind}-${m.name}-${i}`} className="border-t border-line">
              <td className="px-2 py-1">{m.kind}</td><td className="px-2 py-1">{m.name}{m.rows > 1 ? ` (${m.rows} rows)` : ''}</td>
              <td className="px-2 py-1">{m.action === 'Reuse' ? `Reuse ${m.matchedName}` : m.action === 'Create' ? 'Create' : m.action === 'Missing' ? 'Missing' : `Review${m.matchedName ? ` · possible match: ${m.matchedName}` : ''}`}</td>
            </tr>)}</tbody>
          </table>
        </div>}
        {preview.missingMasters > 0 && <p className="text-red-700">Some master data is missing. Enable master-data creation if your role allows it, or add those masters first.</p>}
        {preview.reviewItems > 0 && <div className="space-y-1 text-amber-800">
          <p>{preview.reviewItems} value(s) may be singular/plural duplicates. They are not merged automatically.</p>
          {preview.masters.filter(m => m.action === 'Review').map((m, i) => <p key={`${m.kind}-${m.name}-${i}`} className="text-xs">{m.kind}: “{m.name}” — {m.note}</p>)}
          <label className="mt-2 flex items-start gap-2 text-xs text-ink"><input type="checkbox" checked={confirmSimilar} onChange={(e) => setConfirmSimilar(e.target.checked)} />
            I reviewed these possible matches and confirm they are separate master values.
          </label>
        </div>}
      </div>}
      <button type="button" onClick={() => input.current?.click()}
        className="flex w-full items-center gap-3 rounded-md border-2 border-dashed border-line px-4 py-5 text-left hover:border-pipe-500">
        <FileSpreadsheet className="h-8 w-8 text-leaf-600" />
        <span className="text-sm">{file ? <b>{file.name}</b> : 'Choose an .xlsx file'}</span>
      </button>
      <input ref={input} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setErrors(undefined) }} />
      <ImportErrors errors={errors} />
    </Modal>
  )
}
