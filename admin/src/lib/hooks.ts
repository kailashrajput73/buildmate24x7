import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ApiError } from './api'

/** Mutation that toasts success/failure and invalidates the given query keys. */
export function useAction<TVars, TResult = unknown>(fn: (v: TVars) => Promise<TResult>, opts: { success?: string | ((r: TResult) => string); invalidate?: string[]; onSuccess?: (r: TResult) => void } = {}) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (r) => {
      if (opts.success) toast.success(typeof opts.success === 'function' ? opts.success(r) : opts.success)
      opts.invalidate?.forEach((k) => qc.invalidateQueries({ queryKey: [k] }))
      opts.onSuccess?.(r)
    },
    onError: (e) => {
      if (!(e instanceof ApiError && e.rowErrors)) toast.error(e instanceof Error ? e.message : 'Something went wrong')
    },
  })
}

type Widen<T> = { [K in keyof T]: T[K] extends boolean ? boolean : T[K] extends number ? number : T[K] extends string ? string : T[K] }

/** Keeps list filters in the URL so they survive refresh and can be shared. */
export function useUrlState<D extends Record<string, string | number | boolean | undefined>>(defaults: D) {
  type T = Widen<D>
  const [sp, setSp] = useSearchParams()
  const state = { ...defaults } as unknown as T
  for (const k of Object.keys(defaults)) {
    const raw = sp.get(k)
    if (raw === null) continue
    const d = defaults[k]
    ;(state as Record<string, unknown>)[k] = typeof d === 'number' ? Number(raw) : typeof d === 'boolean' ? raw === 'true' : raw
  }
  const set = (patch: Partial<T>) => {
    const next = new URLSearchParams(sp)
    const merged = { ...state, ...patch, ...('page' in defaults && !('page' in patch) ? { page: 1 } : {}) }
    for (const [k, v] of Object.entries(merged)) {
      if (v === undefined || v === '' || v === defaults[k as keyof D]) next.delete(k)
      else next.set(k, String(v))
    }
    setSp(next, { replace: true })
  }
  return [state, set] as const
}
