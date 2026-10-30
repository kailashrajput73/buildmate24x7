import clsx from 'clsx'
import {
  BarChart3, Boxes, FileText, ClipboardList, FolderTree, Home, Image, LogOut, Menu, Package, PlugZap, ScanLine, Settings, ShieldCheck, Tag, Truck, Users, UserRound, Wrench, Warehouse, X, Layers,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { P, useAuth } from '../lib/auth'
import { api } from '../lib/api'
import type { Dashboard } from '../lib/types'

type Item = { to: string; label: string; icon: ReactNode; perm?: string; count?: number }

export default function Layout() {
  const { user, logout, can } = useAuth()
  const [open, setOpen] = useState(false)
  const loc = useLocation()

  // Lightweight counters for the sidebar; refreshed every minute.
  const { data } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<Dashboard>('/api/admin/dashboard'),
    enabled: can(P.dashboard),
    refetchInterval: 60_000,
  })
  const k = data?.kpis
  // Requests waiting for a price.
  const { data: waiting } = useQuery({
    queryKey: ['quotations', 'waiting'],
    queryFn: () => api.get<{ total: number }>('/api/admin/quotations', { status: 'Requested', pageSize: 1 }),
    enabled: can(P.ordersView),
    refetchInterval: 60_000,
  })
  const quotesWaiting = waiting?.total

  const groups: { title: string; items: Item[] }[] = [
    { title: 'Today', items: [
      { to: '/', label: 'Dashboard', icon: <Home />, perm: P.dashboard },
      { to: '/orders', label: 'Orders', icon: <ClipboardList />, perm: P.ordersView, count: k?.awaitingDispatch },
      { to: '/quotations', label: 'Quotations', icon: <FileText />, perm: P.ordersView, count: quotesWaiting },
      { to: '/counter', label: 'Counter billing', icon: <ScanLine />, perm: P.counter },
      { to: '/service-requests', label: 'Service requests', icon: <Wrench />, perm: P.services, count: k?.openServiceRequests },
    ] },
    { title: 'Catalogue', items: [
      { to: '/products', label: 'Products', icon: <Package />, perm: P.catalogView },
      { to: '/categories', label: 'Categories', icon: <FolderTree />, perm: P.catalogView },
      { to: '/brands', label: 'Brands', icon: <Tag />, perm: P.catalogView },
      { to: '/product-groups', label: 'Product groups', icon: <Layers />, perm: P.catalogView },
    ] },
    { title: 'Inventory', items: [
      { to: '/stock', label: 'Stock', icon: <Boxes />, perm: P.stockView, count: k?.lowStockCount },
      { to: '/purchases', label: 'Purchases', icon: <Truck />, perm: P.purchases },
      { to: '/racks', label: 'Racks', icon: <Warehouse />, perm: P.stockView },
    ] },
    { title: 'Partners', items: [
      { to: '/partners', label: 'Referral partners', icon: <Users />, perm: P.partnersView, count: k?.pendingKyc },
      { to: '/customers', label: 'Customers', icon: <UserRound />, perm: P.partnersView },
    ] },
    { title: 'Website & app', items: [
      { to: '/content', label: 'Home page content', icon: <Image />, perm: P.content },
    ] },
    { title: 'Insights', items: [
      { to: '/reports', label: 'Reports', icon: <BarChart3 />, perm: P.reports },
    ] },
    { title: 'Admin', items: [
      { to: '/team', label: 'Team & roles', icon: <ShieldCheck />, perm: P.users },
      { to: '/settings', label: 'Store settings', icon: <Settings />, perm: P.settings },
      { to: '/integrations', label: 'ERP sync', icon: <PlugZap />, perm: P.settings },
    ] },
  ]

  const nav = (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-4">
      {groups.map((g) => {
        const items = g.items.filter((i) => !i.perm || can(i.perm))
        if (!items.length) return null
        return (
          <div key={g.title}>
            <div className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-ink-faint">{g.title}</div>
            {items.map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.to === '/'}
                onClick={() => setOpen(false)}
                className={({ isActive }) => clsx(
                  'group mb-0.5 flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm [&_svg]:h-4 [&_svg]:w-4',
                  isActive ? 'bg-pipe-100 font-semibold text-pipe-600' : 'font-medium text-ink-soft hover:bg-[#F1F3FA] hover:text-ink',
                )}
              >
                {({ isActive }) => (
                  <>
                    <span className={clsx('grid h-7 w-7 shrink-0 place-items-center rounded-lg', isActive ? 'bg-pipe-600 text-white' : 'bg-[#EEF3FF] text-pipe-600')}>{i.icon}</span>
                    <span className="flex-1">{i.label}</span>
                    {!!i.count && <span className="num rounded-full bg-[#E8EDF8] px-2 text-2xs font-semibold text-ink-soft">{i.count}</span>}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        )
      })}
    </nav>
  )

  return (
    <div className="flex min-h-screen flex-col">
      {/* Navy top bar, as on the website */}
      <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 bg-navy px-4 text-white">
        <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <img src="/logo.png" alt="" className="h-9 w-9 rounded-lg bg-white p-0.5" />
        <div className="leading-tight">
          <div className="font-display text-lg font-bold">BuildMate <span className="font-normal">24x7</span></div>
        </div>
        <span className="ml-1 hidden rounded-md bg-white/10 px-2 py-0.5 text-xs font-medium text-[#C9D3E6] sm:inline">Store admin</span>
        <div className="ml-auto flex items-center gap-3 text-sm">
          <div className="hidden text-right leading-tight sm:block">
            <div className="font-semibold">{user?.name}</div>
            <div className="text-2xs text-[#C9D3E6]">{user?.roleName}</div>
          </div>
          <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-white/10">
            <LogOut className="h-3.5 w-3.5" /> Log out
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* White side menu */}
        <aside className={clsx(
          'fixed bottom-0 left-0 top-14 z-30 flex w-64 flex-col border-r border-line bg-white transition-transform lg:translate-x-0',
          open ? 'translate-x-0 shadow-2xl' : '-translate-x-full',
        )}>
          <div className="flex items-center justify-between px-5 pt-3 lg:hidden">
            <span className="text-sm font-semibold">Menu</span>
            <button onClick={() => setOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
          </div>
          {nav}
        </aside>
        {open && <div className="fixed inset-0 top-14 z-20 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

        <main key={loc.pathname} className="mx-auto w-full min-w-0 max-w-[1400px] flex-1 px-4 py-6 lg:ml-64 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
