'use client';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import type { CategoryTree, StoreInfo } from '@/lib/types';
import type { HomeCategory } from '../services/catalog/catalogModels';

/**
 * Categories (from admin) and store details, loaded by the root layout on the server and shared with the header,
 * side menu, footer and home screen. Categories without their own picture use the design kit's artwork by name.
 */
const ART: [RegExp, string][] = [
  [/pipe|fitting|tubing/i, '/assets/images/categories/plumbing_pipes_fittings.png'],
  [/sanitary|wash|closet|basin/i, '/assets/images/categories/sanitary_wares.png'],
  [/electric|wire|cable|light|switch|fan/i, '/assets/images/categories/electricals_lights.png'],
  [/hardware|tool/i, '/assets/images/categories/hardware_tools.png'],
  [/valve|plumbing/i, '/assets/images/categories/valves_controls.png'],
  [/cp |tap|faucet|shower/i, '/assets/images/categories/cp_fittings.png'],
  [/drain/i, '/assets/images/categories/drainage_accessories.png'],
  [/cement|plaster|building/i, '/assets/images/categories/cement_plaster.png'],
  [/tile|grout/i, '/assets/images/categories/tiling_grouts.png'],
  [/paint|putty/i, '/assets/images/categories/paints_putty.png'],
  [/lock|handle/i, '/assets/images/categories/locks_handles.png'],
  [/adhesive|fevicol/i, '/assets/images/categories/fevicol_adhesives.png'],
  [/consumable/i, '/assets/images/categories/consumables.png'],
];
const TINTS = [
  ['#1A56DB', '#D6E4FF'], ['#059669', '#CCFCE7'], ['#D97706', '#FFECD0'], ['#0369A1', '#E0F2FE'], ['#7C3AED', '#EDE9FE'], ['#DC2626', '#FFE0E0'],
];

export function artFor(name: string, imageUrl?: string | null): string {
  if (imageUrl && !imageUrl.startsWith('/files/mock/')) return imageUrl;
  return ART.find(([re]) => re.test(name))?.[1] ?? '/assets/images/categories/consumables.png';
}

export function toHomeCategory(c: CategoryTree, i: number): HomeCategory {
  const [iconColor, iconBackground] = TINTS[i % TINTS.length];
  return { id: String(c.id), name: c.name, itemCount: c.productCount, icon: 'pi-box', iconColor, iconBackground, imageAsset: artFor(c.name, c.imageUrl) };
}

interface CatalogValue {
  categories: HomeCategory[];
  raw: CategoryTree[];
  store: StoreInfo | null;
}

const CatalogContext = createContext<CatalogValue>({ categories: [], raw: [], store: null });

export function CatalogProvider({ categories, store, children }: { categories: CategoryTree[]; store: StoreInfo | null; children: ReactNode }) {
  const value = useMemo<CatalogValue>(() => ({
    raw: categories,
    categories: categories.filter((c) => c.productCount > 0).map(toHomeCategory),
    store,
  }), [categories, store]);
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export const useCatalog = () => useContext(CatalogContext);
export const categoryHref = (id: string | number) => `/c/${id}`;
