import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

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

// ── Web side menu ───────────────────────────────────────────────────────

export const Sidebar = styled.aside`
  display: none;

  ${({ theme }) => theme.media.md} {
    position: sticky;
    top: ${({ theme }) => theme.layout.checkoutHeaderHeight}px;
    height: calc(100vh - ${({ theme }) => theme.layout.checkoutHeaderHeight}px);
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.surface};
    border-right: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

export const SidebarScroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${({ theme }) => `${theme.spacing.space4}px ${theme.spacing.space4}px`};
`;

export const SidebarLabel = styled.p`
  margin: ${({ theme }) => `${theme.spacing.space4}px 0 ${theme.spacing.space2}px`};
  padding: 0 ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8px;
  color: ${({ theme }) => theme.colors.outline};

  &:first-child {
    margin-top: 0;
  }
`;

export const NavList = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

const sidebarRow = css`
  ${resetButton}
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  min-height: 44px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  border-radius: ${({ theme }) => theme.radius.md}px;
  text-align: left;
  transition:
    background 0.15s ease,
    color 0.15s ease;
  ${focusRing}
`;

export const NavItem = styled.button<{ $active: boolean }>`
  ${sidebarRow}
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  font-size: 15px;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.onSurface)};
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryContainer : 'transparent')};

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.primaryContainer : theme.colors.surfaceContainer};
  }
`;

export const NavIcon = styled.span<{ $active: boolean }>`
  width: ${({ theme }) => theme.spacing.space8}px;
  height: ${({ theme }) => theme.spacing.space8}px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  color: ${({ theme, $active }) => ($active ? theme.colors.onPrimary : theme.colors.primary)};
  background: ${({ theme, $active }) =>
    $active ? theme.colors.primary : withAlpha(theme.colors.primary, 0.08)};
  transition: background 0.15s ease;

  i {
    font-size: 16px;
  }
`;

export const CategoryItem = styled.button`
  ${sidebarRow}
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  font-weight: 500;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

/** Category photo on its tint — `multiply` drops the photo's white backdrop. */
export const CategoryThumb = styled.span<{ $tint: string }>`
  width: ${({ theme }) => theme.layout.shellSidebarThumbSize + 4}px;
  height: ${({ theme }) => theme.layout.shellSidebarThumbSize + 4}px;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ $tint }) => $tint};

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    mix-blend-mode: multiply;
  }
`;

export const CategoryName = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const CategoryCount = styled.span`
  flex-shrink: 0;
  min-width: 24px;
  padding: 0 ${({ theme }) => theme.spacing.space1 + 2}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  text-align: center;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** Web stand-in for the AI assistant FAB (Home tab only, like Flutter). */
export const AiCard = styled.button`
  ${resetButton}
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  margin: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  text-align: left;
  color: ${({ theme }) => theme.colors.onPrimary};
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.loginFlow.accentGradient[0]} 0%,
    ${({ theme }) => theme.colors.primary} 55%,
    ${({ theme }) => theme.loginFlow.accentDeep} 100%
  );
  box-shadow: 0 10px 24px ${({ theme }) => withAlpha(theme.colors.primary, 0.3)};
  transition:
    transform 0.2s ${({ theme }) => theme.motion.easeOutCubic},
    box-shadow 0.2s ease;
  ${focusRing}

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 14px 28px ${({ theme }) => withAlpha(theme.colors.primary, 0.38)};
  }
`;

export const AiIcon = styled.span`
  width: ${({ theme }) => theme.spacing.space10}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.18)};

  i {
    font-size: 18px;
  }
`;

export const AiText = styled.span`
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const AiTitle = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  color: inherit;
`;

export const AiSubtitle = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => withAlpha(theme.colors.white, 0.8)};
`;
