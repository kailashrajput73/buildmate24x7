import styled, { css, keyframes } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';

const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const resetButton = css`
  appearance: none;
  border: 0;
  margin: 0;
  font: inherit;
  cursor: pointer;
  background: none;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
`;

// ── Mobile app bar (Flutter AppBar: back, "Rewards", refresh) ──────────
export const MobileAppBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  height: 56px;
  padding: 0 ${({ theme }) => theme.spacing.space1}px;
  background: ${({ theme }) => theme.colors.background};

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

export const MobileTitle = styled.h1`
  flex: 1;
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
`;

export const IconButton = styled.button<{ $spinning?: boolean }>`
  ${resetButton}
  ${focusRing}
  width: ${({ theme }) => theme.components.minInteractiveDimension}px;
  height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  font-size: 20px;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }

  i {
    ${({ $spinning }) =>
      $spinning &&
      css`
        animation: ${spin} 0.8s linear infinite;
      `}
  }
`;

// ── Page ────────────────────────────────────────────────────────────────
export const Page = styled.main`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.rewardsMaxWidth}px;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space8}px ${theme.spacing.space6}px`};
  }
`;

// Web-only page heading (replaces the Flutter app bar at ≥ md).
export const WebHead = styled.div`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.space4}px;
    margin-bottom: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const BackLink = styled.button`
  ${resetButton}
  ${focusRing}
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin: 0 0 ${({ theme }) => theme.spacing.space2}px -12px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const WebTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineMedium)}
`;

export const WebSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const RefreshButton = styled.button<{ $spinning?: boolean }>`
  ${resetButton}
  ${focusRing}
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: 40px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  background: ${({ theme }) => theme.colors.surface};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }

  i {
    color: ${({ theme }) => theme.colors.primary};
    ${({ $spinning }) =>
      $spinning &&
      css`
        animation: ${spin} 0.8s linear infinite;
      `}
  }
`;

export const Layout = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space6}px;

  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns: ${({ theme }) => theme.layout.rewardsSummaryWidth}px minmax(0, 1fr);
    gap: ${({ theme }) => theme.spacing.space8}px;
    align-items: start;
  }
`;

export const Summary = styled.aside`
  ${({ theme }) => theme.media.md} {
    position: sticky;
    top: ${({ theme }) => theme.layout.checkoutHeaderHeight + theme.spacing.space6}px;
  }
`;

// ── Points card (_RewardPointsCard) ─────────────────────────────────────
export const PointsCard = styled.section`
  position: relative;
  overflow: hidden;
  padding: ${({ theme }) => theme.spacing.space5}px;
  border-radius: ${({ theme }) => theme.radius.xl}px;
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.rewards.cardGradient[0]} 0%,
    ${({ theme }) => theme.rewards.cardGradient[1]} 55%,
    ${({ theme }) => theme.rewards.cardGradient[2]} 100%
  );
  box-shadow: 0 12px 24px ${({ theme }) => withAlpha(theme.colors.primary, 0.35)};

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const Glow = styled.span<{ $size: number; $color: string }>`
  position: absolute;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: radial-gradient(circle, ${({ $color }) => $color}, transparent 70%);
  pointer-events: none;
`;

export const Medal = styled.i`
  position: absolute;
  top: 18px;
  right: 20px;
  font-size: 56px;
  color: ${({ theme }) => withAlpha(theme.rewards.gold, 0.9)};
  pointer-events: none;
`;

export const CardBody = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

export const PointsBadge = styled.span`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.14)};
  border: 1px solid ${({ theme }) => withAlpha(theme.colors.white, 0.2)};
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.white};
  font-weight: 600;
  letter-spacing: 0.3px;

  i {
    font-size: 16px;
    color: ${({ theme }) => theme.rewards.gold};
  }
`;

export const BalanceLabel = styled.span`
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => withAlpha(theme.colors.white, 0.7)};
`;

export const BalanceRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin-top: ${({ theme }) => theme.spacing.space1}px;
`;

export const BalanceValue = styled.span`
  ${({ theme }) => textStyle(theme.typography.headlineMedium)}
  color: ${({ theme }) => theme.colors.white};
  font-size: 44px;
  font-weight: 800;
  line-height: 1;
  letter-spacing: -0.5px;

  ${({ theme }) => theme.media.md} {
    font-size: 52px;
  }
`;

export const BalanceUnit = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  color: ${({ theme }) => theme.rewards.gold};
  font-weight: 700;
`;

export const StatsBox = styled.div`
  align-self: stretch;
  display: flex;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.space3}px;
  margin-top: ${({ theme }) => theme.spacing.space5}px;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.1)};
  border: 1px solid ${({ theme }) => withAlpha(theme.colors.white, 0.15)};
`;

export const StatDivider = styled.span`
  width: 1px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.2)};
`;

export const Stat = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
`;

export const StatIcon = styled.span<{ $color: string }>`
  flex: none;
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ $color }) => withAlpha($color, 0.18)};
  color: ${({ $color }) => $color};
  font-size: 14px;
`;

export const StatText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;

  span,
  strong {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
  }

  span {
    ${({ theme }) => textStyle(theme.typography.labelSmall)}
    color: ${({ theme }) => withAlpha(theme.colors.white, 0.7)};
  }

  strong {
    ${({ theme }) => textStyle(theme.typography.titleSmall)}
    color: ${({ theme }) => theme.colors.white};
    font-weight: 700;
  }
`;

// ── Reward history ──────────────────────────────────────────────────────
export const HistoryTitle = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin: 0 0 ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}

  i {
    font-size: 18px;
    color: ${({ theme }) => theme.colors.primary};
  }

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.titleLarge)}
    margin-bottom: ${({ theme }) => theme.spacing.space4}px;
  }
`;

export const HistoryList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

export const HistoryTile = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};

  ${({ theme }) => theme.media.md} {
    align-items: center;
    gap: ${({ theme }) => theme.spacing.space4}px;
    padding: ${({ theme }) => `${theme.spacing.space4}px ${theme.spacing.space5}px`};
    transition: box-shadow 0.15s ease;

    &:hover {
      box-shadow: ${({ theme }) => theme.elevation.level2};
    }
  }
`;

export const TileIcon = styled.span<{ $positive: boolean }>`
  flex: none;
  width: 42px;
  height: 42px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 16px;
  background: ${({ theme, $positive }) =>
    $positive ? theme.colors.successContainer : theme.colors.errorContainer};
  color: ${({ theme, $positive }) => ($positive ? theme.colors.success : theme.colors.error)};
`;

export const TileBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas:
      'title points'
      'desc date';
    column-gap: ${({ theme }) => theme.spacing.space4}px;
    row-gap: 2px;
    align-items: baseline;
  }
`;

export const TileTop = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.md} {
    display: contents;
  }
`;

export const TileTitle = styled.span`
  grid-area: title;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurface};
  font-weight: 700;
`;

export const TilePoints = styled.span<{ $positive: boolean }>`
  grid-area: points;
  justify-self: end;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  color: ${({ theme, $positive }) => ($positive ? theme.colors.success : theme.colors.error)};
  font-weight: 800;
`;

export const TileDetails = styled.div`
  grid-area: desc;
  margin-top: ${({ theme }) => theme.spacing.space1}px;
  display: flex;
  flex-direction: column;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.outline};

  ${({ theme }) => theme.media.md} {
    margin-top: 0;
    flex-direction: row;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.space2}px;

    span + span::before {
      content: '·';
      margin-right: ${({ theme }) => theme.spacing.space2}px;
    }
  }
`;

export const TileDate = styled.span`
  grid-area: date;
  justify-self: end;
  margin-top: ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  ${({ theme }) => theme.media.md} {
    margin-top: 0;
  }
`;

export const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing.space5}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => theme.spacing.space12}px ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const EmptyIcon = styled.span`
  width: 64px;
  height: 64px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryContainer};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 28px;
`;

export const EmptyTitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space3}px 0 ${({ theme }) => theme.spacing.space1}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

export const EmptySubtitle = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.outline};
`;
