import styled, { css, keyframes } from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

// Web adaptation only (≥ md). Below md every rule here is a no-op, so the
// Flutter mobile layout renders unchanged.

const rise = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

/**
 * Screen-level mixin (≥ md): centres the screen's content column on the
 * light backdrop gradient, leaving room around the card.
 */
export const authWebStage = css`
  ${({ theme }) => theme.media.md} {
    align-items: center;
    padding: ${({ theme }) => theme.spacing.space10}px;
    background: linear-gradient(
      to bottom,
      ${({ theme }) => theme.loginFlow.backdropGradient[0]},
      ${({ theme }) => theme.loginFlow.backdropGradient[1]}
    );
  }
`;

/** Content-level mixin (≥ md): turns the screen's column into a white card. */
export const authWebCard = css`
  ${({ theme }) => theme.media.md} {
    flex: none;
    padding: ${({ theme }) => theme.spacing.space10}px;
    border-radius: ${({ theme }) => theme.radius.xxl}px;
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 0 24px 64px ${({ theme }) => withAlpha(theme.loginFlow.accentDeep, 0.12)};
    animation: ${rise} 480ms ${({ theme }) => theme.motion.easeOutCubic} both;
  }
`;

/** Row on desktop: brand panel | screen. Below md only the screen shows. */
export const Shell = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
`;

/** Hosts the screen's own `Screen` root. */
export const Main = styled.main`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  > * {
    flex: 1;
  }
`;

/** Left half on desktop: gradient in the logo's colours. Hidden on mobile. */
export const BrandPanel = styled.aside`
  display: none;

  ${({ theme }) => theme.media.md} {
    /* Stays in view while a tall form scrolls. */
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: ${({ theme }) => `${theme.spacing.space12}px ${theme.spacing.space16}px`};
    background: linear-gradient(
      135deg,
      ${({ theme }) => theme.brand.panelGradient[0]},
      ${({ theme }) => theme.brand.panelGradient[1]} 55%,
      ${({ theme }) => theme.brand.panelGradient[2]}
    );
    color: ${({ theme }) => theme.colors.onPrimary};
  }
`;

/** Soft decorative circles in the panel background. */
export const Orb = styled.span<{ $size: number; $top: string; $left: string }>`
  position: absolute;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  top: ${({ $top }) => $top};
  left: ${({ $left }) => $left};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.08)};
  pointer-events: none;
`;

export const BrandHeader = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

export const BrandLogo = styled.img`
  width: ${({ theme }) => theme.spacing.space12}px;
  height: ${({ theme }) => theme.spacing.space12}px;
  padding: ${({ theme }) => theme.spacing.space1}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.white};
  object-fit: contain;
`;

export const BrandName = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  font-weight: 800;
  color: inherit;
`;

export const BrandBody = styled.div`
  position: relative;
  max-width: ${({ theme }) => theme.layout.brandPanelMaxWidth}px;
`;

export const Eyebrow = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: ${({ theme }) => withAlpha(theme.colors.white, 0.75)};
`;

export const Tagline = styled.h2`
  margin: 0 0 ${({ theme }) => theme.spacing.space10}px;
  ${({ theme }) => textStyle(theme.typography.displaySmall)}
  font-weight: 800;
  color: inherit;

  ${({ theme }) => theme.media.lg} {
    ${({ theme }) => textStyle(theme.typography.displayMedium)}
    font-weight: 800;
    color: inherit;
  }
`;

export const TaglineEmphasis = styled.span`
  display: block;
  color: ${({ theme }) => theme.brand.highlight};
`;

export const Highlights = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space5}px;
`;

export const Highlight = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space4}px;
`;

export const HighlightIcon = styled.span`
  flex: none;
  display: grid;
  place-items: center;
  width: ${({ theme }) => theme.spacing.space12}px;
  height: ${({ theme }) => theme.spacing.space12}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => withAlpha(theme.colors.white, 0.15)};
  font-size: ${({ theme }) => theme.spacing.space5}px;
`;

export const HighlightTitle = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 700;
  color: inherit;
`;

export const HighlightSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => withAlpha(theme.colors.white, 0.8)};
`;

export const BrandFooter = styled.p`
  position: relative;
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => withAlpha(theme.colors.white, 0.7)};
`;
