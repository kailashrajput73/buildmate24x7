import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

/** Flutter: SizedBox(22×22) around the loading spinner. */
export const SPINNER_SIZE = 22;

/** AnimatedContainer(200ms, height 52) + transparent ElevatedButton */
export const Button = styled.button<{ $active: boolean }>`
  width: 100%;
  height: ${({ theme }) => theme.spacing.buttonHeight}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: ${({ theme }) => theme.radius.md}px;
  transition:
    background 200ms,
    box-shadow 200ms,
    color 200ms;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 700;

  ${({ theme, $active }) =>
    $active
      ? css`
          cursor: pointer;
          color: ${theme.colors.white};
          background: linear-gradient(
            to right,
            ${theme.loginFlow.accentGradient[0]},
            ${theme.loginFlow.accentGradient[1]}
          );
          box-shadow: 0 8px 16px ${withAlpha(theme.loginFlow.accent, 0.35)};
        `
      : css`
          cursor: default;
          color: ${theme.loginFlow.disabledText};
          background: ${theme.loginFlow.disabledButton};
        `}
`;
