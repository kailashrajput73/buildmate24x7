import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import InvoiceSheet, { COPY_LABELS, type InvoiceData } from '../components/InvoiceSheet'
import { Button, ErrorBox, Loading } from '../components/ui'
import { api } from '../lib/api'

/** GST tax invoice in the store's own printed format, A4. */
export default function Invoice() {
  const { id } = useParams()
  const [copy, setCopy] = useState<string>(COPY_LABELS[0])
  const { data: inv, isLoading, error } = useQuery({ queryKey: ['invoice', id], queryFn: () => api.get<InvoiceData>(`/api/admin/orders/${id}/invoice`) })
  if (isLoading) return <Loading />
  if (error || !inv) return <div className="p-6"><ErrorBox error={error} /></div>

  return (
    <div className="min-h-screen bg-white/40 py-6 print:bg-white print:py-0">
      <style>{`@page { size: A4; margin: 8mm } @media print { .no-print { display: none !important } body { background: #fff !important } }`}</style>
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-end gap-2 px-4">
        <label className="text-sm text-ink-soft" htmlFor="copy">Copy</label>
        <select id="copy" className="input w-auto" value={copy} onChange={(e) => setCopy(e.target.value)}>
          {COPY_LABELS.map((c) => <option key={c}>{c}</option>)}
        </select>
        <Button icon={<Printer className="h-4 w-4" />} onClick={() => window.print()}>Print / save as PDF</Button>
      </div>
      <div className="mx-auto max-w-[210mm] bg-white shadow-lg print:shadow-none">
        <InvoiceSheet inv={inv} copyLabel={copy} />
      </div>
    </div>
  )
}
