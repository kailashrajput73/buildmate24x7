import styled, { css, keyframes } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';
import { cardSurface, ellipsis } from '../shared/checkout.styles';

/** Flutter `TweenAnimationBuilder(0.6 → 1, Curves.elasticOut)`. */
const pop = keyframes`
  0% { transform: scale(0.6); }
  55% { transform: scale(1.08); }
  80% { transform: scale(0.97); }
  100% { transform: scale(1); }
`;

export const Hero = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: ${({ theme }) => theme.spacing.space6}px 0 ${({ theme }) => theme.spacing.space2}px;
`;

export const SuccessHalo = styled.div`
  width: 88px;
  height: 88px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ theme }) => withAlpha(theme.colors.successContainer, 0.5)};
  animation: ${pop} 0.5s ease-out;
`;

export const SuccessDot = styled.div`
  width: 64px;
  height: 64px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.successContainer};
  color: ${({ theme }) => theme.colors.success};

  i {
    font-size: 28px;
    font-weight: 700;
  }
`;

export const Badge = styled.span`
  margin-top: ${({ theme }) => theme.spacing.space5}px;
  padding: ${({ theme }) => theme.spacing.space1}px ${({ theme }) => theme.spacing.space3}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => theme.colors.successContainer};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-weight: 800;
  letter-spacing: 0.6px;
  color: ${({ theme }) => theme.colors.success};
`;

export const Heading = styled.h1`
  margin: ${({ theme }) => theme.spacing.space3}px 0 0;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-weight: 800;

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.headlineMedium)}
    font-weight: 800;
  }
`;

export const OrderId = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  strong {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: ${({ theme }) => theme.colors.onSurface};
  }
`;

/** Side by side on desktop, stacked on narrow screens. */
export const Cards = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.space4}px;
  align-items: start;

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

export const InfoCard = styled.section`
  ${cardSurface}
  padding: ${({ theme }) => theme.spacing.space2}px ${({ theme }) => theme.spacing.space5}px;
`;

export const InfoRow = styled.div<{ $divided?: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space3}px 0;
  ${({ theme, $divided }) =>
    $divided &&
    css`
      border-bottom: 1px solid ${theme.colors.divider};
    `}
`;

export const InfoLabel = styled.span`
  flex-shrink: 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

export const InfoValue = styled.span<{ $strong?: boolean }>`
  flex: 1;
  min-width: 0;
  text-align: right;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  font-weight: ${({ $strong }) => ($strong ? 800 : 400)};
  ${ellipsis}
`;

export const Status = styled.span<{ $paid: boolean }>`
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.space1}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  font-weight: 700;
  color: ${({ theme, $paid }) => ($paid ? theme.colors.success : theme.colors.warning)};

  i {
    font-size: 15px;
  }
`;

export const SummaryHeading = styled.h2`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.space3}px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

export const LineList = styled.ul`
  list-style: none;
  margin: 0;
  padding: ${({ theme }) => theme.spacing.space2}px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const Line = styled.li`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space1}px 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}

  span:first-child {
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }

  span:last-child {
    flex-shrink: 0;
  }
`;

export const TotalLine = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space3}px 0;
`;

export const TotalLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

export const TotalValue = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.primary};
`;

export const ContinueBar = styled.div`
  display: flex;
  justify-content: center;
  padding-top: ${({ theme }) => theme.spacing.space4}px;

  button {
    width: 100%;
  }

  ${({ theme }) => theme.media.sm} {
    button {
      width: auto;
      min-width: ${({ theme }) => theme.layout.checkoutContinueButtonWidth}px;
    }
  }
`;
