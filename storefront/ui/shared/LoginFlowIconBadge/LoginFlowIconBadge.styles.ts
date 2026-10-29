import styled from 'styled-components';
import { withAlpha } from '../../theme';

/** Flutter ratios relative to the badge size. */
const INNER_RATIO = 0.78;
const INNER_PADDING_RATIO = 0.12;
const ICON_CIRCLE_RATIO = 0.66;
const ICON_RATIO = 0.34;

/** Circle with RadialGradient(accentMuted → accentMuted@0.4) */
export const Badge = styled.div<{ $size: number }>`
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size}px;
  height: ${({ $size }) => $size}px;
  border-radius: 50%;
  background: radial-gradient(
    circle closest-side,
    ${({ theme }) => theme.loginFlow.accentMuted},
    ${({ theme }) => withAlpha(theme.loginFlow.accentMuted, 0.4)}
  );
  box-shadow:
    0 10px 28px 2px ${({ theme }) => withAlpha(theme.loginFlow.accent, 0.28)},
    0 2px 6px ${({ theme }) => withAlpha(theme.colors.black, 0.12)};
`;

/** Inner white circle holding the image */
export const ImageCircle = styled.div<{ $size: number }>`
  width: ${({ $size }) => $size * INNER_RATIO}px;
  height: ${({ $size }) => $size * INNER_RATIO}px;
  padding: ${({ $size }) => $size * INNER_PADDING_RATIO}px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 4px 10px ${({ theme }) => withAlpha(theme.colors.black, 0.06)};
`;

export const Image = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
`;

/** Inner circle with LinearGradient(accentGradient, topLeft → bottomRight) */
export const IconCircle = styled.div<{ $size: number }>`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ $size }) => $size * ICON_CIRCLE_RATIO}px;
  height: ${({ $size }) => $size * ICON_CIRCLE_RATIO}px;
  border-radius: 50%;
  background: linear-gradient(
    to bottom right,
    ${({ theme }) => theme.loginFlow.accentGradient[0]},
    ${({ theme }) => theme.loginFlow.accentGradient[1]}
  );
  color: ${({ theme }) => theme.colors.white};

  .pi {
    font-size: ${({ $size }) => $size * ICON_RATIO}px;
  }
`;
