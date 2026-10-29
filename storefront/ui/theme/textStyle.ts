import { css } from 'styled-components';
import type { TextStyle } from './theme';

/** Applies a theme typography token (Flutter TextStyle) as CSS. */
export const textStyle = (style: TextStyle) => css`
  font-family: ${style.fontFamily};
  font-size: ${style.fontSize}px;
  font-weight: ${style.fontWeight};
  line-height: ${style.lineHeight};
  letter-spacing: ${style.letterSpacing}px;
  color: ${style.color};
`;
