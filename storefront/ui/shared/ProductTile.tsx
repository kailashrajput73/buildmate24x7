'use client';
import { useTheme } from 'styled-components';
import type { ProductCard } from '@/lib/types';
import { CategoryImage } from './CategoryImage';
import { artFor } from '../session/CatalogContext';
import { WithWishlistHeart } from './WishlistHeart';
import {
  Card, CardMedia, AddBadge, AddBadgeLabel, AddBadgeCount, CardBody, CardPrice, Rupee, PriceUnit, CardDiscount, CardTitle,
} from '../pages/catalog/PipesFittingCategory/PipesFittingCategory.styles';

const amount = (v: number) => (v < 100 ? v.toFixed(2).replace(/\.00$/, '') : v.toFixed(0));

/** Product card in the kit's catalogue style, for search results and the wishlist. */
export function ProductTile({ p, onOpen, categoryName = '' }: { p: ProductCard; onOpen: () => void; categoryName?: string }) {
  const theme = useTheme();
  const price = p.fromPrice ?? p.price;
  const many = (p.variantCount ?? 1) > 1;
  return (
    <WithWishlistHeart productId={p.id} name={p.name}>
    <Card type="button" onClick={onOpen} aria-label={`${p.name}, ${many ? 'from ' : ''}₹${amount(price)}`}>
      <CardMedia>
        <CategoryImage imageAsset={p.imageUrl && !p.imageUrl.startsWith('/files/mock/') ? p.imageUrl : artFor(categoryName, p.imageUrl)}
          fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline} fallbackBackground={theme.colors.surfaceContainer}
          fit="contain" radius={theme.radius.md} iconSize={theme.spacing.space8} />
        <AddBadge>
          <AddBadgeLabel>{p.inStock ? 'ADD' : 'SOLD OUT'}</AddBadgeLabel>
          <AddBadgeCount>{many ? p.variantSummary ?? `${p.variantCount} Products` : p.brandName}</AddBadgeCount>
        </AddBadge>
      </CardMedia>
      <CardBody>
        <CardPrice>
          {many && <PriceUnit>from </PriceUnit>}
          <Rupee>₹</Rupee>
          {amount(price)}
          <PriceUnit> /{p.unit}</PriceUnit>
        </CardPrice>
        <CardDiscount>{p.discountPercent > 0 ? `discount ${Math.round(p.discountPercent)}%` : p.mrp > p.price + 0.005 ? `MRP ₹${p.mrp.toFixed(0)}` : ' '}</CardDiscount>
        <CardTitle title={p.name}>{p.name}</CardTitle>
      </CardBody>
    </Card>
    </WithWishlistHeart>
  );
}
