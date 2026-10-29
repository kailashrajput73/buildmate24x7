import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, onSession, session } from './api'
import type { AuthResult, AuthUser } from './types'

type AuthCtx = {
  user: AuthUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  can: (permission: string) => boolean
}

const Ctx = createContext<AuthCtx>(null!)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => session.get()?.user ?? null)
  useEffect(() => onSession((s) => setUser(s?.user ?? null)), [])

  const login = async (email: string, password: string) => {
    const r = await api.post<AuthResult>('/api/auth/staff/login', { email, password })
    session.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user })
  }
  const logout = async () => {
    const s = session.get()
    if (s?.refreshToken) await api.post('/api/auth/logout', { refreshToken: s.refreshToken }).catch(() => undefined)
    session.set(null)
  }
  const can = (p: string) => !!user && (user.permissions.includes('*') || user.permissions.includes(p))

  return <Ctx.Provider value={{ user, login, logout, can }}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)

export const P = {
  dashboard: 'dashboard.view', catalogView: 'catalog.view', catalogManage: 'catalog.manage', purchases: 'purchases.manage',
  stockView: 'stock.view', stockAdjust: 'stock.adjust', racks: 'racks.manage', partnersView: 'partners.view',
  partnersManage: 'partners.manage', kyc: 'kyc.approve', rewards: 'rewards.adjust', ordersView: 'orders.view',
  ordersManage: 'orders.manage', specialDiscount: 'orders.special_discount', dispatch: 'dispatch.manage',
  counter: 'billing.counter', services: 'service_requests.manage', content: 'content.manage', reports: 'reports.view',
  users: 'users.manage', settings: 'settings.manage',
} as const
