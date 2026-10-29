/**
 * Subset of Flutter `catalog_models.dart` needed by the Pipes & Fittings
 * module (the fields `_variantFor` fills in). Other catalog fields are added
 * when their modules are converted.
 */

export type StockStatus = 'inStock' | 'outOfStock' | 'limited';

export interface ProductVariant {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  brandId: string;
  brandName: string;
  categoryId: string;
  categoryName: string;
  subCategoryId: string;
  subCategoryName: string;
  description: string;
  price: number;
  unit: string;
  icon: string;
  rating: number;
  reviewCount: number;
  stockStatus: StockStatus;
  specifications: Record<string, string>;
  imageAsset: string;
  mrp: number;
  /** Flutter default: 1. */
  minimumOrderQuantity: number;
}

export interface CartItem {
  variant: ProductVariant;
  quantity: number;
}

/** Flutter `HomeCategory` (home_models.dart) — a catalog category as Home shows it. */
export interface HomeCategory {
  id: string;
  name: string;
  itemCount: number;
  /** primeicons class (Flutter icon name mapped). */
  icon: string;
  iconColor: string;
  iconBackground: string;
  imageAsset: string;
}
