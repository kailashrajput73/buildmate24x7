import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';
import { slideDown } from '../shared/checkout.styles';

export const MethodList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

/** Flutter `CheckoutSelectableCard` with `expanded` content under the header. */
export const MethodCard = styled.div<{ $selected: boolean }>`
  border-radius: ${({ theme }) => theme.radius.md}px;
  transition:
    border-color 0.15s ease,
    background 0.15s ease,
    box-shadow 0.15s ease;
  ${({ theme, $selected }) =>
    $selected
      ? css`
          border: 1.5px solid ${theme.colors.primary};
          background: ${withAlpha(theme.colors.primary, 0.04)};
          box-shadow: 0 0 0 3px ${withAlpha(theme.colors.primary, 0.08)};
        `
      : css`
          border: 1.5px solid ${theme.colors.divider};
          background: ${theme.colors.surface};

          &:hover {
            border-color: ${theme.colors.outlineVariant};
          }
        `}
`;

export const MethodHeader = styled.label`
  position: relative;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  cursor: pointer;
  border-radius: inherit;

  &:has(input:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const MethodIcon = styled.span<{ $selected: boolean }>`
  flex-shrink: 0;
  width: ${({ theme }) => theme.spacing.space10}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  display: grid;
  place-items: center;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.surface : theme.colors.surfaceContainer};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.primary : theme.colors.onSurfaceVariant};
  transition:
    background 0.15s ease,
    color 0.15s ease;

  i {
    font-size: 20px;
  }
`;

export const MethodText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

/** Indented to line up with the method text on wide screens. */
export const MethodDetails = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px ${({ theme }) => theme.spacing.space4}px;
  animation: ${slideDown} 0.15s ease;

  ${({ theme }) => theme.media.sm} {
    padding-left: ${({ theme }) =>
      theme.spacing.space4 * 3 + theme.layout.checkoutRadioSize + theme.spacing.space10}px;
    max-width: ${({ theme }) => theme.layout.checkoutPaymentFieldsWidth}px;
    box-sizing: content-box;
  }

  input {
    width: 100%;
  }
`;

export const FieldRow = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

export const Select = styled.select<{ $placeholder: boolean }>`
  width: 100%;
  height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  padding: 0 ${({ theme }) => theme.components.input.paddingX}px;
  border: 1px solid ${({ theme }) => theme.components.input.border};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.surface};
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  color: ${({ theme, $placeholder }) => ($placeholder ? theme.colors.outline : theme.colors.onSurface)};
  cursor: pointer;

  option {
    color: ${({ theme }) => theme.colors.onSurface};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.components.input.focusedBorder};
    box-shadow: 0 0 0 3px ${({ theme }) => withAlpha(theme.colors.primary, 0.12)};
  }
`;

export const CodNote = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => theme.spacing.space3}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.warningContainer};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}

  i {
    margin-top: 1px;
    font-size: 16px;
    color: ${({ theme }) => theme.colors.warning};
  }
`;

export const SecureNote = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => theme.spacing.space3}px ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surfaceContainer};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}

  i {
    font-size: 18px;
    color: ${({ theme }) => theme.colors.success};
  }
`;
