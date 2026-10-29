import { FileSpreadsheet, Upload } from 'lucide-react'
import { useRef, useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, ApiError } from '../lib/api'
import type { ImportError, ImportSummary } from '../lib/types'
import { Button, ImportErrors, Modal } from './ui'

/** Excel import: download template → fill → upload. All-or-nothing: if any row is wrong nothing is saved. */
export default function ImportDialog({ open, onClose, title, templatePath, uploadPath, params, invalidate, children }: {
  open: boolean; onClose: () => void; title: string; templatePath: string; uploadPath: string
  params?: Record<string, unknown>; invalidate: string[]; children?: ReactNode
}) {
  const qc = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<ImportError[]>()

  const upload = async () => {
    if (!file) return
    setBusy(true)
    setErrors(undefined)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.upload<ImportSummary>(uploadPath, fd, params)
      toast.success(`Imported: ${r.created} new, ${r.updated} updated${r.skipped ? `, ${r.skipped} unchanged` : ''}`)
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      setFile(null)
      onClose()
    } catch (e) {
      if (e instanceof ApiError && e.rowErrors) setErrors(e.rowErrors)
      else toast.error(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<><Button variant="secondary" onClick={onClose}>Close</Button><Button icon={<Upload className="h-4 w-4" />} busy={busy} disabled={!file} onClick={upload}>Upload</Button></>}>
      <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-ink-soft">
        <li><button className="font-semibold text-pipe-700 hover:underline" onClick={() => api.download(templatePath, undefined, 'template.xlsx')}>Download the template</button> (or an export from this page).</li>
        <li>Fill one row per record. Keep the header row.</li>
        <li>Upload it. Rows are checked first — nothing is saved if any row has a problem.</li>
      </ol>
      {children}
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
