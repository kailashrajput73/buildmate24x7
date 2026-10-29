import { toast } from 'sonner'
import type { AuthResult, ImportError } from './types'

const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const STORE_KEY = 'bm_admin_session'

export class ApiError extends Error {
  status: number
  code?: string
  rowErrors?: ImportError[]
  constructor(status: number, message: string, code?: string, rowErrors?: ImportError[]) {
    super(message)
    this.status = status
    this.code = code
    this.rowErrors = rowErrors
  }
}

type Session = Pick<AuthResult, 'accessToken' | 'refreshToken' | 'user'>

export const session = {
  get(): Session | null {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? 'null') } catch { return null }
  },
  set(s: Session | null) {
    try {
      if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s))
      else localStorage.removeItem(STORE_KEY)
    } catch { /* storage unavailable */ }
    listeners.forEach((l) => l(s))
  },
}
const listeners = new Set<(s: Session | null) => void>()
export const onSession = (fn: (s: Session | null) => void) => { listeners.add(fn); return () => { listeners.delete(fn) } }

let refreshing: Promise<boolean> | null = null
async function refresh(): Promise<boolean> {
  const s = session.get()
  if (!s?.refreshToken) return false
  refreshing ??= fetch(`${BASE}/api/auth/refresh`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }),
  }).then(async (r) => {
    if (!r.ok) { session.set(null); return false }
    const data = (await r.json()) as AuthResult
    session.set({ accessToken: data.accessToken, refreshToken: data.refreshToken, user: data.user })
    return true
  }).catch(() => false).finally(() => { refreshing = null })
  return refreshing
}

function qs(params?: Record<string, unknown>) {
  if (!params) return ''
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  const s = sp.toString()
  return s ? `?${s}` : ''
}

async function request<T>(method: string, path: string, opts: { body?: unknown; params?: Record<string, unknown>; form?: FormData; raw?: boolean } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {}
  const token = session.get()?.accessToken
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.form) body = opts.form
  else if (opts.body !== undefined) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(opts.body) }

  const res = await fetch(`${BASE}${path}${qs(opts.params)}`, { method, headers, body })
  if (res.status === 401 && retry && token && (await refresh())) return request<T>(method, path, opts, false)
  if (!res.ok) {
    let msg = res.status === 403 ? "You don't have permission to do this." : `Request failed (${res.status})`
    let code: string | undefined
    let rows: ImportError[] | undefined
    try {
      const p = await res.json()
      msg = p.title ?? msg
      code = p.type
      rows = p.errors && Array.isArray(p.errors) ? p.errors : undefined
      if (!rows && p.errors && typeof p.errors === 'object') msg = Object.values(p.errors as Record<string, string[]>).flat().join(' ')
    } catch { /* not JSON */ }
    throw new ApiError(res.status, msg, code, rows)
  }
  if (opts.raw) return (await res.blob()) as T
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T>(path: string, params?: Record<string, unknown>) => request<T>('GET', path, { params }),
  post: <T>(path: string, body?: unknown, params?: Record<string, unknown>) => request<T>('POST', path, { body, params }),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }),
  del: <T = void>(path: string) => request<T>('DELETE', path),
  upload: <T>(path: string, form: FormData, params?: Record<string, unknown>) => request<T>('POST', path, { form, params }),
  /** Downloads a file (Excel exports, QR codes) with auth and saves it. */
  /** Errors are shown as a toast (buttons call this directly), so it never rejects. */
  async download(path: string, params?: Record<string, unknown>, fallbackName = 'download') {
    const token = session.get()?.accessToken
    let res: Response
    try { res = await fetch(`${BASE}${path}${qs(params)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} }) }
    catch { toast.error("Couldn't reach the server. Check your connection and try again."); return }
    if (!res.ok) {
      const p = await res.json().catch(() => null) as { title?: string } | null
      toast.error(p?.title && res.status !== 404 ? p.title : `Download failed (${res.status}).`)
      return
    }
    const name = /filename\*?=(?:UTF-8'')?"?([^";]+)/.exec(res.headers.get('content-disposition') ?? '')?.[1] ?? fallbackName
    const url = URL.createObjectURL(await res.blob())
    const a = Object.assign(document.createElement('a'), { href: url, download: decodeURIComponent(name) })
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 2000)
  },
  /** Fetches a private file (KYC docs, QR images) as an object URL for <img>/<a>. */
  async objectUrl(path: string) {
    return URL.createObjectURL(await request<Blob>('GET', path, { raw: true }))
  },
}
