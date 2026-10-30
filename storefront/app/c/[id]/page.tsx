import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serverApi } from '@/lib/server-api'
import { CategoryBrowse, CategoryComingSoon } from '@/ui/screens'

async function category(id: string) {
  const cats = await serverApi.categories()
  return cats?.find((c) => String(c.id) === id) ?? null
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await category(params.id)
  if (!c) return { title: 'Category not found' }
  return c.productCount > 0
    ? { title: c.name, description: `${c.name}: ${c.productCount} products with GST invoice, store pickup or home delivery.` }
    : { title: `${c.name} — coming soon`, robots: { index: false } }
}

export default async function CategoryPage({ params }: { params: { id: string } }) {
  const c = await category(params.id)
  if (!c) notFound()
  // No products yet: the Coming soon page instead of an empty list. It switches on once admin adds a product.
  if (c.productCount <= 0) return <CategoryComingSoon categoryId={c.id} />
  return <CategoryBrowse categoryId={c.id} categoryName={c.name} />
}
