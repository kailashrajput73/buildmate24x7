import { useEffect, useRef, useState } from 'react'
import { Button, ErrorBox, Field, Input } from '../components/ui'
import { useAuth } from '../lib/auth'
import { ApiError } from '../lib/api'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [retryAt, setRetryAt] = useState(0)
  const [remaining, setRemaining] = useState(0)
  const submitting = useRef(false)
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, Math.ceil((retryAt - Date.now()) / 1000)))
    tick()
    if (!retryAt) return
    const timer = window.setInterval(tick, 1000)
    return () => window.clearInterval(timer)
  }, [retryAt])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting.current || Date.now() < retryAt) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try { await login(email.trim(), password) } catch (err) {
      if (err instanceof ApiError && err.status === 429) {
        // Older deployments omit Retry-After; use the existing five-minute login window.
        const seconds = err.retryAfterSeconds ?? 300
        setRemaining(seconds)
        setRetryAt(Date.now() + seconds * 1000)
        setError(new Error('Too many sign-in attempts. Wait for the countdown, then try once. If this continues, contact your administrator.'))
      } else { setError(err) }
    } finally { submitting.current = false; setBusy(false) }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[linear-gradient(135deg,#2C4A8F,#1A7A9E_55%,#2F7F55)] lg:block">
        {/* Shelf-grid motif: the store's rack locations, as a quiet backdrop. */}
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" aria-hidden>
          <defs>
            <pattern id="rack" width="96" height="64" patternUnits="userSpaceOnUse">
              <rect x="0.5" y="0.5" width="95" height="63" fill="none" stroke="white" />
              <text x="8" y="18" fill="white" fontSize="11" fontFamily="DM Sans">R1-A1</text>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#rack)" />
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 text-white">
          <img src="/logo.png" alt="BuildMate 24x7" className="h-16 w-16 rounded-2xl bg-white p-1" />
          <div>
            <p className="max-w-md text-4xl font-display font-bold leading-tight">Run the counter, the racks and the partner network from one place.</p>
            <p className="mt-4 max-w-md text-pipe-100/80">Orders from the app and website land here. Stock moves when you dispatch. Partners earn points when goods leave the store.</p>
          </div>
          <p className="text-xs text-pipe-100/60">Shivani Electrochem Services</p>
        </div>
      </div>

      <div className="flex items-center justify-center p-6">
        <form onSubmit={submit} className="w-full max-w-sm space-y-4">
          <img src="/logo.png" alt="" className="h-14 w-14 rounded-full lg:hidden" />
          <div>
            <h1 className="text-2xl font-display font-bold">Sign in</h1>
            <p className="text-sm text-ink-soft">Use the email your administrator set up for you.</p>
          </div>
          <Field label="Email">
            <Input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
          </Field>
          <Field label="Password">
            <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <ErrorBox error={error} />
          {remaining > 0 && <p role="status" className="text-sm text-ink-soft">Try again in {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</p>}
          <Button type="submit" busy={busy} disabled={remaining > 0} className="w-full">Sign in</Button>
        </form>
      </div>
    </div>
  )
}
