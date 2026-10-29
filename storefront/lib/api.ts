'use client'
import type { AuthResult } from './types'

const KEY = 'bm_shop_session'
type Session = Pick<AuthResult, 'accessToken' | 'refreshToken' | 'user'>

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message) }
}

const listeners = new Set<(s: Session | null) => void>()
export const session = {
  get(): Session | null {
    if (typeof window === 'undefined') return null
    try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') } catch { return null }
  },
  set(s: Session | null) {
    try { if (s) localStorage.setItem(KEY, JSON.stringify(s)); else localStorage.removeItem(KEY) } catch { /* private mode */ }
    listeners.forEach((l) => l(s))
  },
  subscribe(fn: (s: Session | null) => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
}

let refreshing: Promise<boolean> | null = null
function refresh() {
  const s = session.get()
  if (!s) return Promise.resolve(false)
  refreshing ??= fetch('/api/auth/refresh', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) })
    .then(async (r) => {
      if (!r.ok) { session.set(null); return false }
      const d = (await r.json()) as AuthResult
      session.set({ accessToken: d.accessToken, refreshToken: d.refreshToken, user: d.user })
      return true
    }).catch(() => false).finally(() => { refreshing = null })
  return refreshing
}

/** Browser-side API client. Calls go to this site's /api proxy. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = { 'X-Client': 'web' }
  const token = session.get()?.accessToken
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(path, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) })
  if (res.status === 401 && token && retry && (await refresh())) return api<T>(path, init, false)
  if (!res.ok) {
    let msg = 'Something went wrong. Please try again.'
    let code: string | undefined
    try { const p = await res.json(); msg = p.title ?? msg; code = p.type } catch { /* ignore */ }
    throw new ApiError(res.status, msg, code)
  }
  if (res.status === 204) return undefined as T
  const t = await res.text()
  return (t ? JSON.parse(t) : undefined) as T
}

/** Multipart upload through the same proxy, with the session token (KYC documents). */
export async function apiUpload<T>(path: string, form: FormData, retry = true): Promise<T> {
  const token = session.get()?.accessToken
  const headers: Record<string, string> = { 'X-Client': 'web' }
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { method: 'POST', headers, body: form })
  if (res.status === 401 && token && retry && (await refresh())) return apiUpload<T>(path, form, false)
  if (!res.ok) {
    let msg = 'Upload failed. Please try again.'
    try { const p = await res.json(); msg = p.title ?? msg } catch { /* ignore */ }
    throw new ApiError(res.status, msg)
  }
  const t = await res.text()
  return (t ? JSON.parse(t) : undefined) as T
}
