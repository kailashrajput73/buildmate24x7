import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Brand, Category, Paged, ProductGroup, SubCategory } from './types'

// Dropdown sources, cached for a few minutes.
const opts = { staleTime: 5 * 60_000 }

export const useCategories = () =>
  useQuery({ queryKey: ['categories', 'all'], queryFn: () => api.get<Paged<Category>>('/api/admin/categories', { pageSize: 200 }).then((r) => r.items), ...opts })

export const useSubCategories = (categoryId?: number) =>
  useQuery({ queryKey: ['subcategories', 'all', categoryId], queryFn: () => api.get<Paged<SubCategory>>('/api/admin/subcategories', { pageSize: 200, categoryId }).then((r) => r.items), ...opts })

export const useBrands = () =>
  useQuery({ queryKey: ['brands', 'all'], queryFn: () => api.get<Paged<Brand>>('/api/admin/brands', { pageSize: 200 }).then((r) => r.items), ...opts })

export const useGroups = () =>
  useQuery({ queryKey: ['groups'], queryFn: () => api.get<ProductGroup[]>('/api/admin/product-groups'), ...opts })

export const useRackLocations = () =>
  useQuery({ queryKey: ['racklocations'], queryFn: () => api.get<{ id: number; label: string }[]>('/api/admin/racks/locations'), ...opts })

export const useManagers = () =>
  useQuery({ queryKey: ['managers'], queryFn: () => api.get<{ id: number; name: string }[]>('/api/admin/team/managers'), ...opts })
