'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import InvoiceSheet, { type InvoiceData } from '@/components/InvoiceSheet'
import { api } from '@/lib/api'

export default function InvoicePage() {
  const { id } = useParams<{ id: string }>()
  const [inv, setInv] = useState<InvoiceData | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { api<InvoiceData>(`/api/orders/${id}/invoice`).then(setInv).catch((e) => setErr(e.message)) }, [id])
  if (err) return <p className="wrap py-10 text-brick-700">{err}</p>
  if (!inv) return <p className="wrap py-10 text-ink-soft">Loading invoice…</p>
  return (
    <div className="py-6 print:py-0">
      <style>{'@page { size: A4; margin: 8mm } @media print { header, footer, .no-print { display: none !important } body { background: #fff !important } }'}</style>
      <div className="no-print wrap mb-4 flex max-w-[210mm] justify-end"><button className="btn-primary" onClick={() => window.print()}>Print / save as PDF</button></div>
      <div className="mx-auto max-w-[210mm] overflow-x-auto bg-white shadow-lg print:overflow-visible print:shadow-none">
        <div className="min-w-[720px] print:min-w-0"><InvoiceSheet inv={inv} /></div>
      </div>
    </div>
  )
}
