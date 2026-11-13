'use client';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { ReactNode } from 'react';
import type { CategoryTree, StoreInfo } from '@/lib/types';
import type { HomeCategory } from '../services/catalog/catalogModels';

const TINTS = [
  ['#1A56DB', '#D6E4FF'], ['#059669', '#CCFCE7'], ['#D97706', '#FFECD0'], ['#0369A1', '#E0F2FE'], ['#7C3AED', '#EDE9FE'], ['#DC2626', '#FFE0E0'],
];

export function toHomeCategory(c: CategoryTree, i: number): HomeCategory {
  const [iconColor, iconBackground] = TINTS[i % TINTS.length];
  return { id: String(c.id), name: c.name, itemCount: c.productCount, icon: 'pi-box', iconColor, iconBackground, imageAsset: c.imageUrl ?? '', comingSoon: c.productCount <= 0 };
}

interface CatalogValue {
  categories: HomeCategory[];
  raw: CategoryTree[];
  store: StoreInfo | null;
}

const CatalogContext = createContext<CatalogValue>({ categories: [], raw: [], store: null });

/** How often an open page re-reads the category list (also on tab focus), so categories switched off in the dashboard disappear. */
const REFRESH_MS = 120_000;

export function CatalogProvider({ categories: initial, store, children }: { categories: CategoryTree[]; store: StoreInfo | null; children: ReactNode }) {
  // The server renders the active categories; an open tab then keeps them current. On a failed refresh the last
  // server list stays (never a built-in list).
  const [categories, setCategories] = useState<CategoryTree[]>(initial);
  useEffect(() => { setCategories(initial); }, [initial]);
  useEffect(() => {
    let alive = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      api<CategoryTree[]>('/api/catalog/categories').then((c) => { if (alive && Array.isArray(c)) setCategories(c); }).catch(() => undefined);
    };
    const timer = window.setInterval(load, REFRESH_MS);
    window.addEventListener('focus', load);
    document.addEventListener('visibilitychange', load);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener('focus', load); document.removeEventListener('visibilitychange', load); };
  }, []);
  const value = useMemo<CatalogValue>(() => ({
    raw: categories,
    // Every active category: the ones with products first (admin order), then the rest marked "Coming soon".
    categories: [...categories.filter((c) => c.productCount > 0), ...categories.filter((c) => c.productCount <= 0)].map(toHomeCategory),
    store,
  }), [categories, store]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
export const categoryHref = (id: string | number) => `/c/${id}`;
