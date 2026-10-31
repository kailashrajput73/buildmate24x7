'use client';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from 'styled-components';
import { api } from '@/lib/api';
import { useShop } from '@/lib/shop';
import type { ProductDetail } from '@/lib/types';
import { useNavigate } from '@/ui/router';
import { AppRoutes } from '../../../routes/appRoutes';
import { useMaybePop } from '../../../hooks/useMaybePop';
import { toggleWishlist, useWishlist } from '../../../services/wishlist/wishlist';
import { useSession } from '../../../session/SessionContext';
import { CategoryImage } from '../../../shared/CategoryImage';
import { CartIconButton } from '../../../shared/CartIconButton';
import { StorefrontHeader } from '../../../shared/StorefrontHeader';
import { SnackBar } from '../../../shared/SnackBar';
import {
  Screen, TopBar, TopBarInner, BackButton, TopBarContext, SearchPill, MobileCartSlot, Body, Media, Details, DetailsInner,
  Eyebrow, BrandChip, Title, CartInfo, CartLabel, CartPrice, CartUnit, CartSize, AddToCartButton,
} from '../PipeConfigurator/PipeConfigurator.styles';
import {
  Thumbs, Thumb, MediaWrap, PriceRow, Mrp, Save, Stock, Points, Actions, QtyRow, Stepper, BuyNowButton, Section, SectionTitle,
  SpecTable, Description, Related, RelatedCard, TitleRow, HeartButton, OptionLabel, OptionBlocks, OptionBlock, BuyCard,
} from './ProductView.styles';

const money = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

/**
 * Product page in the design of the kit's pipe configurator: picture on the left; brand, name, a dropdown per option
 * (Size, Colour, Length… from the product's family), price and Add to Cart on the right. Every option is its own
 * product (own code, stock and price), so picking one opens that product's page.
 */
export function ProductView({ initial }: { initial: ProductDetail }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const maybePop = useMaybePop();
  const shop = useShop();
  const { isPartner } = useSession();
  const saved = useWishlist().includes(initial.id);
  const [p, setP] = useState<ProductDetail>(initial);
  const [image, setImage] = useState(0);
  const [qty, setQty] = useState(1);
  const [purchaseUnit, setPurchaseUnit] = useState<"Piece" | "Box">("Piece");
  const [busy, setBusy] = useState(false);
  const [snack, setSnack] = useState<{ id: number; message: string } | null>(null);
  const hideSnack = useCallback(() => setSnack(null), []);

  // The page is rendered with retail prices; a signed-in partner sees partner prices.
  useEffect(() => {
    setP(initial);
    setImage(0);
    setQty(1); setPurchaseUnit("Piece");
    if (shop.user) api<ProductDetail>(`/api/catalog/products/${initial.id}`).then(setP).catch(() => undefined);
  }, [initial, shop.user]);

  const open = (productId: number) => {
    if (productId !== p.id) navigate(`/p/${productId}`, { replace: true });
  };

  const axes = p.variantAxes?.length
    ? p.variantAxes
    : p.variants.length > 1
      ? [{ name: 'Size', choices: p.variants.map((v) => ({ value: v.label, productId: v.id, selected: v.id === p.id, exact: true, inStock: v.inStock })) }]
      : [];

  const add = async (thenCheckout: boolean) => {
    setBusy(true);
    const ok = await shop.add(p.id, qty, p.name, true, purchaseUnit);
    setBusy(false);
    if (!ok) return;
    if (thenCheckout) navigate(AppRoutes.cart);
    else setSnack((prev) => ({ id: (prev?.id ?? 0) + 1, message: `${p.name} added to cart` }));
  };

  const box = purchaseUnit === 'Box';
  const price = box ? p.catalog?.boxPrice ?? p.price : p.price;
  const mrp = box ? p.catalog?.packMrp ?? p.mrp : p.mrp;
  const available = box ? Math.floor(p.maxOrderQty / (p.catalog?.packSize ?? 1)) : p.maxOrderQty;
  const max = Math.max(1, Math.floor(available));
  const images = p.imageUrls.length ? p.imageUrls : p.imageUrl ? [p.imageUrl] : [];
  const save = Math.max(0, mrp - price);

  return (
    <Screen>
      <StorefrontHeader webOnly sticky={false} />
      <TopBar>
        <TopBarInner>
          <BackButton type="button" aria-label="Back" onClick={maybePop}>
            <i className="pi pi-arrow-left" aria-hidden="true" />
          </BackButton>
          <TopBarContext>{p.subCategoryName ?? p.categoryName}</TopBarContext>
          <SearchPill type="button" onClick={() => navigate(AppRoutes.search)}>
            <i className="pi pi-search" aria-hidden="true" />
            Search products
          </SearchPill>
          <MobileCartSlot>
            <CartIconButton />
          </MobileCartSlot>
        </TopBarInner>
      </TopBar>
      <Body>
        <MediaWrap>
          <Media>
            <CategoryImage imageAsset={images[image] ?? ''} fallbackIcon="pi-box" fallbackIconColor={theme.colors.outline}
              fallbackBackground={theme.colors.surfaceContainer} fit="contain" radius={theme.radius.lg} iconSize={theme.spacing.space8} />
          </Media>
          {images.length > 1 && (
            <Thumbs>
              {images.map((src, i) => (
                <Thumb key={src} type="button" $active={i === image} aria-label={`Picture ${i + 1}`} onClick={() => setImage(i)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" />
                </Thumb>
              ))}
            </Thumbs>
          )}
        </MediaWrap>
        <Details>
          <DetailsInner>
            <Eyebrow>
              <BrandChip>{p.brandName}</BrandChip>
              {p.subCategoryName ?? p.categoryName}
            </Eyebrow>
            <TitleRow>
              <Title>{p.name}</Title>
              <HeartButton type="button" $on={saved} aria-pressed={saved} aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                onClick={() => toggleWishlist(p.id)}>
                <i className={`pi ${saved ? 'pi-heart-fill' : 'pi-heart'}`} aria-hidden="true" />
              </HeartButton>
            </TitleRow>
            {axes.map((axis) => (
              <div key={axis.name}>
                <OptionLabel>{axis.name}</OptionLabel>
                <OptionBlocks role="group" aria-label={axis.name}>
                  {axis.choices.map((c) => (
                    <OptionBlock
                      key={`${c.value}-${c.productId}`}
                      type="button"
                      $selected={c.selected}
                      // Dashed = not made with the current other options; picking it changes them.
                      $other={!c.exact && !c.selected}
                      aria-pressed={c.selected}
                      onClick={() => open(c.productId)}
                    >
                      <strong>{c.value}</strong>
                      {!c.inStock && <small>Out of stock</small>}
                    </OptionBlock>
                  ))}
                </OptionBlocks>
              </div>
            ))}
            {p.catalog?.packSize && p.catalog.boxPrice != null && <><OptionLabel>Purchase unit</OptionLabel><OptionBlocks role="group" aria-label="Purchase unit">{(['Piece', 'Box'] as const).map(unit => <OptionBlock key={unit} $selected={purchaseUnit === unit} aria-pressed={purchaseUnit === unit} onClick={() => { setPurchaseUnit(unit); setQty(1); }}>{unit === 'Box' ? `Full box (${p.catalog?.packSize} ${p.unit})` : `Individual ${p.unit}`}</OptionBlock>)}</OptionBlocks></>}
            <BuyCard>
              <CartInfo>
                <CartLabel>{axes.length ? 'Selected product size' : 'Price'}</CartLabel>
                <PriceRow>
                  <CartPrice>
                    {money(price)}
                    <CartUnit> / {box ? 'box' : p.unit}</CartUnit>
                  </CartPrice>
                  {save > 0 && <Mrp>{money(mrp)}</Mrp>}
                  {save > 0 && <Save>Save {money(save)}</Save>}
                </PriceRow>
                <CartSize>{p.code}{p.variantLabel ? ` · ${p.variantLabel}` : ''} · incl. GST</CartSize>
                <Stock $out={!p.inStock}>{p.inStock ? 'In stock' : 'Out of stock'}</Stock>
                {isPartner && p.rewardPoints ? <Points>Earn {p.rewardPoints} reward points per {p.unit}</Points> : null}
              </CartInfo>
              <QtyRow>
                <span>Quantity</span>
                <Stepper role="group" aria-label="Quantity">
                  <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))}>
                    <i className="pi pi-minus" aria-hidden="true" />
                  </button>
                  <input inputMode="numeric" aria-label="Quantity" value={qty}
                    onChange={(e) => { const n = parseInt(e.target.value.replace(/\D/g, ''), 10); setQty(Number.isFinite(n) ? Math.min(max, Math.max(1, n)) : 1); }} />
                  <button type="button" aria-label="Increase quantity" disabled={qty >= max} onClick={() => setQty((q) => Math.min(max, q + 1))}>
                    <i className="pi pi-plus" aria-hidden="true" />
                  </button>
                </Stepper>
              </QtyRow>
              <Actions>
                <AddToCartButton type="button" disabled={available < 1 || busy} onClick={() => add(false)}>
                  <i className="pi pi-cart-plus" aria-hidden="true" />
                  Add to Cart
                </AddToCartButton>
                <BuyNowButton type="button" disabled={available < 1 || busy} onClick={() => add(true)}>
                  Buy Now
                </BuyNowButton>
              </Actions>
            </BuyCard>

            {p.specs.length > 0 && (
              <Section>
                <SectionTitle>Specifications</SectionTitle>
                <SpecTable>
                  {p.specs.map((s) => (
                    <div key={s.name} style={{ display: 'contents' }}>
                      <dt>{s.name}</dt>
                      <dd>{s.value}</dd>
                    </div>
                  ))}
                  {p.hsnCode && (
                    <div style={{ display: 'contents' }}>
                      <dt>HSN · GST</dt>
                      <dd>{p.hsnCode} · {p.gstRate}%</dd>
                    </div>
                  )}
                </SpecTable>
              </Section>
            )}
            {p.description && (
              <Section>
                <SectionTitle>About this product</SectionTitle>
                <Description>{p.description}</Description>
              </Section>
            )}
            {p.related.length > 0 && (
              <Section>
                <SectionTitle>Related products</SectionTitle>
                <Related>
                  {p.related.slice(0, 6).map((r) => (
                    <RelatedCard key={r.id} href={`/p/${r.id}`} onClick={(e) => { e.preventDefault(); navigate(`/p/${r.id}`); }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {r.imageUrl ? <img src={r.imageUrl} alt="" /> : <div className="ph" />}
                      <strong>{r.variantCount && r.variantCount > 1 ? 'from ' : ''}{money(r.fromPrice ?? r.price)}</strong>
                      <span>{r.name}</span>
                    </RelatedCard>
                  ))}
                </Related>
              </Section>
            )}
          </DetailsInner>
        </Details>
      </Body>
      {snack && (
        <SnackBar key={snack.id} message={snack.message} onDismissed={hideSnack} durationMs={3000} webAlign="center"
          action={{ label: 'View cart', onPressed: () => navigate(AppRoutes.cart) }} />
      )}
    </Screen>
  );
}
