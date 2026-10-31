'use client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import { api, session } from './api'
import type { AuthResult, AuthUser, Cart } from './types'

const GUEST_KEY = 'bm_guest_cart'
type GuestLine = { productId: number; quantity: number; purchaseUnit?: "Piece" | "Box" }

type Shop = {
  user: AuthUser | null
  ready: boolean
  requestOtp: (phone: string) => Promise<void>
  verifyOtp: (phone: string, code: string, name?: string) => Promise<AuthResult>
  /** Stores a sign-in result (Firebase or OTP) and moves the guest cart into the account. */
  signIn: (r: AuthResult) => Promise<AuthResult>
  logout: () => Promise<void>
  cart: Cart | null
  cartCount: number
  cartBusy: boolean
  /** Resolves true when the item made it into the cart. */
  add: (productId: number, qty?: number, name?: string, quiet?: boolean, purchaseUnit?: "Piece" | "Box") => Promise<boolean>
  setQty: (productId: number, qty: number, purchaseUnit?: "Piece" | "Box") => Promise<boolean>
  remove: (productId: number, purchaseUnit?: "Piece" | "Box") => Promise<boolean>
  reloadCart: () => Promise<void>
}

const Ctx = createContext<Shop>(null!)

const readGuest = (): GuestLine[] => { try { return JSON.parse(localStorage.getItem(GUEST_KEY) ?? '[]') } catch { return [] } }
const writeGuest = (l: GuestLine[]) => { try { localStorage.setItem(GUEST_KEY, JSON.stringify(l)) } catch { /* ignore */ } }

/** Guest carts live in the browser and are priced live by the API; they merge into the account on login. */
async function priceGuest(lines: GuestLine[]): Promise<Cart> {
  return api<Cart>('/api/cart/preview', { method: 'POST', body: lines.map(l => ({ ...l, purchaseUnit: l.purchaseUnit ?? 'Piece' })) })
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [cart, setCart] = useState<Cart | null>(null)
  const [cartBusy, setBusy] = useState(false)

  useEffect(() => {
    setUser(session.get()?.user ?? null)
    setReady(true)
    return session.subscribe((s) => setUser(s?.user ?? null))
  }, [])

  const reloadCart = useCallback(async () => {
    try {
      setCart(session.get() ? await api<Cart>('/api/cart') : await priceGuest(readGuest()))
    } catch { /* keep last known cart */ }
  }, [])
  useEffect(() => { if (ready) reloadCart() }, [ready, user?.id, reloadCart])

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn(); return true } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not update the cart'); return false } finally { setBusy(false) }
  }

  const add = (productId: number, qty = 1, name?: string, quiet = false, purchaseUnit: "Piece" | "Box" = "Piece") => run(async () => {
    if (session.get()) setCart(await api<Cart>('/api/cart/items', { method: 'POST', body: { productId, quantity: qty, purchaseUnit } }))
    else {
      const g = readGuest()
      const ex = g.find((l) => l.productId === productId && (l.purchaseUnit ?? "Piece") === purchaseUnit)
      if (ex) ex.quantity += qty; else g.push({ productId, quantity: qty, purchaseUnit })
      writeGuest(g)
      setCart(await priceGuest(g))
    }
    if (!quiet) toast.success(name ? `Added ${name}` : 'Added to cart', { action: { label: 'View cart', onClick: () => { window.location.href = '/cart' } } })
  })

  const setQty = (productId: number, qty: number, purchaseUnit: "Piece" | "Box" = "Piece") => run(async () => {
    if (session.get()) setCart(await api<Cart>('/api/cart/items', { method: 'PUT', body: { productId, quantity: qty, purchaseUnit } }))
    else {
      const g = readGuest().map((l) => (l.productId === productId && (l.purchaseUnit ?? "Piece") === purchaseUnit ? { ...l, quantity: qty } : l)).filter((l) => l.quantity > 0)
      writeGuest(g)
      setCart(await priceGuest(g))
    }
  })

  const remove = (productId: number, purchaseUnit: "Piece" | "Box" = "Piece") => setQty(productId, 0, purchaseUnit)

  const requestOtp = async (phone: string) => { await api('/api/auth/otp/request', { method: 'POST', body: { phone, audience: 'Customer' } }) }

  const verifyOtp = async (phone: string, code: string, name?: string) =>
    signIn(await api<AuthResult>('/api/auth/otp/verify', { method: 'POST', body: { phone, code, audience: 'Customer', name } }))

  // Partners and customers both shop on the website; prices follow the account type.
  const signIn = async (r: AuthResult) => {
    session.set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user })
    const guest = readGuest()
    if (guest.length) {
      try { setCart(await api<Cart>('/api/cart/merge', { method: 'POST', body: guest })); writeGuest([]) } catch { /* keep guest cart */ }
    }
    return r
  }

  const logout = async () => {
    const s = session.get()
    if (s) await api('/api/auth/logout', { method: 'POST', body: { refreshToken: s.refreshToken } }).catch(() => undefined)
    session.set(null)
    setCart(await priceGuest(readGuest()))
  }

  const value = useMemo<Shop>(() => ({
    user, ready, requestOtp, verifyOtp, signIn, logout, cart, cartBusy, add, setQty, remove, reloadCart,
    cartCount: cart?.itemCount ?? 0,
  }), [user, ready, cart, cartBusy]) // eslint-disable-line react-hooks/exhaustive-deps

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export const useShop = () => useContext(Ctx)
