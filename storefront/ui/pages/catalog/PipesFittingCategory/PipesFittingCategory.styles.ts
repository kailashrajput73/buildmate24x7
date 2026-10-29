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
 * Mobile: Scaffold → Column(header, Row(sidebar, content)).
 * Web (≥ md): full-bleed app shell — the sidebar runs the full viewport
 * height on the left; header toolbar and scrolling content sit to its right.
 */
export const Screen = styled.div`
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-columns: ${({ theme }) => theme.layout.pipeSidebarWidth}px minmax(0, 1fr);
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-areas:
    'header header'
    'sidebar content';
  background: ${({ theme }) => theme.colors.background};

  ${({ theme }) => theme.media.md} {
    grid-template-columns: ${({ theme }) => theme.layout.pipeSidebarWideWidth}px minmax(0, 1fr);
    grid-template-rows: auto auto minmax(0, 1fr);
    grid-template-areas:
      'app app'
      'sidebar header'
      'sidebar content';
  }
`;

/** Web-only slot for the app-wide `StorefrontHeader` (spans both columns). */
export const AppHeaderSlot = styled.div`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: block;
    grid-area: app;
  }
`;

// ── _CategoryHeader ─────────────────────────────────────────────────────

export const Header = styled.header`
  grid-area: header;
  min-width: 0;
  background: ${({ theme }) => theme.colors.surface};

  /* Web: separates the toolbar from the scrolling content. */
  ${({ theme }) => theme.media.md} {
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

/**
 * Mobile: [back · title · search] then a row of three filter buttons.
 * Web (≥ md): one full-width toolbar row — heading · filters · search
 * (back + category title move to the top of the sidebar).
 */
export const HeaderInner = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  grid-template-areas:
    'back title search'
    'filters filters filters';
  align-items: center;
  column-gap: ${({ theme }) => theme.spacing.space3}px;
  row-gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};

  ${({ theme }) => theme.media.md} {
    grid-template-columns: minmax(0, 1fr) auto;
    grid-template-areas: 'heading filters';
    column-gap: ${({ theme }) => theme.spacing.space3}px;
    min-height: ${({ theme }) => theme.layout.catalogToolbarHeight}px;
    padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space8}px`};
  }
`;

export const BackSlot = styled.div`
  grid-area: back;

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

/** Mobile only — on web the app header carries search + cart. */
export const SearchSlot = styled.div`
  grid-area: search;
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

/** titleMedium w800 onBackground, 1 line ellipsis. */
export const HeaderTitle = styled.h1`
  grid-area: title;
  margin: 0;
  min-width: 0;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onBackground};
  ${ellipsis}

  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

/** Web-only toolbar heading (content title + subtitle). */
export const ToolbarHeading = styled.div`
  display: none;

  ${({ theme }) => theme.media.md} {
    grid-area: heading;
    display: block;
    min-width: 0;
  }
`;

/** Row(mainAxisAlignment: end) of four Expanded filter buttons. */
export const FilterRow = styled.div`
  grid-area: filters;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(4, minmax(120px, auto));
  }
`;

/** _HeaderIconButton — 40×40, surface, outlineVariant border, radius md. */
export const HeaderIconButton = styled.button`
  ${resetButton}
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
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
`;

/**
 * _FilterDropdownButton — primary outline 1.2px, radius sm. Flutter receives
 * `active` but never uses it for styling, so there is no active look here.
 */
export const FilterButton = styled.button`
  ${resetButton}
  width: 100%;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};
  background: ${({ theme }) => theme.colors.surface};
  border: 1.2px solid ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.radius.sm}px;

  span {
    min-width: 0;
    ${({ theme }) => textStyle(theme.typography.labelMedium)}
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    ${ellipsis}
  }

  i {
    font-size: 12px;
    color: ${({ theme }) => theme.colors.primary};
  }

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primaryContainer, 0.35)};
  }

  ${({ theme }) => theme.media.md} {
    height: 40px;
    justify-content: space-between;
    padding: 0 ${({ theme }) => theme.spacing.space4}px;
    border-radius: ${({ theme }) => theme.radius.md}px;
  }
`;

// ── Header dropdown overlay (_showDropdown / _DropdownMenuChrome) ──────

/** Positioned.fill translucent tap-catcher that closes the menu. */
export const MenuBackdrop = styled.div`
  position: fixed;
  inset: 0;
  z-index: 10;
`;

export const MenuCard = styled.div<{ $top: number; $left: number; $width: number }>`
  position: fixed;
  top: ${({ $top }) => $top}px;
  left: ${({ $left }) => $left}px;
  width: ${({ $width }) => $width}px;
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

// ── Body: sidebar + content ─────────────────────────────────────────────

// ── Sidebar ─────────────────────────────────────────────────────────────

export const Centered = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
`;

/**
 * _CategorySidebar — surfaceContainer 108px column on mobile. Web: a
 * full-height white rail with a right border. Hidden on mobile while there
 * is no catalog so the loading/error state gets the full width.
 */
export const Sidebar = styled.aside<{ $hiddenOnMobile: boolean }>`
  grid-area: sidebar;
  min-height: 0;
  display: ${({ $hiddenOnMobile }) => ($hiddenOnMobile ? 'none' : 'flex')};
  flex-direction: column;
  background: ${({ theme }) => theme.colors.surfaceContainer};

  ${({ theme }) => theme.media.md} {
    display: flex;
    background: ${({ theme }) => theme.colors.surface};
    border-right: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

/** Web-only sidebar top: back button + category name (toolbar height). */
export const SidebarBrand = styled.div`
  display: none;

  ${({ theme }) => theme.media.md} {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.space3}px;
    min-height: ${({ theme }) => theme.layout.catalogToolbarHeight}px;
    padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
    border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
  }
`;

export const SidebarBrandText = styled.div`
  min-width: 0;
`;

export const SidebarBrandTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 800;
  line-height: 1.2;
  color: ${({ theme }) => theme.colors.onBackground};
`;

export const SidebarBrandMeta = styled.p`
  margin: 2px 0 0;
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

export const SidebarNav = styled.nav`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.space3}px 0;

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space4}px ${theme.spacing.space2}px`};
  }
`;

export const SidebarGap = styled.div<{ $size: number }>`
  height: ${({ $size }) => $size}px;
`;

/** _SidebarSectionLabel — labelSmall w700 11px, letterSpacing 0.4. */
export const SidebarSectionLabel = styled.p`
  margin: 0;
  padding: ${({ theme }) =>
    `${theme.spacing.space2}px ${theme.spacing.space3}px ${theme.spacing.space1}px`};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  ${({ theme }) => theme.media.md} {
    text-transform: uppercase;
    letter-spacing: 0.8px;
    padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};
  }
`;

const sidebarRow = css`
  ${resetButton}
  display: flex;
  align-items: center;
  width: calc(100% - ${({ theme }) => theme.spacing.space2 * 2}px);
  margin: 2px ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  transition: background-color 120ms ${({ theme }) => theme.motion.easeOutCubic};
`;

/** Web: selected rows get a soft brand tint + a left accent bar. */
const webSelected = css<{ $selected: boolean }>`
  ${({ theme }) => theme.media.md} {
    position: relative;
    border-radius: ${({ theme }) => theme.radius.md}px;
    background: ${({ theme, $selected }) =>
      $selected ? withAlpha(theme.colors.primaryContainer, 0.6) : 'transparent'};

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 8px;
      bottom: 8px;
      width: 3px;
      border-radius: 0 3px 3px 0;
      background: ${({ theme }) => theme.colors.primary};
      opacity: ${({ $selected }) => ($selected ? 1 : 0)};
    }

    &:hover {
      background: ${({ theme, $selected }) =>
        $selected ? withAlpha(theme.colors.primaryContainer, 0.6) : theme.colors.surfaceContainer};
    }
  }
`;

/** _SidebarAllRow — primaryContainer @ 0.55 when selected. */
export const SidebarAllRow = styled.button<{ $selected: boolean }>`
  ${sidebarRow}
  margin-top: 0;
  margin-bottom: 0;
  padding: ${({ theme }) => theme.spacing.space2}px;
  background: ${({ theme, $selected }) =>
    $selected ? withAlpha(theme.colors.primaryContainer, 0.55) : 'transparent'};
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: ${({ $selected }) => ($selected ? 800 : 600)};
  color: ${({ theme }) => theme.colors.onBackground};

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primaryContainer, 0.55)};
  }

  ${webSelected}

  ${({ theme }) => theme.media.md} {
    gap: ${({ theme }) => theme.spacing.space3}px;
    min-height: 52px;
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    font-weight: ${({ $selected }) => ($selected ? 800 : 600)};
    color: ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.onBackground)};
    padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  }
`;

/** Web-only icon tile for the "All" row (same size as the type thumbs). */
export const AllIcon = styled.span<{ $selected: boolean }>`
  display: none;

  ${({ theme }) => theme.media.md} {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: ${({ theme }) => theme.radius.sm}px;
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primary : theme.colors.surfaceContainer};
    color: ${({ theme, $selected }) => ($selected ? theme.colors.onPrimary : theme.colors.primary)};

    i {
      font-size: 16px;
    }
  }
`;

/** Web-only product-group count pill at the end of a sidebar row. */
export const CountPill = styled.span<{ $selected: boolean }>`
  display: none;

  ${({ theme }) => theme.media.md} {
    display: inline-flex;
    flex-shrink: 0;
    justify-content: center;
    min-width: 24px;
    margin-left: auto;
    padding: 2px ${({ theme }) => theme.spacing.space2}px;
    border-radius: 999px;
    ${({ theme }) => textStyle(theme.typography.labelSmall)}
    font-weight: 700;
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primary : theme.colors.surfaceContainer};
    color: ${({ theme, $selected }) =>
      $selected ? theme.colors.onPrimary : theme.colors.onSurfaceVariant};
  }
`;

/** _SidebarTypeRow — primarySidebarSelected when selected. */
export const SidebarTypeRow = styled.button<{ $selected: boolean }>`
  ${sidebarRow}
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space2}px`};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primarySidebarSelected : 'transparent'};

  &:hover {
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primarySidebarSelected : theme.colors.surfaceVariant};
  }

  ${webSelected}

  ${({ theme }) => theme.media.md} {
    gap: ${({ theme }) => theme.spacing.space3}px;
    min-height: 52px;
    padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  }
`;

/** 30×30 white thumb with 4px padding; border only when not selected. */
export const TypeThumb = styled.span<{ $selected: boolean }>`
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  padding: 4px;
  display: flex;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  border: 1px solid
    ${({ theme, $selected }) => ($selected ? 'transparent' : theme.colors.outlineVariant)};
  overflow: hidden;

  ${({ theme }) => theme.media.md} {
    width: 40px;
    height: 40px;
  }
`;

export const RowLabel = styled.span<{ $selected: boolean; $sub?: boolean }>`
  flex: 1;
  min-width: 0;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: ${({ $selected, $sub }) => ($selected ? 800 : $sub ? 500 : 600)};
  color: ${({ theme, $selected, $sub }) =>
    $selected
      ? theme.colors.onSurface
      : $sub
        ? theme.colors.onSurfaceVariant
        : theme.colors.onBackground};
  ${ellipsis}

  ${({ theme }) => theme.media.md} {
    flex: 0 1 auto;
    font-size: ${({ theme }) => theme.typography.labelLarge.fontSize}px;
    line-height: ${({ theme }) => theme.typography.labelLarge.lineHeight};
    color: ${({ theme, $selected, $sub }) =>
      $selected
        ? theme.colors.primary
        : $sub
          ? theme.colors.onSurfaceVariant
          : theme.colors.onBackground};
  }
`;

/** _SidebarSubCategoryRow. */
export const SidebarSubRow = styled.button<{ $selected: boolean }>`
  ${sidebarRow}
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space3}px`};
  background: ${({ theme, $selected }) =>
    $selected ? theme.colors.primarySidebarSelected : 'transparent'};

  &:hover {
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primarySidebarSelected : theme.colors.surfaceVariant};
  }

  ${webSelected}

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space4}px`};
  }
`;

// ── Content ─────────────────────────────────────────────────────────────

/**
 * Scroll container for heading + grid. The grid itself must not be the
 * scroller: as a fixed-height scroll box its auto rows were squeezed to fit,
 * clipping each card's price/title below the image.
 */
export const Content = styled.main<{ $fullOnMobile: boolean }>`
  grid-area: content;
  grid-column: ${({ $fullOnMobile }) => ($fullOnMobile ? '1 / -1' : 'auto')};
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};

  ${({ theme }) => theme.media.md} {
    grid-column: auto;
    padding: ${({ theme }) =>
      `${theme.spacing.space5}px ${theme.spacing.space8}px ${theme.spacing.space8}px`};
  }
`;

/** _ContentHeading. */
export const ContentHeading = styled.div`
  flex-shrink: 0;
  padding: ${({ theme }) =>
    `${theme.spacing.space3}px ${theme.spacing.space3}px ${theme.spacing.space2}px`};

  /* Web: the heading lives in the toolbar instead. */
  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

/** Result count + active filter chips above the grid. */
export const ResultsBar = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => `0 ${theme.spacing.space3}px ${theme.spacing.space3}px`};

  ${({ theme }) => theme.media.md} {
    padding: 0 0 ${({ theme }) => theme.spacing.space4}px;
  }
`;

export const ResultsCount = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  strong {
    font-weight: 800;
    color: ${({ theme }) => theme.colors.onBackground};
  }
`;

export const FilterChip = styled.button`
  ${resetButton}
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${({ theme }) => `4px ${theme.spacing.space2}px 4px ${theme.spacing.space3}px`};
  border-radius: 999px;
  background: ${({ theme }) => theme.colors.primaryContainer};
  color: ${({ theme }) => theme.colors.onPrimaryContainer};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-weight: 700;

  i {
    font-size: 10px;
  }

  &:hover {
    background: ${({ theme }) => theme.colors.primarySidebarSelected};
  }
`;

export const ContentTitle = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onBackground};
  ${ellipsis}

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.titleLarge)}
    font-weight: 800;
    color: ${({ theme }) => theme.colors.onBackground};
  }
`;

export const ContentSubtitle = styled.p`
  margin: 2px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

  ${({ theme }) => theme.media.md} {
    -webkit-line-clamp: 1;
  }
`;

/** GridView — 2 columns on mobile, auto-fill on web. */
export const Grid = styled.div`
  flex-shrink: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-content: start;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => `0 ${theme.spacing.space3}px ${theme.spacing.space2}px`};

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(
      auto-fill,
      minmax(${({ theme }) => theme.layout.catalogCardMinWidth}px, 1fr)
    );
    gap: ${({ theme }) => theme.spacing.space5}px;
    padding: 0;
  }
`;

// ── _CatalogStateMessage ────────────────────────────────────────────────

export const StateMessage = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.space6}px;
  text-align: center;
`;

export const StateIcon = styled.div`
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryContainer};
  color: ${({ theme }) => theme.colors.primary};
  margin-bottom: ${({ theme }) => theme.spacing.space4}px;

  i {
    font-size: 30px;
  }
`;

export const StateTitle = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;
`;

export const StateSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

// ── _CategoryProductCard ────────────────────────────────────────────────

export const Card = styled.button`
  ${resetButton}
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: ${({ theme }) => theme.colors.surface};
  border-radius: ${({ theme }) => theme.radius.md}px;
  overflow: hidden;
  transition:
    transform 160ms ${({ theme }) => theme.motion.easeOutCubic},
    box-shadow 160ms ${({ theme }) => theme.motion.easeOutCubic};

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => theme.spacing.space2}px;
    border: 1px solid ${({ theme }) => theme.colors.divider};
    border-radius: ${({ theme }) => theme.radius.lg}px;

    &:hover {
      transform: translateY(-3px);
      border-color: ${({ theme }) => withAlpha(theme.colors.primary, 0.35)};
      box-shadow: ${({ theme }) => theme.elevation.level2};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: 2px;
    }
  }
`;

/** AspectRatio(1.02) image box with divider border + soft shadow. */
export const CardMedia = styled.div`
  position: relative;
  width: 100%;
  aspect-ratio: 1.02;
  flex-shrink: 0;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.md}px;
  box-shadow: 0 3px 10px ${({ theme }) => theme.colors.shadow};
  overflow: hidden;

  ${({ theme }) => theme.media.md} {
    border-color: transparent;
    box-shadow: none;
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

/** Green "ADD / N Products" badge, bottom-right. */
export const AddBadge = styled.span`
  position: absolute;
  right: ${({ theme }) => theme.spacing.space2}px;
  bottom: ${({ theme }) => theme.spacing.space2}px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space2}px`};
  background: ${({ theme }) => theme.colors.accentGreenContainer};
  border-radius: 10px;
  box-shadow: ${({ theme }) => theme.elevation.level1};
`;

export const AddBadgeLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onAccentGreenContainer};
`;

export const AddBadgeCount = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-size: 10px;
  line-height: 1.1;
  color: ${({ theme }) => theme.colors.onAccentGreenContainer};
`;

export const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: ${({ theme }) =>
    `${theme.spacing.space2}px ${theme.spacing.space1}px ${theme.spacing.space1}px`};

  ${({ theme }) => theme.media.md} {
    gap: 4px;
    padding: ${({ theme }) =>
      `${theme.spacing.space3}px ${theme.spacing.space2}px ${theme.spacing.space1}px`};
  }
`;

/** RichText: ₹ (w700) + price (titleSmall w800) + " /pcs" (labelSmall w500). */
export const CardPrice = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 800;
  color: ${({ theme }) => theme.colors.onBackground};
  ${ellipsis}
`;

export const Rupee = styled.span`
  font-weight: 700;
`;

export const PriceUnit = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  font-weight: 500;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

export const CardDiscount = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 700;
  color: ${({ theme }) => theme.colors.success};
  ${ellipsis}
`;

export const CardTitle = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  font-weight: 700;
  line-height: 1.15;
  ${ellipsis}
`;
