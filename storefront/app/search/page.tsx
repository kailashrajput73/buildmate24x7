import { Search } from '@/ui/screens'
export const metadata = { title: 'Search products' }
export default function Page({ searchParams }: { searchParams: { q?: string; categoryId?: string } }) {
  return <Search initialQuery={searchParams.q ?? ''} initialCategory={searchParams.categoryId ? Number(searchParams.categoryId) : null} />
}
