import styled, { css } from 'styled-components';
import { textStyle } from '../../theme';

/** Row of Expanded boxes, Padding(right: space3) except the last one */
export const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

/** TextField(contentPadding zero, filled, OutlineInputBorder width 2) */
export const Box = styled.input<{ $filled: boolean; $hasError: boolean }>`
  flex: 1;
  min-width: 0;
  height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  padding: 0;
  text-align: center;
  outline: none;
  border-radius: ${({ theme }) => theme.radius.md}px;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-weight: 700;
  color: ${({ theme }) => theme.colors.onSurface};

  ${({ theme, $filled, $hasError }) => css`
    background: ${$filled ? theme.colors.primaryContainer : theme.colors.surfaceContainer};
    border: 2px solid
      ${
        $hasError
          ? theme.colors.error
          : $filled
            ? theme.colors.primary
            : theme.colors.outlineVariant
      };

    &:focus {
      border-color: ${$hasError ? theme.colors.error : theme.colors.primary};
    }
  `}
`;
