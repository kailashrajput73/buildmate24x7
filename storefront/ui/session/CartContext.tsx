'use client';
import { createContext, useCallback, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useShop } from '@/lib/shop';
import type { Cart } from '@/lib/types';
import type { CartItem, ProductVariant } from '../services/catalog/catalogModels';

/** Kept for the kit's types; BuildMate has no coupon codes. */
export interface CartCoupon {
  code: string;
  type: 'percent' | 'freeShipping';
  label: string;
}

/** Amounts are GST-inclusive, as charged. */
export interface CartTotals {
  /** Sum of list prices (MRP). */
  subtotal: number;
  /** Partner / retail discounts. */
  discount: number;
  shipping: number;
  /** BuildMate prices include GST, so nothing is added on top. */
  gst: number;
  roundOff: number;
  /** What the customer pays (rounded to the rupee). */
  grandTotal: number;
  toFreeShipping: number;
}

interface CartContextValue {
  items: CartItem[];
  totalQuantity: number;
  isEmpty: boolean;
  coupon: CartCoupon | null;
  totals: CartTotals;
  /** The BuildMate cart: stock issues, minimum order, delivery rules. */
  raw: Cart | null;
  busy: boolean;
  addVariant: (variant: ProductVariant, quantity?: number) => Promise<boolean>;
  setQuantity: (variantId: string, quantity: number) => Promise<boolean>;
  remove: (variantId: string) => Promise<boolean>;
  clear: () => Promise<void>;
  /** Re-reads the cart from the API (after it was changed elsewhere, e.g. turned into a quotation). */
  reload: () => Promise<void>;
  applyCoupon: (code: string) => CartCoupon | null;
  removeCoupon: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

/** BuildMate cart line → the kit's ProductVariant. */
function variantOf(l: Cart['items'][number]): ProductVariant {
  return {
    id: String(l.productId),
    productId: String(l.productId),
    productName: l.name,
    sku: l.code,
    brandId: '',
    brandName: l.brandName,
    categoryId: '',
    categoryName: '',
    subCategoryId: '',
    subCategoryName: '',
    description: '',
    price: l.unitPrice,
    unit: l.unit,
    icon: 'pi-box',
    rating: 0,
    reviewCount: 0,
    stockStatus: l.availableQty <= 0 ? 'outOfStock' : l.issue ? 'limited' : 'inStock',
    specifications: l.issue ? { Issue: l.issue } : {},
    imageAsset: l.imageUrl ?? '',
    mrp: l.mrp,
    minimumOrderQuantity: 1,
  };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const shop = useShop();
  const raw = shop.cart;

  const items = useMemo<CartItem[]>(() => (raw?.items ?? []).map((l) => ({ variant: variantOf(l), quantity: l.quantity })), [raw]);

  const totals = useMemo<CartTotals>(() => {
    const total = raw?.total ?? 0;
    const fee = raw?.deliveryFee ?? 0;
    return {
      subtotal: raw?.subTotal ?? 0,
      discount: raw?.discountTotal ?? 0,
      shipping: fee,
      gst: 0,
      roundOff: raw?.roundOff ?? 0,
      grandTotal: raw?.payable ?? Math.round(total + fee),
      toFreeShipping: raw && raw.freeDeliveryAbove > 0 ? Math.max(0, raw.freeDeliveryAbove - total) : 0,
    };
  }, [raw]);

  const addVariant = useCallback((variant: ProductVariant, quantity = 1) =>
    shop.add(Number(variant.productId || variant.id), Math.max(1, quantity), variant.productName), [shop]);
  const setQuantity = useCallback((variantId: string, quantity: number) => shop.setQty(Number(variantId), Math.max(0, quantity)), [shop]);
  const remove = useCallback((variantId: string) => shop.remove(Number(variantId)), [shop]);
  const clear = useCallback(async () => {
    for (const l of raw?.items ?? []) await shop.remove(l.productId);
  }, [shop, raw]);
  const applyCoupon = useCallback(() => null, []);
  const removeCoupon = useCallback(() => undefined, []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    isEmpty: items.length === 0,
    reload: shop.reloadCart,
    coupon: null,
    totals,
    raw,
    busy: shop.cartBusy,
    addVariant,
    setQuantity,
    remove,
    clear,
    applyCoupon,
    removeCoupon,
  }), [items, totals, raw, shop.cartBusy, shop.reloadCart, addVariant, setQuantity, remove, clear, applyCoupon, removeCoupon]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
