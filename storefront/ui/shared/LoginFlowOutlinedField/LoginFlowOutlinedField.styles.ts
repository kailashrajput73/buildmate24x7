import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

/** Flutter: Icon(size: 20) inside InputDecorator's prefix icon box */
const PREFIX_ICON_SIZE = 20;
/** Material 3 `prefixToInputGap` */
const PREFIX_TO_INPUT_GAP = 4;
/** Material 3 `inputGap` for OutlineInputBorder (gapPadding) */
const INPUT_GAP = 4;

/** Column(crossAxisAlignment: start) */
export const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

/** Text(label, titleSmall w700) + SizedBox(space2) */
export const Label = styled.label`
  margin-bottom: ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;
`;

/** Container(radius md, BoxShadow(black@0.03, blur 10, offset 0,4)) */
export const FieldBox = styled.div`
  position: relative;
  border-radius: ${({ theme }) => theme.radius.md}px;
  box-shadow: 0 4px 10px ${({ theme }) => withAlpha(theme.colors.black, 0.03)};
`;

/** prefixIcon: 48×48 box (kMinInteractiveDimension), Icon(onSurfaceVariant, 20) */
export const PrefixIcon = styled.span`
  position: absolute;
  top: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.components.minInteractiveDimension}px;
  height: 100%;
  pointer-events: none;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  .pi {
    font-size: ${PREFIX_ICON_SIZE}px;
  }
`;

/**
 * TextFormField: filled surface, contentPadding(h: space4, v: space3),
 * enabledBorder fieldBorder 1.5, focusedBorder accent 2.
 * Borders are painted as inset shadows so, as in Flutter, they don't shift the text.
 */
export const Input = styled.input<{ $hasPrefixIcon: boolean }>`
  display: block;
  width: 100%;
  min-height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  margin: 0;
  border: none;
  outline: none;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md}px;
  box-shadow: inset 0 0 0 1.5px ${({ theme }) => theme.loginFlow.fieldBorder};
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}

  ${({ theme, $hasPrefixIcon }) => css`
    padding: ${theme.spacing.space3}px ${theme.spacing.space4 + INPUT_GAP}px
      ${theme.spacing.space3}px
      ${
        $hasPrefixIcon
          ? theme.components.minInteractiveDimension + PREFIX_TO_INPUT_GAP
          : theme.spacing.space4 + INPUT_GAP
      }px;
  `}

  &::placeholder {
    ${({ theme }) => textStyle(theme.typography.bodyLarge)}
    color: ${({ theme }) => theme.loginFlow.disabledText};
    opacity: 1;
  }

  &:focus {
    box-shadow: inset 0 0 0 2px ${({ theme }) => theme.loginFlow.accent};
  }
`;
