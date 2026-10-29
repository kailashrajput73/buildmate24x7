import { ImagePlus, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { api } from '../lib/api'

/** Uploads to /api/admin/uploads/image and keeps a list of public URLs. First image is the cover. */
export default function ImageUploader({ value, onChange, folder = 'products', max = 6 }: { value: string[]; onChange: (v: string[]) => void; folder?: string; max?: number }) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [link, setLink] = useState('')
  const addLink = () => {
    const u = link.trim()
    if (!/^https?:\/\/\S+$/i.test(u)) { toast.error('Paste a full image link starting with https://'); return }
    if (!value.includes(u)) onChange([...value, u])
    setLink('')
  }

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    const urls: string[] = []
    for (const f of Array.from(files).slice(0, max - value.length)) {
      try {
        const fd = new FormData()
        fd.append('file', f)
        const r = await api.upload<{ url: string }>('/api/admin/uploads/image', fd, { folder })
        urls.push(r.url)
      } catch (e) {
        toast.error(`${f.name}: ${e instanceof Error ? e.message : 'upload failed'}`)
      }
    }
    onChange([...value, ...urls])
    setBusy(false)
    if (input.current) input.current.value = ''
  }

  return (
    <div className="space-y-3">
    <div className="flex flex-wrap gap-2">
      {value.map((u, i) => (
        <div key={u} className="group relative h-24 w-24 overflow-hidden rounded-md border border-line bg-paper">
          <img src={u} alt="" className="h-full w-full object-cover" />
          {i === 0 && <span className="absolute bottom-0 left-0 right-0 bg-ink/70 py-0.5 text-center text-2xs text-white">Cover</span>}
          <div className="absolute right-1 top-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            {i > 0 && <button type="button" className="rounded bg-white/90 px-1 text-2xs font-semibold" onClick={() => onChange([u, ...value.filter((x) => x !== u)])}>Cover</button>}
            <button type="button" className="rounded bg-white/90 p-0.5" onClick={() => onChange(value.filter((x) => x !== u))} aria-label="Remove image"><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
      {value.length < max && (
        <button type="button" disabled={busy} onClick={() => input.current?.click()}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-xs text-ink-soft hover:border-pipe-500 hover:text-pipe-700">
          <ImagePlus className="h-5 w-5" />{busy ? 'Uploading…' : 'Add image'}
        </button>
      )}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
    </div>
      {value.length < max && (
        <div className="flex max-w-xl gap-2">
          <input value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLink() } }}
            placeholder="…or paste an image link (e.g. Cloudinary)" aria-label="Image link"
            className="h-9 min-w-0 flex-1 rounded-md border border-line px-3 text-sm focus:border-pipe-500 focus:outline-none" />
          <button type="button" onClick={addLink} className="h-9 rounded-md border border-line px-3 text-sm font-semibold hover:border-pipe-500">Add link</button>
        </div>
      )}
    </div>
  )
}
