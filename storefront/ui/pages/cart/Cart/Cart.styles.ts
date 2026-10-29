/** Cart-only styles; the page chrome and cards come from `checkout/shared`. */
import styled from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';
import { cardSurface, resetButton } from '../../checkout/shared/checkout.styles';

export const HeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const ItemList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

/**
 * Mobile: thumb | name + unit price | delete, with qty + line total below.
 * ≥ md: one row — thumb | details | qty | line total | delete.
 */
export const ItemRow = styled.li`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  grid-template-areas:
    'thumb info delete'
    'thumb qty total';
  align-items: center;
  column-gap: ${({ theme }) => theme.spacing.space4}px;
  row-gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => theme.spacing.space3}px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.divider};

  &:first-child {
    border-top: none;
    padding-top: 0;
  }

  &:last-child {
    padding-bottom: 0;
  }

  ${({ theme }) => theme.media.md} {
    grid-template-columns: auto minmax(0, 1fr) auto ${({ theme }) => theme.layout.cartLineTotalWidth}px auto;
    grid-template-areas: 'thumb info qty total delete';
    column-gap: ${({ theme }) => theme.spacing.space5}px;
    padding: ${({ theme }) => theme.spacing.space4}px 0;
  }
`;

export const ItemThumb = styled.div`
  grid-area: thumb;
  align-self: start;
  flex: none;
  box-sizing: border-box;
  width: ${({ theme }) => theme.layout.cartThumbSize}px;
  height: ${({ theme }) => theme.layout.cartThumbSize}px;
  padding: ${({ theme }) => theme.spacing.space1}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surfaceContainer};

  /* Never let a large source image stretch the row. */
  img {
    max-width: 100%;
    max-height: 100%;
  }

  ${({ theme }) => theme.media.md} {
    align-self: center;
    width: ${({ theme }) => theme.layout.cartThumbSizeWide}px;
    height: ${({ theme }) => theme.layout.cartThumbSizeWide}px;
  }
`;

export const ItemInfo = styled.div`
  grid-area: info;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space1}px;
`;

export const ItemName = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  font-size: 15px;
  font-weight: 500;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const ItemUnitPrice = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
`;

export const LineTotal = styled.span`
  grid-area: total;
  justify-self: end;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

export const DeleteButton = styled.button`
  ${resetButton}
  grid-area: delete;
  align-self: start;
  display: grid;
  place-items: center;
  width: ${({ theme }) => theme.spacing.space8}px;
  height: ${({ theme }) => theme.spacing.space8}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  color: ${({ theme }) => theme.colors.outline};
  transition:
    background 0.15s ease,
    color 0.15s ease;

  i {
    font-size: 15px;
  }

  &:hover {
    color: ${({ theme }) => theme.colors.error};
    background: ${({ theme }) => theme.colors.errorContainer};
  }

  ${({ theme }) => theme.media.md} {
    align-self: center;
  }
`;

export const QtyStepper = styled.div`
  grid-area: qty;
  justify-self: start;
  display: inline-flex;
  align-items: center;
  padding: 2px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surface};
`;

export const QtyButton = styled.button`
  ${resetButton}
  display: grid;
  place-items: center;
  width: ${({ theme }) => theme.layout.cartStepperButtonSize}px;
  height: ${({ theme }) => theme.layout.cartStepperButtonSize}px;
  border-radius: ${({ theme }) => theme.radius.xs}px;
  color: ${({ theme }) => theme.colors.primary};
  transition: background 0.15s ease;

  i {
    font-size: 11px;
    font-weight: 700;
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.06)};
  }

  &:disabled {
    color: ${({ theme }) => theme.colors.disabled};
  }
`;

export const QtyValue = styled.span`
  min-width: ${({ theme }) => theme.spacing.space8}px;
  text-align: center;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

// ── Empty state ─────────────────────────────────────────────────────────

export const EmptyState = styled.section`
  ${cardSurface}
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => `${theme.spacing.space12}px ${theme.spacing.space6}px`};
`;

export const EmptyIcon = styled.div`
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  margin-bottom: ${({ theme }) => theme.spacing.space2}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  color: ${({ theme }) => theme.storefront.headerBackground};

  i {
    font-size: 28px;
  }
`;

export const EmptyTitle = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  font-size: 18px;
  font-weight: 600;
`;

export const EmptySubtitle = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.space4}px;
  max-width: 320px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;
