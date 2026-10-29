import styled, { keyframes } from 'styled-components';
import { textStyle } from '../../theme';

const bump = keyframes`
  0% { transform: scale(0.6); }
  60% { transform: scale(1.15); }
  100% { transform: scale(1); }
`;

export const Button = styled.button`
  appearance: none;
  position: relative;
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font: inherit;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.md}px;
  color: ${({ theme }) => theme.colors.onBackground};

  i {
    font-size: 20px;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

/** Re-keyed on count change so it bumps when an item is added. */
export const Badge = styled.span`
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  background: ${({ theme }) => theme.colors.primary};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-family: inherit;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.onPrimary};
  animation: ${bump} 0.3s ease-out;
`;
