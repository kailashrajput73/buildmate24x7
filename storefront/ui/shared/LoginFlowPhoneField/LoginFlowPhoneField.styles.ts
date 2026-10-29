import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

/** Flutter: divider Container(width: 1, height: 28) */
const DIVIDER_HEIGHT = 28;

/** AnimatedContainer(180ms, height: inputHeight) */
export const Field = styled.div<{ $focused: boolean }>`
  display: flex;
  align-items: center;
  width: 100%;
  height: ${({ theme }) => theme.spacing.inputHeight}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md}px;
  transition:
    border-color 180ms,
    box-shadow 180ms;

  ${({ theme, $focused }) =>
    $focused
      ? css`
          border: 2px solid ${theme.loginFlow.accent};
          box-shadow: 0 4px 12px ${withAlpha(theme.loginFlow.accent, 0.18)};
        `
      : css`
          border: 1.5px solid ${theme.loginFlow.fieldBorder};
        `}
`;

/** Text('+91', titleMedium w600) */
export const Prefix = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 600;
`;

export const Divider = styled.span`
  flex-shrink: 0;
  width: 1px;
  height: ${DIVIDER_HEIGHT}px;
  margin: 0 ${({ theme }) => theme.spacing.space3}px;
  background: ${({ theme }) => theme.loginFlow.fieldBorder};
`;

/** Borderless TextField(style: titleMedium) */
export const Input = styled.input`
  flex: 1;
  min-width: 0;
  padding: 0;
  border: none;
  outline: none;
  background: transparent;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
`;
