import 'server-only'
import type { CategoryTree, HomeFeed, Paged, ProductCard, ProductDetail, StoreInfo, BrandRef } from './types'

const API = process.env.API_URL ?? 'http://localhost:5080'

/** Server-side fetch for public catalogue pages without serving stale catalogue data. */
async function get<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, { headers: { 'X-Client': 'web' }, cache: 'no-store' })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`API ${res.status} for ${path}`)
    return (await res.json()) as T
  } catch (e) {
    console.error(e)
    return null
  }
}

export const serverApi = {
  home: () => get<HomeFeed>('/api/catalog/home'),
  store: () => get<StoreInfo>('/api/catalog/store'),
  categories: () => get<CategoryTree[]>('/api/catalog/categories'),
  brands: () => get<BrandRef[]>('/api/catalog/brands'),
  product: (id: string) => get<ProductDetail>(`/api/catalog/products/${encodeURIComponent(id)}`),
  products: (qs: string) => get<Paged<ProductCard>>(`/api/catalog/products?${qs}`),
}
