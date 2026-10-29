import styled from 'styled-components';
import { textStyle, withAlpha } from '../../theme';

/** SnackBar(behavior: floating) — bottom of the screen, above content */
export const Container = styled.div<{ $webAlign: 'authPanel' | 'center'; $bottomOffset: number }>`
  position: fixed;
  z-index: 30; /* above dialogs (scrim is 20) */
  left: 50%;
  bottom: ${({ theme, $bottomOffset }) => theme.components.snackBar.marginBottom + $bottomOffset}px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  width: calc(
    min(100%, ${({ theme }) => theme.layout.authMaxWidth}px) -
      ${({ theme }) => theme.components.snackBar.marginX * 2}px
  );
  padding: ${({ theme }) =>
    `${theme.components.snackBar.paddingY}px ${theme.components.snackBar.paddingX}px`};
  background: ${({ theme }) => theme.components.snackBar.background};
  border-radius: ${({ theme }) => theme.components.snackBar.radius}px;
  box-shadow: ${({ theme }) => theme.components.snackBar.shadow};
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.components.snackBar.foreground};

  /* Web (≥ md): auth screens sit in the right half beside the brand panel. */
  ${({ theme }) => theme.media.md} {
    left: ${({ $webAlign }) => ($webAlign === 'authPanel' ? '75%' : '50%')};
    bottom: ${({ theme }) => theme.components.snackBar.marginBottom}px;
  }
`;

export const Message = styled.span`
  flex: 1;
  min-width: 0;
`;

/** SnackBarAction — Material 3 uses inversePrimary for the label. */
export const ActionButton = styled.button`
  appearance: none;
  border: none;
  background: none;
  flex-shrink: 0;
  margin: -${({ theme }) => theme.spacing.space2}px 0;
  padding: ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  cursor: pointer;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.inversePrimary};

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.inversePrimary, 0.12)};
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.inversePrimary};
    outline-offset: 2px;
  }
`;
