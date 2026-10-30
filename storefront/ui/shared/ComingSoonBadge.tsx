import styled, { css } from 'styled-components';

/** "Coming soon" pill for categories without products yet. */
export const ComingSoonBadge = styled.span<{ $floating?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.secondaryContainer ?? '#FFECD0'};
  color: ${({ theme }) => theme.colors.onSecondaryContainer ?? '#7A4A00'};
  font-size: 11px;
  font-weight: 700;
  line-height: 16px;
  white-space: nowrap;
  ${({ $floating }) => $floating && css`
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 1;
    max-width: calc(100% - 8px);
    padding: 1px 6px;
    font-size: 10px;
    line-height: 14px;
    overflow: hidden;
    text-overflow: ellipsis;
    @media (min-width: 768px) {
      top: 8px;
      left: 8px;
      padding: 2px 8px;
      font-size: 11px;
      line-height: 16px;
    }
  `}
`;

/** Dimmed look for a category tile that has no products yet (still tappable: opens the Coming soon page). */
export const soonDim = css`
  opacity: 0.6;
  filter: grayscale(0.35);
`;
