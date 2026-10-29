import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serverApi } from '@/lib/server-api'
import { money } from '@/lib/format'
import { ProductView } from '@/ui/screens'

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const p = await serverApi.product(params.id)
  if (!p) return { title: 'Product not found' }
  return { title: p.name, description: `${p.name} by ${p.brandName} at ${money(p.price)}. ${p.description ?? ''}`.slice(0, 160), openGraph: { images: p.imageUrls.slice(0, 1) } }
}

export default async function ProductPage({ params }: { params: { id: string } }) {
  const p = await serverApi.product(params.id)
  if (!p) notFound()
  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, sku: p.code, brand: { '@type': 'Brand', name: p.brandName }, image: p.imageUrls, description: p.description,
    offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: p.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock' },
  }
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <ProductView initial={p} />
    </>
  )
}
