import styled from 'styled-components';
import { textStyle } from '../../../theme';
import { authWebCard, authWebStage } from '../../../shared/AuthWebLayout';

/** Flutter: AnimatedContainer(duration: 150ms), default linear curve */
const SELECT_ANIM_MS = 150;
/** Flutter: Container(width: 48, height: 48) thumbnail */
const THUMB_SIZE = 48;
/** Flutter: BorderRadius.circular(10) outer, ClipRRect(circular(9)) inner */
const THUMB_RADIUS = 10;
const THUMB_IMAGE_RADIUS = 9;
/** Flutter: Icon(Icons.image_outlined, size: 20) error fallback */
const THUMB_FALLBACK_ICON = 20;
/** Flutter: _SelectionIndicator 24×24, border 1.5, Icon(Icons.check, size: 16) */
const INDICATOR_SIZE = 24;
const INDICATOR_BORDER = 1.5;
const INDICATOR_ICON = 16;
/** Flutter: Border.all(width: selected ? 1.5 : 1) */
const OPTION_BORDER_SELECTED = 1.5;
const OPTION_BORDER = 1;

/** Scaffold(backgroundColor: surface) + SafeArea */
export const Screen = styled.div`
  height: 100vh;
  height: 100dvh;
  display: flex;
  justify-content: center;
  background: ${({ theme }) => theme.colors.surface};
  ${authWebStage}
`;

/** Padding(LTRB: space6, space6, space6, space4) > Column(stretch) */
export const Content = styled.div`
  flex: 1;
  width: 100%;
  max-width: ${({ theme }) => theme.layout.authMaxWidth}px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: ${({ theme }) =>
    `${theme.spacing.space6}px ${theme.spacing.space6}px ${theme.spacing.space4}px`};
  ${authWebCard}

  /* Web: wider card that never outgrows the viewport; the list scrolls inside. */
  ${({ theme }) => theme.media.md} {
    max-width: ${({ theme }) => theme.layout.authWideMaxWidth}px;
    max-height: 100%;
  }
`;

/** Row(crossAxisAlignment: start): back button + SizedBox(space4) + Expanded(Column) */
export const Header = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space4}px;
`;

export const HeaderText = styled.div`
  flex: 1;
  min-width: 0;
`;

/** Text(headlineSmall w800) */
export const Title = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-weight: 800;
`;

/** SizedBox(space2) + Text(bodyMedium, onSurfaceVariant) */
export const Subtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space2}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space6) + Expanded(ListView.separated(separator: space3)) */
export const List = styled.div`
  flex: 1;
  min-height: 0;
  margin-top: ${({ theme }) => theme.spacing.space6}px;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
  overflow-y: auto;

  /* Web: two-column grid of the same option tiles. */
  ${({ theme }) => theme.media.md} {
    flex: 1 1 auto;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    align-content: start;
    margin-top: ${({ theme }) => theme.spacing.space8}px;
    padding: ${({ theme }) => theme.spacing.space1}px;
  }
`;

/** InkWell > AnimatedContainer(padding h:space4 v:space3, radius lg, border) > Row */
export const Option = styled.button<{ $selected: boolean }>`
  flex-shrink: 0;
  width: 100%;
  display: flex;
  align-items: center;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border: ${({ $selected }) => ($selected ? OPTION_BORDER_SELECTED : OPTION_BORDER)}px solid
    ${({ theme, $selected }) => ($selected ? theme.loginFlow.accent : theme.loginFlow.fieldBorder)};
  background: ${({ theme, $selected }) =>
    $selected ? theme.loginFlow.accentMuted : theme.colors.surface};
  transition:
    background-color ${SELECT_ANIM_MS}ms linear,
    border-color ${SELECT_ANIM_MS}ms linear;
  cursor: pointer;
  text-align: left;

  ${({ theme }) => theme.media.md} {
    height: 100%;
    padding: ${({ theme }) => theme.spacing.space4}px;

    &:hover {
      border-color: ${({ theme }) => theme.loginFlow.accent};
    }
  }
`;

/** Container(48×48, border fieldBorder, radius 10) > ClipRRect(radius 9) */
export const Thumb = styled.div`
  flex-shrink: 0;
  width: ${THUMB_SIZE}px;
  height: ${THUMB_SIZE}px;
  border: 1px solid ${({ theme }) => theme.loginFlow.fieldBorder};
  border-radius: ${THUMB_RADIUS}px;
`;

/** Image.asset(fit: BoxFit.cover) */
export const ThumbImage = styled.img`
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: ${THUMB_IMAGE_RADIUS}px;
`;

/** errorBuilder: ColoredBox(surfaceContainer) > Icon(image_outlined, 20, onSurfaceVariant) */
export const ThumbFallback = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: ${THUMB_IMAGE_RADIUS}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  .pi {
    font-size: ${THUMB_FALLBACK_ICON}px;
  }
`;

/** SizedBox(space4) + Expanded(Column(start)) */
export const OptionText = styled.div`
  flex: 1;
  min-width: 0;
  margin-left: ${({ theme }) => theme.spacing.space4}px;
`;

/** Text(titleMedium w700) */
export const OptionTitle = styled.span`
  display: block;
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-weight: 700;
`;

/** SizedBox(space1) + Text(bodyMedium, onSurfaceVariant) */
export const OptionSubtitle = styled.span`
  display: block;
  margin-top: ${({ theme }) => theme.spacing.space1}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
`;

/** SizedBox(space2) + _SelectionIndicator (AnimatedContainer, circle) */
export const Indicator = styled.span<{ $selected: boolean }>`
  flex-shrink: 0;
  box-sizing: border-box;
  width: ${INDICATOR_SIZE}px;
  height: ${INDICATOR_SIZE}px;
  margin-left: ${({ theme }) => theme.spacing.space2}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  border: ${INDICATOR_BORDER}px solid
    ${({ theme, $selected }) => ($selected ? theme.loginFlow.accent : theme.loginFlow.fieldBorder)};
  background: ${({ theme, $selected }) => ($selected ? theme.loginFlow.accent : 'transparent')};
  color: ${({ theme }) => theme.colors.white};
  transition:
    background-color ${SELECT_ANIM_MS}ms linear,
    border-color ${SELECT_ANIM_MS}ms linear;

  .pi {
    font-size: ${INDICATOR_ICON}px;
  }
`;

/** SizedBox(space4) + LoginFlowContinueButton */
export const ContinueWrap = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    margin-top: ${({ theme }) => theme.spacing.space6}px;
  }
`;
