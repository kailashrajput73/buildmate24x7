import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';

const ellipsis = css`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

const resetButton = css`
  appearance: none;
  border: none;
  margin: 0;
  padding: 0;
  background: none;
  font: inherit;
  text-align: left;
  cursor: pointer;
`;

/**
 * Scaffold(backgroundColor: surface) + SafeArea(Column).
 * Web (≥ md): full-bleed viewport shell — toolbar on top, split body below.
 */
export const Screen = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surface};

  ${({ theme }) => theme.media.md} {
    height: 100vh;
    height: 100dvh;
    overflow: hidden;
  }
`;

// ── Top bar: back button + search pill ─────────────────────────────────

export const TopBar = styled.header`
  position: sticky;
  top: 0;
  z-index: 1;
  background: ${({ theme }) => theme.colors.surface};

  ${({ theme }) => theme.media.md} {
    flex-shrink: 0;
    height: ${({ theme }) => theme.layout.catalogToolbarHeight}px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

export const TopBarInner = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};

  ${({ theme }) => theme.media.md} {
    height: 100%;
    gap: ${({ theme }) => theme.spacing.space4}px;
    padding: 0 ${({ theme }) => theme.spacing.space8}px;
  }
`;

const outlinedBox = css`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.md}px;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

/** 44×44 back button. */
export const BackButton = styled.button`
  ${resetButton}
  ${outlinedBox}
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: ${({ theme }) => theme.colors.onBackground};

  i {
    font-size: 22px;
  }
`;

/** Web-only: sub-category name next to the back button. */
export const TopBarContext = styled.span`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: block;
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    padding-left: ${({ theme }) => theme.spacing.space4}px;
    border-left: 1px solid ${({ theme }) => theme.colors.divider};
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    font-weight: 700;
    color: ${({ theme }) => theme.colors.onBackground};
  }
`;

/** Tappable "Search products" pill → search route. */
export const SearchPill = styled.button`
  ${resetButton}
  ${outlinedBox}
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.outline};

  i {
    font-size: 18px;
  }

  /* Web: the app header carries search. */
  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

/** Mobile only — on web the app header carries the cart. */
export const MobileCartSlot = styled.div`
  display: contents;

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

// ── Body ────────────────────────────────────────────────────────────────

/**
 * Mobile: single scroll column. Web (≥ md): full-bleed split — the image
 * pane fills the left, the details pane scrolls on the right.
 */
export const Body = styled.main`
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: ${({ theme }) =>
    `${theme.spacing.space2}px ${theme.spacing.space4}px ${theme.spacing.space4}px`};

  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns:
      minmax(0, 1.2fr)
      minmax(${({ theme }) => theme.layout.pipeConfiguratorDetailsMinWidth}px, 1fr);
    min-height: 0;
    padding: 0;
  }
`;

/** 220px image box, radius lg, divider border, soft shadow. */
export const Media = styled.div`
  height: 220px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  box-shadow: 0 4px 14px ${({ theme }) => theme.colors.shadow};
  overflow: hidden;

  ${({ theme }) => theme.media.md} {
    height: 100%;
    min-height: 0;
    padding: ${({ theme }) => theme.spacing.space12}px;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: radial-gradient(
      circle at 50% 45%,
      ${({ theme }) => theme.colors.primaryContainer} 0%,
      ${({ theme }) => theme.colors.surfaceContainer} 70%
    );

    /* Blend the product photo's white backdrop into the tinted pane. */
    img {
      mix-blend-mode: multiply;
    }
  }
`;

export const Details = styled.div`
  display: flex;
  flex-direction: column;
  margin-top: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    margin-top: 0;
    min-height: 0;
    overflow-y: auto;
    padding: ${({ theme }) => `${theme.spacing.space10}px ${theme.spacing.space12}px`};
    border-left: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

/** Web: readable-width column, vertically centred while it fits. */
export const DetailsInner = styled.div`
  display: flex;
  flex-direction: column;

  ${({ theme }) => theme.media.md} {
    width: 100%;
    max-width: ${({ theme }) => theme.layout.pipeConfiguratorDetailsMaxWidth}px;
    margin: auto 0;
  }
`;

/** Web-only: brand chip + sub-category above the title. */
export const Eyebrow = styled.div`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.space2}px;
    margin-bottom: ${({ theme }) => theme.spacing.space3}px;
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }
`;

export const BrandChip = styled.span`
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  background: ${({ theme }) => theme.colors.primaryContainer};
  border-radius: ${({ theme }) => theme.radius.xl}px;
  font-weight: 700;
  color: ${({ theme }) => theme.colors.onPrimaryContainer};
`;

/** titleMedium w800. */
export const Title = styled.h1`
  margin: 0 0 ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 800;
  overflow-wrap: anywhere;

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.headlineMedium)}
    font-weight: 800;
    margin-bottom: ${({ theme }) => theme.spacing.space8}px;
  }
`;

/** Web-only caption above each dropdown. */
export const FieldLabel = styled.span`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: block;
    margin-bottom: ${({ theme }) => theme.spacing.space2}px;
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    font-weight: 600;
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }
`;

export const FieldGap = styled.div<{ $size: number }>`
  height: ${({ $size }) => $size}px;

  ${({ theme }) => theme.media.md} {
    height: ${({ theme }) => theme.spacing.space5}px;
  }
`;

/** Anchor for the dropdown trigger + its menu. */
export const DropdownWrap = styled.div`
  position: relative;
`;

/** _ConfiguratorDropdown — outlined box around a DropdownButton. */
export const DropdownBox = styled.button<{ $enabled: boolean; $open: boolean }>`
  ${resetButton}
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  min-height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  padding: 0 ${({ theme }) => theme.spacing.space3}px;
  background: ${({ theme, $enabled }) =>
    $enabled ? theme.colors.surface : theme.colors.disabledContainer};
  border: 1px solid
    ${({ theme, $enabled }) => ($enabled ? theme.colors.outlineVariant : theme.colors.divider)};
  border-radius: ${({ theme }) => theme.radius.md}px;
  cursor: ${({ $enabled }) => ($enabled ? 'pointer' : 'default')};

  i {
    position: absolute;
    right: ${({ theme }) => theme.spacing.space3}px;
    pointer-events: none;
    font-size: 14px;
    color: ${({ theme, $enabled }) =>
      $enabled ? theme.colors.onSurfaceVariant : theme.colors.disabled};
    transition: transform 120ms ${({ theme }) => theme.motion.easeOutCubic};
    transform: rotate(${({ $open }) => ($open ? 180 : 0)}deg);
  }

  &:disabled {
    cursor: default;
  }

  ${({ $open, theme }) =>
    $open &&
    css`
      border-color: ${theme.colors.primary};
    `}

  ${({ theme }) => theme.media.md} {
    min-height: ${({ theme }) => theme.spacing.inputHeight}px;
    padding: 0 ${({ theme }) => theme.spacing.space4}px;
    transition:
      border-color 120ms ${({ theme }) => theme.motion.easeOutCubic},
      box-shadow 120ms ${({ theme }) => theme.motion.easeOutCubic};

    ${({ $enabled, theme }) =>
      $enabled &&
      css`
        &:hover {
          border-color: ${theme.colors.primary};
        }

        &:focus-visible {
          border-color: ${theme.colors.primary};
          box-shadow: 0 0 0 3px ${theme.colors.primaryContainer};
        }
      `}

    ${({ $open, theme }) =>
      $open &&
      css`
        box-shadow: 0 0 0 3px ${theme.colors.primaryContainer};
      `}

    i {
      right: ${({ theme }) => theme.spacing.space4}px;
    }
  }
`;

/** Selected value (or hint) inside the dropdown box. */
export const DropdownValue = styled.span<{ $enabled: boolean; $placeholder: boolean }>`
  flex: 1;
  min-width: 0;
  padding-right: ${({ theme }) => theme.spacing.space6}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;
  color: ${({ theme, $enabled, $placeholder }) =>
    !$enabled
      ? theme.colors.disabled
      : $placeholder
        ? theme.colors.onSurfaceVariant
        : theme.colors.onBackground};
  ${ellipsis}

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    font-weight: 700;
  }
`;

// ── Dropdown menu (same chrome as PipesFittingCategory's header menus) ──

export const MenuCard = styled.div`
  position: absolute;
  top: calc(100% + ${({ theme }) => theme.spacing.space1}px);
  left: 0;
  right: 0;
  max-height: 360px;
  z-index: 11;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  box-shadow: ${({ theme }) => theme.elevation.level3};
`;

export const MenuSearchWrap = styled.div`
  padding: ${({ theme }) =>
    `${theme.spacing.space3}px ${theme.spacing.space3}px ${theme.spacing.space2}px`};
`;

export const MenuSearchField = styled.label`
  height: 40px;
  display: flex;
  align-items: center;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.sm}px;

  i {
    width: 36px;
    text-align: center;
    font-size: 14px;
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
  }

  input {
    flex: 1;
    min-width: 0;
    height: 100%;
    border: none;
    outline: none;
    background: transparent;
    font-family: ${({ theme }) => theme.fontFamily.body};
    font-size: 13px;
    color: ${({ theme }) => theme.colors.onSurface};

    &::placeholder {
      color: ${({ theme }) => theme.colors.onSurfaceVariant};
    }
  }
`;

export const MenuList = styled.div`
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.space1}px 0;
`;

export const MenuEmpty = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** _DropdownTile — checkbox square + label. */
export const MenuTile = styled.button<{ $selected: boolean }>`
  ${resetButton}
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  background: ${({ theme, $selected }) =>
    $selected ? withAlpha(theme.colors.primaryContainer, 0.35) : 'transparent'};

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primaryContainer, 0.2)};
  }
`;

export const MenuTileLabel = styled.span<{ $selected: boolean }>`
  flex: 1;
  min-width: 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  font-weight: ${({ $selected }) => ($selected ? 700 : 500)};
  color: ${({ theme, $selected }) =>
    $selected ? theme.colors.onBackground : theme.colors.onSurface};
  ${ellipsis}
`;

export const MenuCheck = styled.span<{ $selected: boolean }>`
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 5px;
  border: 1.5px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.outlineVariant)};
  background: ${({ theme, $selected }) => ($selected ? theme.colors.primary : 'transparent')};
  color: ${({ theme }) => theme.colors.white};

  i {
    font-size: 10px;
    font-weight: 700;
  }
`;

// ── _ConfiguratorAddToCartCard ─────────────────────────────────────────

export const CartCard = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space3}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  box-shadow: 0 3px 12px ${({ theme }) => theme.colors.shadow};

  ${({ theme }) => theme.media.md} {
    flex-direction: column;
    align-items: stretch;
    gap: ${({ theme }) => theme.spacing.space5}px;
    margin-top: ${({ theme }) => theme.spacing.space8}px;
    padding: ${({ theme }) => theme.spacing.space6}px;
    background: ${({ theme }) => theme.colors.background};
    box-shadow: none;
  }
`;

export const CartInfo = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
`;

export const CartLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 600;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  margin-bottom: ${({ theme }) => theme.spacing.space1}px;
`;

export const CartPrice = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onBackground};

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.headlineMedium)}
    font-weight: 800;
  }
`;

export const CartUnit = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 500;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

export const CartSize = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** Green "Add to Cart" button (accentGreenContainer, radius lg). */
export const AddToCartButton = styled.button`
  ${resetButton}
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  background: ${({ theme }) => theme.colors.accentGreenContainer};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onAccentGreenContainer};
  transition: filter 120ms ${({ theme }) => theme.motion.easeOutCubic};

  i {
    font-size: 18px;
  }

  &:hover {
    filter: brightness(0.96);
  }

  &:active {
    filter: brightness(0.92);
  }

  ${({ theme }) => theme.media.md} {
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.space2}px;
    height: ${({ theme }) => theme.spacing.buttonHeight}px;
    padding: 0 ${({ theme }) => theme.spacing.space6}px;
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    font-weight: 800;

    i {
      font-size: 20px;
    }
  }
`;
