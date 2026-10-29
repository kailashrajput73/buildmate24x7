import styled, { css } from 'styled-components';
import { textStyle } from '../../../theme';

/** Extras for the product page, in the configurator's language (theme tokens only). */
const resetButton = css`
  appearance: none;
  border: none;
  margin: 0;
  padding: 0;
  background: none;
  font: inherit;
  cursor: pointer;
`;

export const Thumbs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin-top: ${({ theme }) => theme.spacing.space2}px;
  overflow-x: auto;

  ${({ theme }) => theme.media.md} {
    position: absolute;
    left: ${({ theme }) => theme.spacing.space8}px;
    bottom: ${({ theme }) => theme.spacing.space6}px;
    margin: 0;
  }
`;

export const Thumb = styled.button<{ $active: boolean }>`
  ${resetButton}
  flex: 0 0 auto;
  width: 56px;
  height: 56px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 2px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.divider)};
  background: ${({ theme }) => theme.colors.surface};
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

export const MediaWrap = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;

  ${({ theme }) => theme.media.md} {
    min-height: 0;
  }
`;

export const PriceRow = styled.div`
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.space2}px;
`;

export const Mrp = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  text-decoration: line-through;
  color: ${({ theme }) => theme.colors.outline};
`;

export const Save = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 700;
  color: ${({ theme }) => theme.colors.success};
`;

export const Stock = styled.span<{ $out?: boolean }>`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 600;
  color: ${({ theme, $out }) => ($out ? theme.colors.error : theme.colors.success)};
`;

export const Points = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.secondary};
  font-weight: 600;
`;

export const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  align-items: stretch;

  > * {
    flex: 1;
  }
`;

export const QtyRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
`;

export const Stepper = styled.div`
  display: inline-flex;
  align-items: center;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => theme.colors.surface};
  overflow: hidden;

  button {
    ${resetButton}
    width: 40px;
    height: 40px;
    color: ${({ theme }) => theme.colors.primary};

    &:disabled {
      color: ${({ theme }) => theme.colors.disabled};
      cursor: default;
    }
  }

  input {
    width: 56px;
    height: 40px;
    border: none;
    text-align: center;
    ${({ theme }) => textStyle(theme.typography.titleSmall)}
    background: transparent;

    &:focus {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: -2px;
    }
  }
`;

export const BuyNowButton = styled.button`
  ${resetButton}
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  min-height: 44px;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  color: ${({ theme }) => theme.colors.onPrimary};
  font-weight: 800;

  &:hover {
    background: ${({ theme }) => theme.colors.primaryPressed};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.disabledContainer};
    color: ${({ theme }) => theme.colors.disabled};
    cursor: default;
  }

  ${({ theme }) => theme.media.md} {
    height: ${({ theme }) => theme.spacing.buttonHeight}px;
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    color: ${({ theme }) => theme.colors.onPrimary};
    font-weight: 800;
  }
`;

export const Section = styled.section`
  margin-top: ${({ theme }) => theme.spacing.space6}px;
`;

export const SectionTitle = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 800;
`;

export const SpecTable = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: minmax(110px, 40%) 1fr;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.md}px;
  overflow: hidden;

  dt,
  dd {
    margin: 0;
    padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
    ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  }

  dt {
    background: ${({ theme }) => theme.colors.surfaceContainer};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }

  dd {
    color: ${({ theme }) => theme.colors.onSurface};
  }

  dt:nth-last-of-type(1),
  dd:last-of-type {
    border-bottom: none;
  }
`;

export const Description = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  white-space: pre-line;
`;

export const Related = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.sm} {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
`;

export const RelatedCard = styled.a`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space1}px;
  padding: ${({ theme }) => theme.spacing.space2}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surface};
  text-decoration: none;

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
  }

  img,
  .ph {
    width: 100%;
    aspect-ratio: 1;
    object-fit: contain;
    border-radius: ${({ theme }) => theme.radius.sm}px;
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }

  strong {
    ${({ theme }) => textStyle(theme.typography.titleSmall)}
    font-weight: 800;
  }

  span {
    ${({ theme }) => textStyle(theme.typography.bodySmall)}
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
`;

export const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

export const HeartButton = styled.button<{ $on: boolean }>`
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme, $on }) => ($on ? theme.colors.error : theme.colors.onSurfaceVariant)};
  cursor: pointer;
  font-size: 18px;

  &:hover { border-color: ${({ theme }) => theme.colors.error}; color: ${({ theme }) => theme.colors.error}; }
  &:focus-visible { outline: 2px solid ${({ theme }) => theme.colors.primary}; outline-offset: 2px; }
`;

/** Option label above a row of blocks (Brand, Class, Size…), shown on phones too. */
export const OptionLabel = styled.p`
  margin: ${({ theme }) => theme.spacing.space4}px 0 ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

/** Tappable blocks instead of a dropdown, as in the client's app: 4 across on phones, more on wide screens. */
export const OptionBlocks = styled.div`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  }
`;

export const OptionBlock = styled.button<{ $selected: boolean; $other?: boolean }>`
  ${resetButton}
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-height: 52px;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space1}px`};
  text-align: center;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  border: 1.5px ${({ $other }) => ($other ? 'dashed' : 'solid')}
    ${({ theme, $selected }) => ($selected ? theme.colors.accentGreen : theme.colors.outlineVariant)};
  background: ${({ theme, $selected }) => ($selected ? theme.colors.accentGreenContainer : theme.colors.surface)};
  transition: border-color 0.15s ease, background 0.15s ease;

  &:hover:not(:disabled) {
    border-color: ${({ theme, $selected }) => ($selected ? theme.colors.accentGreen : theme.colors.primary)};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }

  strong {
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    font-weight: 600;
    color: ${({ theme, $selected }) => ($selected ? theme.colors.onAccentGreenContainer : theme.colors.onSurface)};
    overflow-wrap: anywhere;
  }

  small {
    ${({ theme }) => textStyle(theme.typography.labelSmall)}
    color: ${({ theme }) => theme.colors.outline};
  }
`;

/** The price / quantity / buttons card: stacked on phones (the configurator's one-row card is too tight here). */
export const BuyCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.space4}px;
  margin-top: ${({ theme }) => theme.spacing.space5}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.lg}px;

  ${({ theme }) => theme.media.md} {
    gap: ${({ theme }) => theme.spacing.space5}px;
    margin-top: ${({ theme }) => theme.spacing.space8}px;
    padding: ${({ theme }) => theme.spacing.space6}px;
  }
`;
