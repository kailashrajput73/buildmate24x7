'use client';
import type { ReactNode } from 'react';
import styled from 'styled-components';
import { toggleWishlist, useWishlist } from '../services/wishlist/wishlist';

/**
 * Wraps a product card (itself a button) and lays a heart toggle over its top-right corner.
 * The heart is a separate button, so tapping it never opens the product.
 */
export function WithWishlistHeart({ productId, name, children }: { productId: number; name: string; children: ReactNode }) {
  const saved = useWishlist().includes(productId);
  return (
    <Wrap>
      {children}
      <Heart
        type="button"
        $on={saved}
        aria-pressed={saved}
        aria-label={saved ? `Remove ${name} from wishlist` : `Save ${name} to wishlist`}
        title={saved ? 'Remove from wishlist' : 'Save to wishlist'}
        onClick={(e) => { e.stopPropagation(); toggleWishlist(productId); }}
      >
        <i className={saved ? 'pi pi-heart-fill' : 'pi pi-heart'} aria-hidden />
      </Heart>
    </Wrap>
  );
}

const Wrap = styled.div`
  position: relative;
  display: grid;
  min-width: 0;
  > :first-child { min-width: 0; }
`;

const Heart = styled.button<{ $on: boolean }>`
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  color: ${({ $on, theme }) => ($on ? theme.colors.error : theme.colors.onSurfaceVariant)};
  cursor: pointer;
  font-size: 15px;
  transition: transform 0.12s ease;

  &:active { transform: scale(0.9); }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;
