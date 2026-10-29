import Link from 'next/link'
import type { CategoryTree, StoreInfo } from '@/lib/types'

export default function Footer({ categories, store }: { categories: CategoryTree[]; store: StoreInfo | null }) {
  return (
    <footer className="mt-16 px-2 pb-2 sm:px-4">
      <div className="glass-dark mx-auto max-w-[1400px] rounded-[28px] text-pipe-50">
      <div className="wrap grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="" className="h-12 w-12 rounded-full bg-white" />
            <span className="text-xl font-extrabold [font-stretch:120%]">BuildMate 24x7</span>
          </div>
          <p className="mt-3 text-sm text-pipe-100/80">Building materials, plumbing, sanitary, hardware and electrical — genuine brands with a GST invoice.</p>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Shop</h2>
          <ul className="space-y-1.5 text-sm text-pipe-100/80">
            {categories.map((c) => <li key={c.id}><Link href={`/products?categoryId=${c.id}`} className="hover:text-white">{c.name}</Link></li>)}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Help</h2>
          <ul className="space-y-1.5 text-sm text-pipe-100/80">
            <li><Link href="/account/orders" className="hover:text-white">Track my order</Link></li>
            <li><Link href="/services" className="hover:text-white">Book a plumber or electrician</Link></li>
            <li><Link href="/partner" className="hover:text-white">Partner app for plumbers & electricians</Link></li>
            <li><Link href="/policies" className="hover:text-white">Delivery, returns & privacy</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-bold text-white">Visit or call</h2>
          <address className="space-y-1.5 text-sm not-italic text-pipe-100/80">
            {store?.address && <p>{store.address}</p>}
            <p>{store?.openingHours}</p>
            {store?.supportPhone && <p><a href={`tel:${store.supportPhone}`} className="hover:text-white">{store.supportPhone}</a></p>}
            {store?.whatsAppNumber && <p><a href={`https://wa.me/91${store.whatsAppNumber}`} className="hover:text-white">WhatsApp us</a></p>}
            {store?.supportEmail && <p><a href={`mailto:${store.supportEmail}`} className="hover:text-white">{store.supportEmail}</a></p>}
          </address>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="wrap flex flex-wrap justify-between gap-2 py-4 text-xs text-pipe-100/60">
          <span>© {new Date().getFullYear()} Shivani Electrochem Services</span>
          <span>Secure payments by Cashfree · UPI, cards, net banking</span>
        </div>
      </div>
    </div>
    </footer>
  )
}
