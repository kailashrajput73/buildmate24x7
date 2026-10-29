import 'server-only'
import type { CategoryTree, HomeFeed, Paged, ProductCard, ProductDetail, StoreInfo, BrandRef } from './types'

const API = process.env.API_URL ?? 'http://localhost:5080'

/** Server-side fetch for public catalogue pages (SEO-friendly, cached briefly). */
async function get<T>(path: string, revalidate = 60): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'X-Client': 'web' }, next: { revalidate } })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API ${res.status} for ${path}`)
    return (await res.json()) as T
  } catch (e) {
    console.error(e)
    return null
  }
}

export const serverApi = {
  home: () => get<HomeFeed>('/api/catalog/home', 60),
  store: () => get<StoreInfo>('/api/catalog/store', 300),
  categories: () => get<CategoryTree[]>('/api/catalog/categories', 300),
  brands: () => get<BrandRef[]>('/api/catalog/brands', 300),
  product: (id: string) => get<ProductDetail>(`/api/catalog/products/${encodeURIComponent(id)}`, 60),
  products: (qs: string) => get<Paged<ProductCard>>(`/api/catalog/products?${qs}`, 30),
}
