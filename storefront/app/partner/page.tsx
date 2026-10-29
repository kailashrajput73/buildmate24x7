import type { Metadata } from 'next'
import { BadgePercent, QrCode, Gift, BellRing } from 'lucide-react'
import { serverApi } from '@/lib/server-api'

export const metadata: Metadata = { title: 'Partner app for plumbers, electricians & contractors' }

export default async function Partner() {
  const store = await serverApi.store()
  const points: [typeof BadgePercent, string, string][] = [
    [BadgePercent, 'Partner prices', 'See your discounted price on every product, before you order.'],
    [QrCode, 'Scan at the counter', 'Scan a product QR code to see the price and add it to your cart.'],
    [Gift, 'Reward points', 'Earn points on every order once it’s handed over. Redeem them at the store.'],
    [BellRing, 'Order updates', 'Get notified when your order is packed, ready for pickup or out for delivery.'],
  ]
  return (
    <div>
      <section className="wrap pt-4"><div className="glass overflow-hidden rounded-[28px] !border-white/25 !bg-[rgb(35_128_47/0.84)] text-white">
        <div className="grid items-center gap-8 px-6 py-12 sm:px-10 lg:grid-cols-2">
          <div>
            <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">The BuildMate Partner app</h1>
            <p className="mt-4 max-w-lg text-lg text-white/90">For plumbers, electricians, contractors and builders who buy for their sites. Register with your mobile number, upload Aadhaar or PAN, and start ordering at partner prices once we approve you.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <div className="flex flex-wrap gap-3">
                <a href="/signup" className="btn bg-white text-leaf-700 hover:bg-leaf-50">Register as a partner</a>
                {store?.androidAppUrl && <a href={store.androidAppUrl} className="btn border border-white/60 text-white hover:bg-white/10">Get the Android app</a>}
              </div>
              {store?.iosAppUrl && <a href={store.iosAppUrl} className="btn bg-ink text-white">Download on the App Store</a>}
            </div>
          </div>
          <ol className="space-y-3 rounded-[22px] border border-white/20 bg-white/10 p-6 shadow-[inset_0_1px_0_rgb(255_255_255/0.2)]">
            {['Sign up here or in the app with your mobile number', 'Fill in your details and upload Aadhaar or PAN', 'We verify you, usually within a working day', 'Order at partner prices and earn points'].map((s, i) => (
              <li key={s} className="flex gap-3"><span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white font-bold text-leaf-700">{i + 1}</span><span className="pt-0.5">{s}</span></li>
            ))}
          </ol>
        </div>
      </div></section>
      <section className="wrap grid gap-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
        {points.map(([I, t, s]) => (
          <div key={t} className="glass rounded-[22px] p-5"><I className="h-7 w-7 text-leaf-600" /><h2 className="mt-3 font-bold">{t}</h2><p className="mt-1 text-sm text-ink-soft">{s}</p></div>
        ))}
      </section>
    </div>
  )
}
