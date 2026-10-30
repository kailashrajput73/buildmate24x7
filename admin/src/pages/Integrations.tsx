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
      <PaymentsCheck />
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

type PaymentsInfo = { provider: string; environment: string; keysSet: boolean; clientIdEnding?: string | null; returnUrl: string; webhookUrl: string; problems: string[] }

/** Cashfree set-up at a glance, with a read-only key check. */
function PaymentsCheck() {
  const { data, error } = useQuery({ queryKey: ['payments-check'], queryFn: () => api.get<PaymentsInfo>('/api/admin/integrations/payments') })
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const test = useAction(() => api.post<{ ok: boolean; message: string }>('/api/admin/integrations/payments/test'), { onSuccess: (r) => setResult(r as { ok: boolean; message: string }) })
  return (
    <>
      <PageHeader title="Online payments" subtitle="Cashfree checkout for the website and app. Sandbox keys work only in sandbox, live keys only in production." />
      <ErrorBox error={error} />
      {data && (
        <Section className="mb-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div>Mode: <Badge tone={data.environment === 'production' ? 'success' : 'warn'}>{data.environment === 'production' ? 'Live (production)' : 'Test (sandbox)'}</Badge></div>
            <div>Keys: <b>{data.keysSet ? `set${data.clientIdEnding ? ` (…${data.clientIdEnding})` : ''}` : 'missing'}</b></div>
            <Button size="sm" variant="secondary" busy={test.isPending} onClick={() => test.mutate(undefined)} disabled={!data.keysSet}>Test connection</Button>
          </div>
          {result && <p className={`mt-2 text-sm ${result.ok ? 'text-leaf-700' : 'text-brick-700'}`}>{result.message}</p>}
          <dl className="mt-3 grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-soft">Return address</dt><dd className="num break-all">{data.returnUrl || '—'}</dd>
            <dt className="text-ink-soft">Webhook address</dt><dd className="num break-all">{data.webhookUrl || '—'}</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-soft">Add the webhook address in the Cashfree dashboard (Developers → Webhooks) so paid orders are confirmed automatically.</p>
          {data.problems.length > 0 ? (
            <ul className="mt-3 list-disc space-y-1 rounded-md bg-brick-50 py-2 pl-6 pr-3 text-sm text-brick-700">
              {data.problems.map((p) => <li key={p}>{p}</li>)}
            </ul>
          ) : <p className="mt-3 text-sm text-leaf-700">No set-up problems found.</p>}
        </Section>
      )}
    </>
  )
}
