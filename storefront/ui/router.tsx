'use client'
/**
 * The design kit was written for react-router. This maps the few router APIs it uses onto the Next.js router so
 * its screens can be used unchanged: navigate(path, { state, replace }), navigate(-1), useLocation().state, <Navigate/>.
 * Router "state" is kept in sessionStorage per destination path, so it survives a reload of that page.
 */
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef } from 'react'

const KEY = 'bm_nav_state:'
const pathOf = (to: string) => to.split(/[?#]/)[0]
let navCount = 0

export interface NavigateOptions { replace?: boolean; state?: unknown }

function writeState(to: string, state: unknown) {
  try {
    if (state === undefined) sessionStorage.removeItem(KEY + pathOf(to))
    else sessionStorage.setItem(KEY + pathOf(to), JSON.stringify(state))
  } catch { /* storage blocked: state is best-effort */ }
}

export function useNavigate() {
  const router = useRouter()
  return useCallback((to: string | number, opts?: NavigateOptions) => {
    if (typeof to === 'number') {
      if (to < 0) router.back(); else router.forward()
      return
    }
    writeState(to, opts?.state)
    navCount++
    if (opts?.replace) router.replace(to)
    else router.push(to)
  }, [router])
}

export function useLocation(): { pathname: string; state: unknown; key: string } {
  const pathname = usePathname() ?? '/'
  const state = useMemo(() => {
    if (typeof window === 'undefined') return null
    try { const raw = sessionStorage.getItem(KEY + pathname); return raw ? JSON.parse(raw) : null } catch { return null }
  }, [pathname])
  return { pathname, state, key: `${pathname}#${navCount}` }
}

export function Navigate({ to, replace, state }: { to: string; replace?: boolean; state?: unknown }) {
  const navigate = useNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate(to, { replace, state })
  }, [navigate, to, replace, state])
  return null
}

/** Whether there is an in-site page to go back to (used by "maybe pop" back buttons). */
export const canGoBack = () => typeof window !== 'undefined' && (navCount > 0 || document.referrer.startsWith(window.location.origin))
