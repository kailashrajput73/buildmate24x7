import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { serverApi } from '@/lib/server-api'
import { CategoryBrowse } from '@/ui/screens'

async function category(id: string) {
  const cats = await serverApi.categories()
  return cats?.find((c) => String(c.id) === id) ?? null
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const c = await category(params.id)
  return c ? { title: c.name, description: `${c.name}: ${c.productCount} products with GST invoice, store pickup or home delivery.` } : { title: 'Category not found' }
}

export default async function CategoryPage({ params }: { params: { id: string } }) {
  const c = await category(params.id)
  if (!c) notFound()
  return <CategoryBrowse categoryId={c.id} categoryName={c.name} />
}
