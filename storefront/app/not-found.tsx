import Link from 'next/link'
import { SitePage } from '@/ui/screens'
export default function NotFound() {
  return (
    <SitePage>
      <div className="wrap py-20 text-center">
        <h1 className="text-3xl font-bold">We couldn't find that page</h1>
        <p className="mt-2 text-ink-soft">The product may no longer be listed. Try searching instead.</p>
        <Link href="/search" className="btn-primary mt-6">Search products</Link>
      </div>
    </SitePage>
  )
}
