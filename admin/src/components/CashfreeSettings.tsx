import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { ShieldCheck, CreditCard } from 'lucide-react'
import { toast } from 'sonner'
import { Button, ErrorBox, Field, Input, Loading, Modal, Section } from './ui'
import { api, ApiError } from '../lib/api'

type Mode = 'sandbox' | 'production'
type Status = { revision: number; activated: boolean; mode: Mode; effectiveMode: Mode; sandboxConfigured: boolean; productionConfigured: boolean; legacyConfigured: boolean }
type Audit = { at: string; actorId: number; action: string; fromMode: Mode; toMode: Mode; revision: number }
type Credentials = { clientId: string; clientSecret: string }
const empty = (): Credentials => ({ clientId: '', clientSecret: '' })

export default function CashfreeSettings() {
  const cache = useQueryClient()
  const { data, error, isLoading } = useQuery({ queryKey: ['cashfree-settings'], queryFn: () => api.get<Status>('/api/admin/settings/cashfree'), retry: false })
  const { data: audit } = useQuery({ queryKey: ['cashfree-audit'], queryFn: () => api.get<Audit[]>('/api/admin/settings/cashfree/audit'), enabled: !!data, retry: false })
  const [mode, setMode] = useState<Mode>('sandbox')
  const [sandbox, setSandbox] = useState(empty)
  const [production, setProduction] = useState(empty)
  const [activate, setActivate] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  // The visible form starts on Test and is independent of the persisted active mode.
  // Status refreshes must not move the selected tab or discard either credential draft.
  useEffect(() => { if (data) setActivate(data.activated) }, [data?.activated])
  const supplied = (c: Credentials) => !!(c.clientId || c.clientSecret)
  const complete = (c: Credentials) => /^[A-Za-z0-9_-]{8,256}$/.test(c.clientId) && /^[A-Za-z0-9_+=/.-]{16,512}$/.test(c.clientSecret)
  const valid = (!supplied(sandbox) || complete(sandbox)) && (!supplied(production) || complete(production))
  const available = mode === 'sandbox' ? data?.sandboxConfigured || complete(sandbox) : data?.productionConfigured || complete(production)
  const needsLiveConfirmation = activate && mode === 'production' && (!data?.activated || data.effectiveMode !== 'production')

  async function save(confirmed = false) {
    if (!data || busy || !valid || (activate && !available)) return
    if (needsLiveConfirmation && !confirmed) { setConfirm(true); return }
    setBusy(true); setFailure(null)
    try {
      // Credentials never enter query/mutation caches, browser storage or telemetry.
      const status = await api.put<Status>('/api/admin/settings/cashfree', {
        revision: data.revision, mode, activate, confirmLive: confirmed,
        sandbox: supplied(sandbox) ? sandbox : undefined,
        production: supplied(production) ? production : undefined,
      })
      setSandbox(empty()); setProduction(empty()); setConfirm(false)
      cache.setQueryData(['cashfree-settings'], status)
      await cache.invalidateQueries({ queryKey: ['cashfree-audit'] })
      toast.success('Cashfree settings saved')
    } catch (e) { setFailure(e); setConfirm(false) }
    finally { setBusy(false) }
  }

  return <div className="mt-6" id="cashfree-payment-gateway">
    <Section title="Cashfree Payment Gateway">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-soft">Manage Test and Live credentials separately. Saved credentials are encrypted and never displayed. Existing payments retain their original payment configuration.</p>
        <ShieldCheck className="h-6 w-6 text-pipe-600" aria-hidden="true" />
      </div>
      {isLoading ? <Loading /> : error ? <><ErrorBox error={error} /><p className="mt-2 text-sm text-ink-soft">{error instanceof ApiError && error.status === 404 ? 'The configured API does not provide payment settings. Connect the dashboard to the updated .NET API.' : error instanceof ApiError && error.status === 401 ? 'Please sign out and sign in again to the current backend.' : error instanceof ApiError && error.status === 403 ? 'An administrator with settings permission is required.' : 'Could not load payment settings. Check that the backend is running and retry.'}</p></> : data && <>
        <div className={`mb-5 rounded-lg border p-4 ${data.effectiveMode === 'production' ? 'border-amber-300 bg-amber-50' : 'border-pipe-200 bg-pipe-50'}`}>
          <p className="font-semibold" aria-label="Currently active payment mode">Currently effective: {data.effectiveMode === 'production' ? 'Live Mode (Production)' : 'Test Mode (Sandbox)'}</p>
          <p className="mt-1 text-sm">{data.activated ? 'Dashboard settings control new payments.' : `Server environment configuration remains active (${data.legacyConfigured ? 'credentials configured' : 'credentials missing'}). Saving credentials alone does not activate them.`}</p>
        </div>
        <div className="mb-5 flex flex-wrap gap-2" aria-label="Saved credential status">
          <span className={`rounded-full px-3 py-1 text-xs ${data.sandboxConfigured ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>Test credentials: {data.sandboxConfigured ? 'Configured' : 'Not configured'}</span>
          <span className={`rounded-full px-3 py-1 text-xs ${data.productionConfigured ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>Live credentials: {data.productionConfigured ? 'Configured' : 'Not configured'}</span>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); void save() }} autoComplete="off">
          <fieldset disabled={busy}>
            <legend className="mb-2 font-semibold">Payment mode</legend>
            <div className="mb-2 flex flex-wrap gap-3" role="radiogroup" aria-label="Credential mode">
              {(['sandbox', 'production'] as const).map(m => <label key={m} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 ${mode === m ? 'border-pipe-500 bg-pipe-50' : 'border-slate-200'}`}>
                <input type="radio" name="cashfree-mode" aria-controls={`cashfree-${m}-credentials`} checked={mode === m} onChange={() => { setMode(m); setConfirm(false) }} />
                {m === 'sandbox' ? 'Test Mode' : 'Live Mode'}
              </label>)}
            </div>
            <p className="mb-5 text-sm text-ink-soft">Selecting a mode only changes the form. Payment configuration changes only when you save, with activation and confirmation where required.</p>
            <div className="max-w-2xl">
              {([{ key: 'sandbox', title: 'Test Mode (Sandbox)', prefix: 'Test', value: sandbox, set: setSandbox, configured: data.sandboxConfigured },
                { key: 'production', title: 'Live Mode (Production)', prefix: 'Live', value: production, set: setProduction, configured: data.productionConfigured }]).map(item => <div key={item.key} id={`cashfree-${item.key}-credentials`} hidden={mode !== item.key} className="space-y-3 rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">{item.title}</h3><span className={`rounded-full px-2 py-1 text-xs ${item.configured ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{item.configured ? 'Configured' : 'Not configured'}</span></div>
                  <Field label={`${item.prefix} Client ID`}><Input type="password" autoComplete="new-password" spellCheck={false} maxLength={256} value={item.value.clientId} onChange={e => item.set({ ...item.value, clientId: e.target.value })} placeholder={item.configured ? 'Enter replacement Client ID' : 'Enter Client ID'} /></Field>
                  <Field label={`${item.prefix} Client Secret`}><Input type="password" autoComplete="new-password" spellCheck={false} maxLength={512} value={item.value.clientSecret} onChange={e => item.set({ ...item.value, clientSecret: e.target.value })} placeholder={item.configured ? 'Enter replacement Client Secret' : 'Enter Client Secret'} /></Field>
                  <p className="text-xs text-ink-soft">Leave both blank to keep saved credentials. To replace them, enter both fields.</p>
                </div>)}
            </div>
            {!data.activated && <label className="my-4 flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={activate} onChange={e => setActivate(e.target.checked)} />Activate dashboard settings for new payments. Until selected, existing server configuration remains in use.</label>}
            {data.activated && mode !== data.effectiveMode && <p className="mt-4 text-sm text-amber-800">After saving{mode === 'production' ? ' and confirming' : ''}, new payments will use {mode === 'sandbox' ? 'Test Mode: no real money is collected.' : 'Live Mode: real money will be collected.'} The active mode has not changed yet.</p>}
            {!valid && <p role="alert" className="mt-3 text-sm text-brick-700">Enter both credentials without spaces. Client ID: 8–256 characters; secret: 16–512 characters.</p>}
            {mode === 'production' && !data.productionConfigured && <p className="mt-3 text-sm text-amber-800">Live credentials are not configured. Enter both Live fields and save successfully before Live Mode can be activated. The server will validate the credentials before making any change.</p>}
            {activate && !available && <p role="alert" className="mt-3 text-sm text-brick-700">Configure the selected mode before activating it.</p>}
            {!!failure && <div className="mt-3"><ErrorBox error={failure} /><Button className="mt-2" type="button" variant="secondary" onClick={() => void cache.invalidateQueries({ queryKey: ['cashfree-settings'] })}>Reload configuration status</Button></div>}
            <div className="mt-5"><Button type="submit" busy={busy} disabled={!valid || (activate && !available)} icon={<CreditCard className="h-4 w-4" />}>Save Cashfree settings</Button></div>
          </fieldset>
        </form>
        <Modal open={confirm} onClose={() => { if (!busy) setConfirm(false) }} title="Switch to Live Mode?">
          <p className="my-2 text-sm">New checkouts will collect real money using the saved Live credentials. Existing payments keep their original environment.</p>
          <div className="flex flex-wrap gap-2"><Button type="button" busy={busy} onClick={() => void save(true)}>Confirm Live Mode and save</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setConfirm(false)}>Cancel</Button></div>
        </Modal>
        {!!audit?.length && <details className="mt-6"><summary className="cursor-pointer text-sm font-semibold">Recent configuration activity</summary><ul className="mt-2 space-y-2 text-xs text-ink-soft">{audit.map((entry, index) => <li key={`${entry.revision}-${index}`}>{new Date(entry.at).toLocaleString()} · Administrator #{entry.actorId} · {entry.action.replace(/_/g, ' ')} · {entry.fromMode} → {entry.toMode}</li>)}</ul></details>}
      </>}
    </Section>
  </div>
}
