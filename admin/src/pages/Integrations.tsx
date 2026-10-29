import { useQuery } from '@tanstack/react-query'
import { Fragment, useState } from 'react'
import { Badge, Button, Empty, ErrorBox, Loading, PageHeader, Section, Select } from '../components/ui'
import { api } from '../lib/api'
import { dateTime } from '../lib/format'
import { useAction } from '../lib/hooks'

type Msg = { id: number; createdAt: string; eventType: string; status: 'Pending' | 'Processed' | 'Failed' | 'Skipped'; attempts: number; lastError?: string; processedAt?: string; payload: string }
type Resp = { connector: string; counts: { status: string; count: number }[]; items: Msg[]; total: number }
const tone = { Pending: 'warn', Processed: 'success', Failed: 'danger', Skipped: 'neutral' } as const

const eventLabel: Record<string, string> = {
  'product.upserted': 'Product created / updated', 'purchase.created': 'Purchase entered', 'order.paid': 'Order paid',
  'order.dispatched': 'Invoice issued', 'order.cancelled': 'Order cancelled', 'stock.adjusted': 'Stock adjusted', 'partner.approved': 'Partner approved',
}

export default function Integrations() {
  const [status, setStatus] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const { data, isLoading, error } = useQuery({ queryKey: ['erp', status], queryFn: () => api.get<Resp>('/api/admin/integrations/erp', { status }), refetchInterval: 15_000 })
  const retry = useAction((id: number) => api.post(`/api/admin/integrations/erp/${id}/retry`), { success: 'Queued for retry', invalidate: ['erp'] })
  const count = (s: string) => data?.counts.find((c) => c.status === s)?.count ?? 0

  return (
    <>
      <PageHeader title="ERP sync" subtitle="Every sale, invoice, purchase and product change is queued for your accounting/ERP system and retried until it's accepted." />
      {data && (
        <Section className="mb-4">
          <div className="flex flex-wrap items-center gap-6 text-sm">
            <div>Connector: <b>{data.connector === 'None' ? 'Not connected yet' : data.connector}</b></div>
            <div>Waiting <b className="num">{count('Pending')}</b></div>
            <div>Sent <b className="num">{count('Processed')}</b></div>
            <div className={count('Failed') ? 'text-brick-700' : ''}>Failed <b className="num">{count('Failed')}</b></div>
          </div>
          {data.connector === 'None' && <p className="mt-2 text-sm text-ink-soft">Events are being recorded so nothing is lost. Once the ERP is chosen, the developer configures the connector and these events can be replayed.</p>}
        </Section>
      )}
      <Select className="mb-3 w-48" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
        <option value="">All events</option><option value="Pending">Waiting</option><option value="Failed">Failed</option><option value="Processed">Sent</option><option value="Skipped">Recorded only</option>
      </Select>
      <ErrorBox error={error} />
      <div className="card overflow-x-auto">
        {isLoading ? <Loading /> : !data?.items.length ? <Empty title="No events yet" /> : (
          <table className="tbl">
            <thead><tr><th>#</th><th>When</th><th>Event</th><th>Status</th><th className="text-right">Attempts</th><th>Last error</th><th /></tr></thead>
            <tbody>
              {data.items.map((m) => (
                <Fragment key={m.id}>
                  <tr>
                    <td className="num text-ink-faint">{m.id}</td>
                    <td className="whitespace-nowrap text-ink-soft">{dateTime(m.createdAt)}</td>
                    <td><button className="text-left hover:text-pipe-700" onClick={() => setOpen(open === m.id ? null : m.id)}>{eventLabel[m.eventType] ?? m.eventType}</button></td>
                    <td><Badge tone={tone[m.status]}>{m.status === 'Skipped' ? 'Recorded' : m.status}</Badge></td>
                    <td className="num text-right">{m.attempts}</td>
                    <td className="max-w-xs truncate text-xs text-brick-700">{m.lastError}</td>
                    <td className="text-right">{m.status === 'Failed' && <Button size="sm" variant="secondary" busy={retry.isPending} onClick={() => retry.mutate(m.id)}>Retry</Button>}</td>
                  </tr>
                  {open === m.id && <tr><td colSpan={7}><pre className="max-h-64 overflow-auto rounded bg-paper p-3 text-xs">{JSON.stringify(JSON.parse(m.payload), null, 2)}</pre></td></tr>}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
