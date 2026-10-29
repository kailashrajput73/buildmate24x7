import styled from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';

/** Flutter: `Image.asset(..., width: 220)` */
const LOGO_WIDTH = 220;
/** Web (≥ md) only: larger logo for desktop viewports. */
const LOGO_WIDTH_WEB = 320;

/** Scaffold(backgroundColor: background) + SafeArea */
export const Screen = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  justify-content: center;
  background: ${({ theme }) => theme.colors.background};

  ${({ theme }) => theme.media.md} {
    background: linear-gradient(
      to bottom,
      ${({ theme }) => theme.loginFlow.backdropGradient[0]},
      ${({ theme }) => theme.loginFlow.backdropGradient[1]}
    );
  }
`;

/** Padding(h: space8, v: space10) > Column */
export const Content = styled.div`
  flex: 1;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.authMaxWidth}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing.space10}px ${theme.spacing.space8}px`};
`;

/** Spacer() */
export const Spacer = styled.div`
  flex: 1;
`;

export const Logo = styled.img`
  display: block;
  width: ${LOGO_WIDTH}px;
  max-width: 100%;
  height: auto;
  object-fit: contain;

  ${({ theme }) => theme.media.md} {
    width: ${LOGO_WIDTH_WEB}px;
    padding: ${({ theme }) => theme.spacing.space6}px;
    border-radius: ${({ theme }) => theme.radius.xxl}px;
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 0 24px 64px ${({ theme }) => withAlpha(theme.loginFlow.accentDeep, 0.12)};
  }
`;

/** SizedBox(height: space2) + Text.rich(bodyMedium) */
export const Tagline = styled.p`
  margin: ${({ theme }) => theme.spacing.space2}px 0 0;
  text-align: center;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}

  ${({ theme }) => theme.media.md} {
    margin-top: ${({ theme }) => theme.spacing.space6}px;
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    font-weight: 400;
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }
`;

/** TextSpan(fontWeight: w600, color: onBackground) */
export const TaglineEmphasis = styled.span`
  font-weight: 600;
  color: ${({ theme }) => theme.colors.onBackground};
`;

/** SizedBox(height: space4) + Text(labelSmallMono) */
export const Version = styled.span`
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.labelSmallMono)}
`;
