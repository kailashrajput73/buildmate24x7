'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { ShoppingCart, Search, User, Wrench, Clock3, Menu, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useShop } from '@/lib/shop'
import type { CategoryTree, StoreInfo } from '@/lib/types'

export default function Header({ categories, store }: { categories: CategoryTree[]; store: StoreInfo | null }) {
  const { user, cartCount, ready } = useShop()
  const [menu, setMenu] = useState(false)
  const path = usePathname()
  useEffect(() => setMenu(false), [path])

  return (
    <>
    <div className="hidden sm:block">
      <div className="wrap flex h-9 items-center justify-between text-xs font-medium text-ink-soft">
        <span className="inline-flex items-center gap-1.5"><Clock3 className="h-3.5 w-3.5 text-pipe-600" />{store?.openingHours ?? 'Open 24x7'} · Store pickup or home delivery · GST invoice on every order</span>
        {store?.supportPhone && <a href={`tel:${store.supportPhone}`} className="font-semibold text-pipe-700 hover:text-pipe-900">Call {store.supportPhone}</a>}
      </div>
    </div>
    {/* Floating glass bar: content scrolls underneath it. */}
    <header className="sticky top-0 z-40 px-2 pt-2 sm:px-0 sm:pt-0">
      <div className="wrap !px-0 sm:!px-6">
      <div className="glass-strong rounded-[26px] sm:mt-1">
      <div className="flex h-16 items-center gap-3 px-3 sm:gap-5 sm:px-4">
        <button className="lg:hidden" onClick={() => setMenu(true)} aria-label="Open menu"><Menu className="h-6 w-6" /></button>
        <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="BuildMate 24x7 home">
          <img src="/logo.png" alt="" className="h-10 w-10 rounded-full" />
          <span className="hidden text-lg font-extrabold leading-none [font-stretch:120%] sm:block">Build<span className="text-leaf-600">Mate</span><span className="ml-1 text-xs font-bold text-pipe-600">24x7</span></span>
        </Link>
        <Suspense fallback={<div className="flex-1" />}><SearchBar /></Suspense>
        <nav className="flex items-center gap-1 sm:gap-2">
          <Link href="/services" className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white/70 hover:text-ink md:inline-flex">
            <Wrench className="h-4 w-4" /> Book a technician
          </Link>
          <Link href={user ? '/account' : '/login'} className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-white/70 hover:text-ink" aria-label="Account">
            <User className="h-5 w-5" /><span className="hidden md:inline">{ready ? (user ? (user.name?.split(' ')[0] || 'Account') : 'Log in') : ''}</span>
          </Link>
          <Link href="/cart" className="btn-primary relative !gap-1.5 !px-4 !py-2 text-sm" aria-label={`Cart, ${cartCount} items`}>
            <ShoppingCart className="h-5 w-5" /><span className="hidden sm:inline">Cart</span>
            {cartCount > 0 && <span className="num absolute -right-1.5 -top-1.5 min-w-[20px] rounded-full bg-tape-400 px-1 text-center text-xs font-bold text-ink">{cartCount}</span>}
          </Link>
        </nav>
      </div>
      <nav className="hidden border-t border-line lg:block" aria-label="Categories">
        <div className="flex h-11 items-center gap-1 px-3">
          {categories.map((c) => (
            <div key={c.id} className="group relative">
              <Link href={`/products?categoryId=${c.id}`} className="block rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-white/70 hover:text-ink">{c.name}</Link>
              {c.subCategories.length > 0 && (
                <div className="invisible absolute left-0 top-full z-50 pt-2 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                  <div className="glass-strong min-w-[230px] rounded-2xl p-2">
                  {c.subCategories.map((s) => (
                    <Link key={s.id} href={`/products?categoryId=${c.id}&subCategoryId=${s.id}`} className="block rounded-xl px-3 py-1.5 text-sm hover:bg-white/80 hover:text-pipe-700">{s.name}</Link>
                  ))}
                  </div>
                </div>
              )}
            </div>
          ))}
          <Link href="/products?discounted=true" className="ml-auto rounded-full px-3 py-1.5 text-sm font-semibold text-leaf-700 hover:bg-white/70">Deals</Link>
          <Link href="/partner" className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-soft hover:bg-white/70">For plumbers & electricians</Link>
        </div>
      </nav>
      </div>
      </div>

      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/30 backdrop-blur-[2px]" onClick={() => setMenu(false)} />
          <div className="glass-strong absolute inset-y-2 left-2 w-80 max-w-[85vw] overflow-y-auto rounded-[26px] p-4">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-extrabold">Shop by category</span>
              <button onClick={() => setMenu(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            {categories.map((c) => (
              <details key={c.id} className="border-b border-line py-2">
                <summary className="cursor-pointer py-1 font-semibold">{c.name}</summary>
                <Link href={`/products?categoryId=${c.id}`} className="block py-1.5 pl-3 text-sm text-pipe-700">All {c.name.toLowerCase()}</Link>
                {c.subCategories.map((s) => <Link key={s.id} href={`/products?categoryId=${c.id}&subCategoryId=${s.id}`} className="block py-1.5 pl-3 text-sm">{s.name}</Link>)}
              </details>
            ))}
            <Link href="/services" className="mt-4 block font-semibold">Book a plumber or electrician</Link>
            <Link href="/partner" className="mt-2 block font-semibold">For plumbers & electricians</Link>
          </div>
        </div>
      )}
    </header>
    </>
  )
}

function SearchBar() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')
  useEffect(() => setQ(sp.get('q') ?? ''), [sp])
  return (
    <form className="relative min-w-0 flex-1" role="search" onSubmit={(e) => { e.preventDefault(); router.push(`/products?q=${encodeURIComponent(q.trim())}`) }}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-faint" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search pipes, taps, wire, MCB… or nal, taar, pankha"
        className="h-11 w-full rounded-full border border-white/80 bg-white/60 pl-10 pr-4 text-[15px] shadow-[inset_0_1px_2px_rgb(16_42_84/0.07)] placeholder:text-ink-faint focus:border-pipe-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-pipe-500/15" aria-label="Search products" />
    </form>
  )
}
