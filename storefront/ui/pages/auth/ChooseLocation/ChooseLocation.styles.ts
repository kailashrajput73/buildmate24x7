import styled, { css, keyframes } from 'styled-components';
import { MapContainer } from 'react-leaflet';
import { textStyle, withAlpha } from '../../../theme';

/** Flutter literal sizes from choose_location_screen.dart. */
const ROUND_BUTTON_SIZE = 32;
const ROUND_BUTTON_ICON_SIZE = 14;
const PIN_OUTER_SIZE = 52;
const PIN_INNER_SIZE = 36;
const PIN_INNER_TOP = 4;
const PIN_BORDER_WIDTH = 3;
const PIN_ICON_SIZE = 18;
const PIN_SHADOW_GAP = 2;
const PIN_SHADOW_WIDTH = 10;
const PIN_SHADOW_HEIGHT = 4;
const LOCATE_BUTTON_SIZE = 52;
const LOCATE_ICON_SIZE = 24;
const SHEET_RADIUS = 24;
const SHEET_MAX_HEIGHT_VH = 52;
const SEARCH_HEIGHT = 52;
const SEARCH_ICON_SIZE = 24;
const SEARCH_HINT_FONT_SIZE = 15;
const ADDRESS_ICON_BOX = 40;
const LOCATED_ICON_SIZE = 20;
const CTA_ICON_SIZE = 18;
const CTA_RADIUS = 14;
const CHECK_ICON_SIZE = 14;
const CHECK_GAP = 6;
const LINE1_GAP = 4;

/** Flutter: Padding(14) inside the 52px FAB → 24px spinner, strokeWidth 2.2 */
export const LOCATE_SPINNER_SIZE = 24;
export const LOCATE_SPINNER_STROKE = 2.2;
/** Flutter: SizedBox(16×16) spinner, strokeWidth 2 */
export const CTA_SPINNER_SIZE = 16;
export const CTA_SPINNER_STROKE = 2;

/** Scaffold(backgroundColor: surface) */
export const Screen = styled.div`
  display: flex;
  justify-content: center;
  background: ${({ theme }) => theme.colors.surface};
`;

/** Scaffold body: Column(Expanded(map), bottom sheet) */
export const Body = styled.div`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.authMaxWidth}px;
  height: 100vh;
  height: 100dvh;
  display: flex;
  flex-direction: column;

  /* Web: map fills the viewport, the sheet becomes a right-hand sidebar. */
  ${({ theme }) => theme.media.md} {
    max-width: none;
    flex-direction: row;
  }
`;

/** Expanded > Stack(fit: expand) */
export const MapArea = styled.div`
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
`;

/**
 * FlutterMap filling the Stack. `z-index: 0` gives Leaflet's panes their own
 * stacking context so the overlays below paint above the map.
 */
export const MapSurface = styled(MapContainer)`
  position: absolute;
  inset: 0;
  z-index: 0;
`;

/** SafeArea(bottom: false) > Padding(LTRB: space5, space2, space5, 0) > Row */
export const TopBar = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  padding: ${({ theme }) => `${theme.spacing.space2}px ${theme.spacing.space5}px 0`};
  pointer-events: none;

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => theme.spacing.space6}px;
  }
`;

/** _RoundIconButton: InkWell > Container(32×32, white circle, shadow) */
export const RoundIconButton = styled.button`
  pointer-events: auto;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${ROUND_BUTTON_SIZE}px;
  height: ${ROUND_BUTTON_SIZE}px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 3px 10px ${({ theme }) => withAlpha(theme.colors.black, 0.08)};
  color: ${({ theme }) => theme.colors.onSurface};

  .pi {
    font-size: ${ROUND_BUTTON_ICON_SIZE}px;
  }
`;

/** Center > Column(mainAxisSize: min) */
export const PinCenter = styled.div`
  position: absolute;
  inset: 0;
  margin: auto;
  width: ${PIN_OUTER_SIZE}px;
  height: ${PIN_OUTER_SIZE + PIN_SHADOW_GAP + PIN_SHADOW_HEIGHT}px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

/**
 * AnimationController(900ms).repeat(reverse: true) with
 * offset = sin(value · π) · -14 — each 900ms leg is one full bounce.
 */
const bounce = keyframes`
  0%    { transform: translateY(0); }
  12.5% { transform: translateY(-5.36px); }
  25%   { transform: translateY(-9.9px); }
  37.5% { transform: translateY(-12.93px); }
  50%   { transform: translateY(-14px); }
  62.5% { transform: translateY(-12.93px); }
  75%   { transform: translateY(-9.9px); }
  87.5% { transform: translateY(-5.36px); }
  100%  { transform: translateY(0); }
`;

/** Transform.translate(offset: Offset(0, bounce)) > _MapPin */
export const PinBounce = styled.div<{ $locating: boolean }>`
  ${({ $locating }) =>
    $locating &&
    css`
      animation: ${bounce} 900ms linear infinite;
    `}
`;

/** _MapPin: Container(52×52) > Stack(topCenter) — outer halo */
export const PinHalo = styled.div`
  position: relative;
  width: ${PIN_OUTER_SIZE}px;
  height: ${PIN_OUTER_SIZE}px;
  border-radius: 50%;
  background: ${({ theme }) => withAlpha(theme.loginFlow.accent, 0.16)};
`;

/** Positioned(top: 4) > Container(36×36, accentGradient, white border 3) */
export const PinHead = styled.div`
  position: absolute;
  top: ${PIN_INNER_TOP}px;
  left: 50%;
  transform: translateX(-50%);
  box-sizing: border-box;
  width: ${PIN_INNER_SIZE}px;
  height: ${PIN_INNER_SIZE}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: ${PIN_BORDER_WIDTH}px solid ${({ theme }) => theme.colors.white};
  background: linear-gradient(
    to bottom right,
    ${({ theme }) => theme.loginFlow.accentGradient[0]},
    ${({ theme }) => theme.loginFlow.accentGradient[1]}
  );
  box-shadow: 0 4px 10px ${({ theme }) => withAlpha(theme.loginFlow.accent, 0.4)};
  color: ${({ theme }) => theme.colors.white};

  .pi {
    font-size: ${PIN_ICON_SIZE}px;
  }
`;

/** SizedBox(height: 2) + Container(10×4, black@0.25, radius 4) */
export const PinShadow = styled.div`
  margin-top: ${PIN_SHADOW_GAP}px;
  width: ${PIN_SHADOW_WIDTH}px;
  height: ${PIN_SHADOW_HEIGHT}px;
  border-radius: ${({ theme }) => theme.radius.xs}px;
  background: ${({ theme }) => withAlpha(theme.colors.black, 0.25)};
`;

/** Positioned(right: space5, bottom: space5) > _LocateMeButton */
export const LocateMeButton = styled.button`
  position: absolute;
  right: ${({ theme }) => theme.spacing.space5}px;
  bottom: ${({ theme }) => theme.spacing.space5}px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${LOCATE_BUTTON_SIZE}px;
  height: ${LOCATE_BUTTON_SIZE}px;
  padding: 0;
  border: none;
  border-radius: 50%;
  cursor: pointer;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 6px 14px ${({ theme }) => withAlpha(theme.colors.black, 0.12)};
  color: ${({ theme }) => theme.loginFlow.accent};

  .pi {
    font-size: ${LOCATE_ICON_SIZE}px;
  }
`;

/**
 * Bottom half: Container(maxHeight 52% of screen, white, top radius 24,
 * shadow 0x14000000 blur 24 offset (0,-6)) > SafeArea(top: false) >
 * SingleChildScrollView (trailing SizedBox(space4) → bottom padding).
 */
export const Sheet = styled.div`
  /* Positioned so its upward shadow paints over the map area. */
  position: relative;
  flex-shrink: 0;
  max-height: ${SHEET_MAX_HEIGHT_VH}vh;
  max-height: ${SHEET_MAX_HEIGHT_VH}dvh;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: ${({ theme }) =>
    `${theme.spacing.space5}px ${theme.spacing.space5}px ${theme.spacing.space4}px`};
  background: ${({ theme }) => theme.colors.white};
  border-radius: ${SHEET_RADIUS}px ${SHEET_RADIUS}px 0 0;
  box-shadow: 0 -6px 24px ${({ theme }) => withAlpha(theme.colors.black, 0.08)};

  ${({ theme }) => theme.media.md} {
    width: ${({ theme }) => theme.layout.authSidebarWidth}px;
    max-height: none;
    justify-content: center;
    padding: ${({ theme }) => `${theme.spacing.space10}px ${theme.spacing.space8}px`};
    border-radius: 0;
    box-shadow: -6px 0 24px ${({ theme }) => withAlpha(theme.colors.black, 0.08)};
  }
`;

/** Text(headlineSmall, w800) */
export const Title = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-weight: 800;

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.headlineMedium)}
    font-weight: 800;
  }
`;

/** SizedBox(space2) + Text(bodyMedium, onSurfaceVariant) */
export const Subtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space2}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space4) + _SearchField: Container(h52, white, radius 16, shadow) */
export const SearchField = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    margin-top: ${({ theme }) => theme.spacing.space6}px;
    border: 1px solid ${({ theme }) => theme.loginFlow.fieldBorder};
  }

  height: ${SEARCH_HEIGHT}px;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.white};
  box-shadow: 0 6px 14px ${({ theme }) => withAlpha(theme.colors.black, 0.06)};

  .pi {
    font-size: ${SEARCH_ICON_SIZE}px;
    color: ${({ theme }) => theme.loginFlow.accent};
  }
`;

/** Text(fontSize 15, onSurfaceVariant) on DefaultTextStyle(bodyMedium) */
export const SearchHint = styled.span`
  flex: 1;
  min-width: 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  font-size: ${SEARCH_HINT_FONT_SIZE}px;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space4) + _AddressCard: Column(stretch) */
export const AddressCard = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  display: flex;
  flex-direction: column;
  align-items: stretch;
`;

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

/** AnimatedSwitcher(200ms) — incoming child fades in */
export const Switched = styled.div`
  animation: ${fadeIn} 200ms linear;
`;

/** located: Row(crossAxisAlignment: start) */
export const LocatedRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

/** not located: InkWell(radius 14) > Padding(vertical space2) > Row */
export const CtaButton = styled.button`
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space2}px 0;
  border: none;
  border-radius: ${CTA_RADIUS}px;
  background: transparent;
  cursor: pointer;
  text-align: left;
`;

/** Container(40×40, accentMuted, radius 12) */
export const IconBox = styled.div<{ $iconSize: 'located' | 'cta' }>`
  flex-shrink: 0;
  width: ${ADDRESS_ICON_BOX}px;
  height: ${ADDRESS_ICON_BOX}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.loginFlow.accentMuted};
  color: ${({ theme }) => theme.loginFlow.accent};

  .pi {
    font-size: ${({ $iconSize }) =>
      $iconSize === 'located' ? LOCATED_ICON_SIZE : CTA_ICON_SIZE}px;
  }
`;

/** Expanded > Column(crossAxisAlignment: start) */
export const TextColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

/** Row('Current location' + check icon) */
export const CurrentLocationLabel = styled.div`
  display: flex;
  align-items: center;
  gap: ${CHECK_GAP}px;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 700;
  color: ${({ theme }) => theme.loginFlow.accent};

  .pi {
    font-size: ${CHECK_ICON_SIZE}px;
  }
`;

/** Text(titleSmall, w700) */
export const Line1 = styled.span<{ $gapTop?: boolean }>`
  margin-top: ${({ $gapTop }) => ($gapTop ? LINE1_GAP : 0)}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;
`;

/** Text(bodySmall, onSurfaceVariant) */
export const Line2 = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space4) + LoginFlowContinueButton */
export const ContinueWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    margin-top: ${({ theme }) => theme.spacing.space6}px;
  }
`;
