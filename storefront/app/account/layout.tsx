'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useShop } from '@/lib/shop'
import { SitePage } from '@/ui/screens'

const nav = [['/account', 'Profile'], ['/account/orders', 'My orders'], ['/quotations', 'Quotations'], ['/account/addresses', 'Addresses'], ['/account/notifications', 'Notifications'], ['/services', 'Technician requests']]

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useShop()
  const router = useRouter()
  const path = usePathname()
  useEffect(() => { if (ready && !user) router.replace(`/login?next=${encodeURIComponent(path)}`) }, [ready, user, path, router])
  // The profile screen and the printable invoice bring their own chrome.
  if (path === '/account' || path.endsWith('/invoice')) return <>{children}</>
  return (
    <SitePage>
      {!user ? <div className="wrap py-20 text-center text-ink-soft">Loading…</div> : (
        <div className="wrap grid gap-6 py-6 lg:grid-cols-[220px_1fr] lg:py-8">
          <aside>
            <div className="mb-4"><div className="font-display text-lg font-bold">{user.name || 'Your account'}</div><div className="text-sm text-ink-soft">+91 {user.phone}</div></div>
            <nav className="flex gap-1 overflow-x-auto lg:flex-col">
              {nav.map(([href, label]) => (
                <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold ${path === href || (href !== '/account' && path.startsWith(href)) ? 'bg-pipe-100 text-pipe-700' : 'text-ink-soft hover:bg-white'}`}>{label}</Link>
              ))}
              <button onClick={() => logout().then(() => router.push('/'))} className="whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-sm font-semibold text-ink-soft hover:bg-white">Log out</button>
            </nav>
          </aside>
          <div className="min-w-0">{children}</div>
        </div>
      )}
    </SitePage>
  )
}
