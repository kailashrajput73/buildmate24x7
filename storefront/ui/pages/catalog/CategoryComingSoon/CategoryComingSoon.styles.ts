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

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to { opacity: 1; transform: translateY(0); }
`;

const float = keyframes`
  0%, 100% { transform: translateY(0) rotate(-3deg); }
  50% { transform: translateY(-8px) rotate(-3deg); }
`;

export const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
`;

export const Page = styled.main`
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 24px 16px;
  background: ${({ theme }) => theme.colors.background};
`;

export const BackButton = styled.button`
  ${resetButton}
  ${focusRing}
  align-self: flex-start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 9999px;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }

  ${({ theme }) => theme.media.md} {
    position: absolute;
    top: 24px;
    left: 24px;
  }
`;

export const Card = styled.section<{ $accent: string }>`
  width: 100%;
  max-width: 520px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 32px 24px;
  border-radius: 28px;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: 0 24px 60px ${({ $accent }) => withAlpha($accent, 0.14)};
  animation: ${fadeUp} 0.4s ease-out both;

  ${({ theme }) => theme.media.md} {
    padding: 40px 48px;
  }
`;

export const Hero = styled.div<{ $accent: string; $tint: string }>`
  width: 100%;
  height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  border-radius: 20px;
  background:
    radial-gradient(
      circle at 75% 20%,
      ${({ $tint }) => withAlpha($tint, 0.9)} 0 30%,
      transparent 31%
    ),
    linear-gradient(
      135deg,
      ${({ $accent }) => withAlpha($accent, 0.75)},
      ${({ $accent }) => $accent}
    );
`;

export const HeroImage = styled.img`
  width: 150px;
  height: 150px;
  object-fit: cover;
  border-radius: 20px;
  border: 4px solid ${({ theme }) => theme.colors.white};
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.18);
  animation: ${float} 4s ease-in-out infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
    transform: rotate(-3deg);
  }
`;

export const Badge = styled.span<{ $accent: string }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 9999px;
  background: ${({ $accent }) => withAlpha($accent, 0.12)};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ $accent }) => $accent};
`;

export const Title = styled.h1`
  margin: 16px 0 8px;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
`;

export const Message = styled.p`
  margin: 0;
  max-width: 400px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const Actions = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column-reverse;
  gap: 12px;
  margin-top: 28px;

  ${({ theme }) => theme.media.sm} {
    flex-direction: row;
    justify-content: center;
  }
`;

const buttonBase = css`
  ${resetButton}
  ${focusRing}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 48px;
  padding: 0 24px;
  border-radius: 9999px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  transition: background 0.15s ease, transform 0.15s ease;

  &:active {
    transform: scale(0.98);
  }
`;

export const PrimaryButton = styled.button`
  ${buttonBase}
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.onPrimary};

  &:hover {
    background: ${({ theme }) => theme.colors.primaryPressed};
  }
`;

export const SecondaryButton = styled.button`
  ${buttonBase}
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  color: ${({ theme }) => theme.colors.onSurface};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;
