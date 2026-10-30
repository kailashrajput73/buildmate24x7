/**
 * BuildMate catalogue → the shapes the design's category screen needs.
 * Source: GET /api/catalog/categories/{id}/items (one row per size, with specifications).
 */
export interface CatalogItem {
  id: number;
  code: string;
  name: string;
  brandName: string;
  brandId: number;
  subCategoryId?: number | null;
  subCategoryName?: string | null;
  unit: string;
  imageUrl?: string | null;
  mrp: number;
  listPrice: number;
  discountPercent: number;
  price: number;
  inStock: boolean;
  rewardPoints?: number | null;
  family?: string | null;
  variantLabel?: string | null;
  specs: Record<string, string>;
  sequence: number;
}

/** One card: a product family (all sizes / colours of one item from one brand), or a single product. */
export interface ProductGroup {
  key: string;
  title: string;
  /** Sidebar "Type": material for pipes & fittings (UPVC / CPVC / PVC), otherwise the sub category. */
  type: string;
  /** Item under the type, e.g. "Coupler", "Elbow 90°", "House Wire". */
  subCategory: string;
  /**
   * The admin sub category with the type taken off ("CPVC Pipes" → "Pipes") when the sidebar's types are materials;
   * null otherwise (then the types already are the admin sub categories).
   */
  section: string | null;
  className: string | null;
  items: CatalogItem[];
  unit: string;
  imageUrl: string | null;
  minPrice: number;
  minMrp: number;
  mrpAbovePrice: boolean;
  maxDiscount: number;
  inStock: boolean;
  /** Product to open: the first size in stock. */
  openId: number;
}

const spec = (i: CatalogItem, ...names: string[]) => {
  for (const n of names) {
    const v = i.specs[n] ?? Object.entries(i.specs).find(([k]) => k.toLowerCase() === n.toLowerCase())?.[1];
    if (v) return v;
  }
  return undefined;
};

export const classOf = (i: CatalogItem) => spec(i, 'Class', 'SDR', 'Schedule') ?? null;

/** Size in mm when the size starts with a number of millimetres ("15 mm (½")", "80×65 mm"). */
export function sizeMm(i: CatalogItem): number | null {
  const s = spec(i, 'Size') ?? i.variantLabel ?? '';
  const m = /^(\d+(?:\.\d+)?)\s*(?:[×x]\s*\d+(?:\.\d+)?\s*)?mm/i.exec(s.trim());
  return m ? parseFloat(m[1]) : null;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** "King CPVC Coupler SDR 11" − brand − material − class → "Coupler". */
function itemName(i: CatalogItem, material: string | undefined, cls: string | null): string {
  let f = (i.family ?? i.name.split(' – ')[0]).trim();
  f = f.replace(new RegExp(`^${escapeRe(i.brandName)}\\s+`, 'i'), '');
  if (material) f = f.replace(new RegExp(`^${escapeRe(material)}\\s+`, 'i'), '');
  if (cls) f = f.replace(new RegExp(`\\s+${escapeRe(cls)}$`, 'i'), '');
  return f.trim() || i.subCategoryName || 'Other';
}

/** "CPVC Pipes" + material CPVC → "Pipes"; a sub category without the material in its name is kept as is. */
export function sectionName(subCategoryName: string | null | undefined, material: string | undefined): string | null {
  if (!subCategoryName) return null;
  if (!material) return subCategoryName.trim();
  const m = escapeRe(material.trim());
  const name = subCategoryName.replace(new RegExp(`^${m}\\s+|\\s+${m}$`, 'i'), '').trim();
  return name || subCategoryName.trim();
}

/** Store order for pipe & fitting materials: UPVC, PVC, CPVC, then everything else (A–Z), "Other" last. */
const MATERIAL_ORDER = ['UPVC', 'PVC', 'CPVC'];
export function typeRank(type: string): number {
  const i = MATERIAL_ORDER.indexOf(type.trim().toUpperCase());
  return i >= 0 ? i : type.trim().toLowerCase() === 'other' ? 1000 : 100;
}
export function compareTypes(a: string, b: string): number {
  return typeRank(a) - typeRank(b) || a.localeCompare(b);
}

export function buildGroups(items: CatalogItem[]): ProductGroup[] {
  // Use the material as the type when most products in the category have one (pipes & fittings).
  const withMaterial = items.filter((i) => spec(i, 'Material')).length;
  const byMaterial = withMaterial > items.length / 2;
  const groups = new Map<string, ProductGroup>();
  for (const i of items) {
    const material = spec(i, 'Material');
    const cls = classOf(i);
    const key = i.family ? `f:${i.family}` : `p:${i.id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        title: i.family ?? i.name,
        type: byMaterial ? (material?.toUpperCase() ?? 'Other') : (i.subCategoryName ?? 'Other'),
        subCategory: byMaterial ? itemName(i, material, cls) : itemName(i, undefined, null),
        section: byMaterial ? sectionName(i.subCategoryName, material) : null,
        className: cls,
        items: [],
        unit: i.unit,
        imageUrl: null,
        minPrice: Infinity,
        minMrp: Infinity,
        mrpAbovePrice: false,
        maxDiscount: 0,
        inStock: false,
        openId: i.id,
      };
      groups.set(key, g);
    }
    g.items.push(i);
    if (!g.imageUrl && i.imageUrl && !i.imageUrl.startsWith('/files/mock/')) g.imageUrl = i.imageUrl;
    g.minPrice = Math.min(g.minPrice, i.price);
    g.minMrp = Math.min(g.minMrp, i.mrp);
    g.mrpAbovePrice = g.mrpAbovePrice || i.mrp > i.price + 0.005;
    g.maxDiscount = Math.max(g.maxDiscount, i.discountPercent);
    if (i.inStock && !g.inStock) { g.inStock = true; g.openId = i.id; }
  }
  // Products without a real photo keep the demo artwork so the grid is never blank.
  for (const g of groups.values()) if (!g.imageUrl) g.imageUrl = g.items.find((i) => i.imageUrl)?.imageUrl ?? null;
  return [...groups.values()];
}
