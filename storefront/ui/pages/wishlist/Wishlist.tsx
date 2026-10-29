'use client';
import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { api } from '@/lib/api';
import type { ProductCard } from '@/lib/types';
import { useNavigate } from '@/ui/router';
import { useWishlist, removeFromWishlist } from '../../services/wishlist/wishlist';
import { SitePage, PageColumn, PageTitle, PageSubtitle } from '../../shared/SitePage';
import { ProductTile } from '../../shared/ProductTile';
import { Grid, StateMessage, StateIcon, StateTitle, StateSubtitle } from '../catalog/PipesFittingCategory/PipesFittingCategory.styles';
import { textStyle } from '../../theme';

const Item = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
`;

const Remove = styled.button`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  align-self: center;
  margin-top: ${({ theme }) => theme.spacing.space2}px;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.colors.error};
  cursor: pointer;
`;

const Browse = styled.button`
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  height: 44px;
  padding: 0 ${({ theme }) => theme.spacing.space6}px;
  border: 0;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  cursor: pointer;
`;

/** Products saved with the heart on a product page (kept in this browser). Prices are live from the API. */
export function Wishlist() {
  const navigate = useNavigate();
  const ids = useWishlist();
  const [items, setItems] = useState<ProductCard[] | null>(null);

  useEffect(() => {
    if (!ids.length) { setItems([]); return; }
    api<ProductCard[]>('/api/catalog/products/batch', { method: 'POST', body: ids })
      .then((list) => setItems(ids.map((id) => list.find((p) => p.id === id)).filter((p): p is ProductCard => !!p)))
      .catch(() => setItems([]));
  }, [ids]);

  return (
    <SitePage>
      <PageColumn>
        <PageTitle>Wishlist</PageTitle>
        <PageSubtitle>Products you saved on this device.</PageSubtitle>
        {items && items.length === 0 ? (
          <StateMessage>
            <StateIcon><i className="pi pi-heart" aria-hidden /></StateIcon>
            <StateTitle>Nothing saved yet</StateTitle>
            <StateSubtitle>Tap the heart on a product to keep it here for later.</StateSubtitle>
            <Browse type="button" onClick={() => navigate('/')}>Browse products</Browse>
          </StateMessage>
        ) : (
          <Grid style={{ marginTop: 24 }}>
            {(items ?? []).map((p) => (
              <Item key={p.id}>
                <ProductTile p={p} onOpen={() => navigate(`/p/${p.id}`)} />
                <Remove type="button" onClick={() => removeFromWishlist(p.id)}>Remove</Remove>
              </Item>
            ))}
          </Grid>
        )}
      </PageColumn>
    </SitePage>
  );
}
