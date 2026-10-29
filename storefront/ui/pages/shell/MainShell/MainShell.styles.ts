import styled, { css } from 'styled-components';
import { textStyle } from '../../../theme';

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

/** Scaffold — mobile: column + fixed bottom nav. Web: app header, then side menu + content. */
export const Shell = styled.div`
  min-height: 100vh;
  background: ${({ theme }) => theme.colors.background};
  padding-bottom: ${({ theme }) => theme.layout.bottomNavHeight}px;

  ${({ theme }) => theme.media.md} {
    padding-bottom: 0;
  }
`;

export const ShellBody = styled.div`
  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns: ${({ theme }) => theme.layout.shellSidebarWidth}px minmax(0, 1fr);
  }
`;

// Web side menu: `shared/WebSideMenu`.

// ── Content ─────────────────────────────────────────────────────────────

export const Main = styled.main`
  min-width: 0;
`;

/** Flutter `_TabScaffold` header (surface, 56px, titleLarge). */
export const TabHeader = styled.header`
  display: flex;
  align-items: center;
  height: ${({ theme }) => theme.spacing.space14}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  background: ${({ theme }) => theme.colors.surface};

  ${({ theme }) => theme.media.md} {
    height: ${({ theme }) => theme.layout.homeTopBarHeight}px;
    padding: 0 ${({ theme }) => theme.spacing.space10}px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

export const TabTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
`;

export const TabBody = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space8}px ${theme.spacing.space10}px`};
  }
`;

// ── Mobile bottom navigation (Flutter AppBottomNavigation) ──────────────

export const BottomNav = styled.nav`
  position: fixed;
  z-index: 20;
  left: 0;
  right: 0;
  bottom: 0;
  height: ${({ theme }) => theme.layout.bottomNavHeight}px;
  display: flex;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 -1px 0 ${({ theme }) => theme.colors.divider};

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

export const BottomNavItem = styled.button<{ $active: boolean }>`
  ${resetButton}
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.onSurfaceVariant)};
  ${focusRing}
`;

export const BottomNavIndicator = styled.span<{ $active: boolean }>`
  width: ${({ theme }) => theme.layout.bottomNavIndicatorWidth}px;
  height: ${({ theme }) => theme.spacing.space8}px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme, $active }) => ($active ? theme.colors.primaryContainer : 'transparent')};
  transition: background 0.2s ease;

  i {
    font-size: 20px;
  }
`;

export const BottomNavLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: inherit;
  white-space: nowrap;
`;

/** Flutter FloatingActionButton (endFloat, above the bottom nav). */
export const Fab = styled.button`
  ${resetButton}
  position: fixed;
  z-index: 21;
  right: ${({ theme }) => theme.spacing.space4}px;
  bottom: ${({ theme }) => theme.layout.bottomNavHeight + theme.spacing.space4}px;
  width: ${({ theme }) => theme.layout.fabSize}px;
  height: ${({ theme }) => theme.layout.fabSize}px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};
  box-shadow: ${({ theme }) => theme.elevation.level3};
  ${focusRing}

  i {
    font-size: 22px;
  }

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;
