import type { Metadata } from 'next'
import Link from 'next/link'
import ProductCard from '@/components/ProductCard'
import { serverApi } from '@/lib/server-api'

type SP = Record<string, string | undefined>
const keys = ['q', 'categoryId', 'subCategoryId', 'brandId', 'groupId', 'inStock', 'discounted', 'sort', 'page', 'typeId', 'class', 'familyId', 'size', 'length'] as const

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const cats = await serverApi.categories()
  const c = cats?.find((x) => String(x.id) === searchParams.categoryId)
  return { title: searchParams.q ? `Results for “${searchParams.q}”` : c ? `${c.name} online` : 'All products' }
}

export default async function Products({ searchParams }: { searchParams: SP }) {
  const qs = new URLSearchParams()
  keys.forEach((k) => searchParams[k] && qs.set(k, searchParams[k]!))
  qs.set('pageSize', '24')
  qs.set('collapse', 'true')
  const [res, cats, brands] = await Promise.all([serverApi.products(qs.toString()), serverApi.categories(), serverApi.brands()])
  const cat = cats?.find((c) => String(c.id) === searchParams.categoryId)
  const sub = cat?.subCategories.find((s) => String(s.id) === searchParams.subCategoryId)
  const brand = brands?.find((b) => String(b.id) === searchParams.brandId)
  const page = Number(searchParams.page ?? 1)
  const pages = res ? Math.ceil(res.total / res.pageSize) : 1

  const href = (patch: SP) => {
    const p = new URLSearchParams()
    keys.forEach((k) => { const v = k in patch ? patch[k] : k === 'page' ? undefined : searchParams[k]; if (v) p.set(k, v) })
    return `/products?${p.toString()}`
  }

  const title = searchParams.q ? `Results for “${searchParams.q}”` : sub?.name ?? cat?.name ?? brand?.name ?? (searchParams.discounted ? 'Deals' : 'All products')

  return (
    <div className="wrap py-6">
      <nav className="mb-2 text-sm text-ink-faint" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-pipe-700">Home</Link>
        {cat && <> / <Link href={`/products?categoryId=${cat.id}`} className="hover:text-pipe-700">{cat.name}</Link></>}
        {sub && <> / {sub.name}</>}
      </nav>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">{title}</h1>
          <p className="text-sm text-ink-soft">{res?.total ?? 0} {res?.total === 1 ? "result" : "results"}</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-sm">
          {[['', 'Popular'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['newest', 'Newest']].map(([v, l]) => (
            <Link key={v} href={href({ sort: v || undefined })} className={`rounded-full border px-3 py-1 ${(searchParams.sort ?? '') === v ? 'border-pipe-600 bg-pipe-50 font-semibold text-pipe-700' : 'border-line text-ink-soft hover:border-pipe-500'}`}>{l}</Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[230px_1fr]">
        <aside className="h-fit space-y-6 text-sm lg:glass lg:sticky lg:top-36 lg:max-h-[calc(100vh-10rem)] lg:overflow-y-auto lg:rounded-[22px] lg:p-5">
          <div>
            <h2 className="mb-2 font-bold">Category</h2>
            <ul className="space-y-1">
              <li><Link href={href({ categoryId: undefined, subCategoryId: undefined })} className={!cat ? 'font-semibold text-pipe-700' : 'text-ink-soft hover:text-ink'}>All categories</Link></li>
              {cats?.map((c) => (
                <li key={c.id}>
                  <Link href={href({ categoryId: String(c.id), subCategoryId: undefined })} className={cat?.id === c.id ? 'font-semibold text-pipe-700' : 'text-ink-soft hover:text-ink'}>{c.name}</Link>
                  {cat?.id === c.id && (
                    <ul className="ml-3 mt-1 space-y-1 border-l border-line pl-3">
                      {c.subCategories.map((s) => <li key={s.id}><Link href={href({ subCategoryId: String(s.id) })} className={sub?.id === s.id ? 'font-semibold text-pipe-700' : 'text-ink-soft hover:text-ink'}>{s.name}</Link></li>)}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-2 font-bold">Brand</h2>
            <div className="flex flex-wrap gap-1.5 lg:block lg:space-y-1">
              {brand && <Link href={href({ brandId: undefined })} className="block font-semibold text-pipe-700">× Clear {brand.name}</Link>}
              {brands?.filter((b) => b.id !== brand?.id).map((b) => (
                <Link key={b.id} href={href({ brandId: String(b.id) })} className="block rounded-full border border-line px-2.5 py-0.5 text-ink-soft hover:text-ink lg:rounded-none lg:border-0 lg:p-0">{b.name}</Link>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Link href={href({ inStock: searchParams.inStock ? undefined : 'true' })} className="flex items-center gap-2"><input type="checkbox" readOnly checked={!!searchParams.inStock} tabIndex={-1} /> In stock only</Link>
            <Link href={href({ discounted: searchParams.discounted ? undefined : 'true' })} className="flex items-center gap-2"><input type="checkbox" readOnly checked={!!searchParams.discounted} tabIndex={-1} /> On offer</Link>
          </div>
        </aside>

        <div>
          {!res?.items.length ? (
            <div className="glass-soft rounded-[22px] px-6 py-16 text-center">
              <p className="text-lg font-semibold">Nothing matched{searchParams.q ? ` “${searchParams.q}”` : ''}.</p>
              <p className="mt-1 text-ink-soft">Try a shorter word, a brand name, or the local name (e.g. “nal” for tap). Or call the store — we stock more than what's online.</p>
              <Link href="/products" className="btn-ghost mt-5">Browse all products</Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{res.items.map((p) => <ProductCard key={p.id} p={p} />)}</div>
              {pages > 1 && (
                <nav className="mt-8 flex items-center justify-center gap-2" aria-label="Pages">
                  {page > 1 && <Link href={href({ page: String(page - 1) })} className="btn-ghost">Previous</Link>}
                  <span className="num px-3 text-sm text-ink-soft">Page {page} of {pages}</span>
                  {page < pages && <Link href={href({ page: String(page + 1) })} className="btn-ghost">Next</Link>}
                </nav>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
