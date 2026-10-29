import styled, { css, keyframes } from 'styled-components';
import type { VerificationStatus } from '../../../services/profile/profileModels';
import { textStyle, withAlpha } from '../../../theme';

const focusRing = css`
  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

const resetButton = css`
  appearance: none;
  border: 0;
  margin: 0;
  font: inherit;
  cursor: pointer;
  background: none;
`;

const mobileOnly = css`
  ${({ theme }) => theme.media.md} {
    display: none;
  }
`;

const webOnly = css`
  display: none;
`;

const spin = keyframes`
  to { transform: rotate(360deg); }
`;

export const Screen = styled.div`
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.colors.background};
`;

export const Root = styled.div`
  flex: 1;
  min-width: 0;
`;

// ── Mobile header (Flutter ProfileHeader: blue gradient, avatar) ──────
export const MobileHeader = styled.header`
  padding: ${({ theme }) =>
    `${theme.spacing.space5}px ${theme.spacing.space4}px ${theme.spacing.space6}px`};
  background: linear-gradient(
    135deg,
    ${({ theme }) => theme.colors.primary},
    ${({ theme }) => theme.colors.primaryPressed}
  );
  border-radius: ${({ theme }) => `0 0 ${theme.radius.xl}px ${theme.radius.xl}px`};
  color: ${({ theme }) => theme.colors.onPrimary};
  ${mobileOnly}
`;

export const MobileBack = styled.button`
  ${resetButton}
  ${focusRing}
  width: ${({ theme }) => theme.components.minInteractiveDimension}px;
  height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  margin: ${({ theme }) => `-${theme.spacing.space3}px 0 ${theme.spacing.space1}px -${theme.spacing.space3}px`};
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  color: ${({ theme }) => theme.colors.onPrimary};
  font-size: 18px;
`;

export const HeaderRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
`;

export const Avatar = styled.div<{ $wide?: boolean }>`
  position: relative;
  flex: none;
  width: ${({ theme, $wide }) =>
    $wide ? theme.layout.profileAvatarSizeWide : theme.layout.profileAvatarSize}px;
  height: ${({ theme, $wide }) =>
    $wide ? theme.layout.profileAvatarSizeWide : theme.layout.profileAvatarSize}px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryContainer};
  border: 3px solid ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.elevation.level1};
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  color: ${({ theme }) => theme.colors.primary};
  font-weight: 700;
`;

export const CameraButton = styled.button`
  ${resetButton}
  ${focusRing}
  position: absolute;
  right: -2px;
  bottom: -2px;
  width: 26px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surface};
  box-shadow: ${({ theme }) => theme.elevation.level1};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 12px;
`;

export const HeaderTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  color: ${({ theme }) => theme.colors.onPrimary};
  font-weight: 700;
`;

export const HeaderSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => withAlpha(theme.colors.onPrimary, 0.85)};
`;

// ── Page ────────────────────────────────────────────────────────────────
export const Page = styled.main`
  width: 100%;
  max-width: ${({ theme }) => theme.layout.profileMaxWidth}px;
  margin: 0 auto;
  padding: ${({ theme }) =>
    `${theme.spacing.space4}px ${theme.spacing.space4}px ${theme.spacing.space8}px`};

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space8}px ${theme.spacing.space6}px`};
  }
`;

export const WebHead = styled.div`
  ${webOnly}

  ${({ theme }) => theme.media.md} {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.space6}px;
    margin-bottom: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const WebHeadMain = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  min-width: 0;
`;

export const BackLink = styled.button`
  ${resetButton}
  ${focusRing}
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin: 0 0 ${({ theme }) => theme.spacing.space2}px -12px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space3}px`};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const WebTitle = styled.h1`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineMedium)}
`;

export const WebSubtitle = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const Banner = styled.div<{ $placement: 'mobile' | 'web' }>`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: ${({ theme }) => theme.spacing.space3}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.infoContainer};
  border: 1px solid ${({ theme }) => withAlpha(theme.colors.info, 0.2)};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.info};

  i {
    font-size: 18px;
    margin-top: 1px;
  }

  strong {
    font-weight: 600;
  }

  ${({ $placement, theme }) =>
    $placement === 'mobile'
      ? css`
          margin-bottom: ${theme.spacing.space3}px;
          ${mobileOnly}
        `
      : css`
          flex: 0 1 ${theme.layout.profileBannerMaxWidth}px;
        `}
`;

export const Sections = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;

  ${({ theme }) => theme.media.md} {
    gap: ${({ theme }) => theme.spacing.space4}px;
  }
`;

// ── Section card ────────────────────────────────────────────────────────
export const Card = styled.section<{ $editing: boolean; $pending: boolean }>`
  position: relative;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  transition:
    border-color 0.15s,
    box-shadow 0.15s;

  ${({ $pending, theme }) =>
    $pending &&
    css`
      box-shadow: inset 3px 0 0 ${theme.colors.error};
    `}

  ${({ $editing, theme }) =>
    $editing &&
    css`
      border-color: ${theme.colors.primary};
      box-shadow: 0 0 0 3px ${withAlpha(theme.colors.primary, 0.12)};
    `}

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => `${theme.spacing.space5}px ${theme.spacing.space6}px`};
  }
`;

/** Mobile: the whole card is tappable (Flutter InkWell) in view mode. */
export const MobileHit = styled.button`
  ${resetButton}
  ${focusRing}
  position: absolute;
  inset: 0;
  z-index: 1;
  border-radius: inherit;

  &:active {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.04)};
  }

  ${mobileOnly}
`;

export const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
`;

export const IconTile = styled.span`
  flex: none;
  width: ${({ theme }) => theme.layout.profileSectionIconSize}px;
  height: ${({ theme }) => theme.layout.profileSectionIconSize}px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.primaryContainer};
  color: ${({ theme }) => theme.colors.primary};
  font-size: 18px;
`;

export const HeadText = styled.div`
  flex: 1;
  min-width: 0;
`;

export const CardTitle = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-weight: 700;

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
  }
`;

export const CardSubtitle = styled.p`
  ${webOnly}
  margin: 2px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}

  ${({ theme }) => theme.media.md} {
    display: block;
  }
`;

export const Badge = styled.span<{ $status: VerificationStatus }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  padding: ${({ theme }) => `${theme.spacing.space1}px ${theme.spacing.space2}px`};
  border-radius: ${({ theme }) => theme.radius.pill}px;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  font-weight: 600;
  white-space: nowrap;
  color: ${({ theme, $status }) =>
    $status === 'approved' ? theme.colors.success : theme.colors.error};
  background: ${({ theme, $status }) =>
    $status === 'approved' ? theme.colors.successContainer : theme.colors.errorContainer};

  i {
    font-size: 12px;
  }
`;

export const EditButton = styled.button`
  ${resetButton}
  ${focusRing}
  ${webOnly}
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: 34px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.primaryContainer};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.primary};

  i {
    font-size: 12px;
  }

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primarySidebarSelected};
  }

  &:disabled {
    cursor: not-allowed;
    background: ${({ theme }) => theme.colors.disabledContainer};
    color: ${({ theme }) => theme.colors.disabled};
  }

  ${({ theme }) => theme.media.md} {
    display: inline-flex;
  }
`;

export const Chevron = styled.i<{ $locked: boolean }>`
  flex: none;
  font-size: ${({ $locked }) => ($locked ? 14 : 16)}px;
  color: ${({ theme, $locked }) => ($locked ? theme.colors.outline : theme.colors.primary)};
  ${mobileOnly}
`;

export const CardDivider = styled.hr`
  margin: ${({ theme }) => `${theme.spacing.space3}px 0 ${theme.spacing.space2}px`};
  border: 0;
  border-top: 1px solid ${({ theme }) => theme.colors.divider};

  ${({ theme }) => theme.media.md} {
    margin: ${({ theme }) => `${theme.spacing.space4}px 0`};
  }
`;

// Mobile view: label / value rows.
export const MobileRows = styled.dl`
  margin: 0;
  ${mobileOnly}
`;

export const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: 6px 0;
`;

export const RowLabel = styled.dt`
  flex: none;
  width: ${({ theme }) => theme.layout.profileLabelWidth}px;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.outline};
`;

export const RowValue = styled.dd`
  flex: 1;
  min-width: 0;
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurface};
  font-weight: 500;
  overflow-wrap: anywhere;
`;

export const NotEditableChip = styled.span`
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.xs}px;
  background: ${({ theme }) => theme.colors.surfaceVariant};
  ${({ theme }) => textStyle(theme.typography.labelSmall)}

  i {
    font-size: 10px;
  }
`;

// Web view + edit form: boxed fields in a responsive grid.
export const FieldGrid = styled.div<{ $cols: number; $viewOnly?: boolean }>`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.space4}px;

  ${({ $viewOnly }) => $viewOnly && webOnly}

  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns: repeat(${({ $cols }) => Math.min($cols, 2)}, minmax(0, 1fr));
    column-gap: ${({ theme }) => theme.spacing.space6}px;
  }

  ${({ theme }) => theme.media.lg} {
    grid-template-columns: repeat(${({ $cols }) => $cols}, minmax(0, 1fr));
  }
`;

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
`;

export const FieldLabel = styled.label`
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  span {
    color: ${({ theme }) => theme.colors.error};
  }
`;

const boxBase = css`
  width: 100%;
  min-height: 44px;
  padding: ${({ theme }) => `10px ${theme.spacing.space3}px`};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurface};
`;

export const ValueBox = styled.div<{ $locked?: boolean; $multiline?: boolean }>`
  ${boxBase}
  display: flex;
  align-items: ${({ $multiline }) => ($multiline ? 'flex-start' : 'center')};
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space2}px;
  background: ${({ theme, $locked }) =>
    $locked ? theme.colors.surfaceVariant : theme.colors.surfaceContainer};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  overflow-wrap: anywhere;
  ${({ $multiline }) =>
    $multiline &&
    css`
      min-height: 72px;
    `}

  i {
    flex: none;
    font-size: 12px;
    color: ${({ theme }) => theme.colors.outline};
  }
`;

const inputStyles = css<{ $invalid?: boolean }>`
  ${boxBase}
  display: block;
  background: ${({ theme }) => theme.colors.surface};
  border: ${({ theme }) => theme.components.input.borderWidth}px solid
    ${({ theme, $invalid }) =>
      $invalid ? theme.components.input.errorBorder : theme.components.input.border};
  outline: none;
  transition: border-color 0.15s;

  &::placeholder {
    color: ${({ theme }) => theme.colors.outline};
  }

  &:focus {
    border-color: ${({ theme, $invalid }) =>
      $invalid ? theme.components.input.errorBorder : theme.components.input.focusedBorder};
  }

  &:disabled {
    background: ${({ theme }) => theme.colors.surfaceVariant};
    border-color: ${({ theme }) => theme.colors.divider};
    color: ${({ theme }) => theme.colors.onSurfaceVariant};
    cursor: not-allowed;
  }
`;

export const Input = styled.input<{ $invalid?: boolean }>`
  ${inputStyles}
`;

export const TextArea = styled.textarea<{ $invalid?: boolean }>`
  ${inputStyles}
  min-height: 72px;
  resize: vertical;
`;

export const FieldHelper = styled.span<{ $error?: boolean }>`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme, $error }) => ($error ? theme.colors.error : theme.colors.outline)};
`;

export const DocBox = styled.div`
  ${boxBase}
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  padding-top: 6px;
  padding-bottom: 6px;
`;

export const DocInline = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  min-width: 0;
`;

export const DocIcon = styled.i`
  flex: none;
  font-size: 20px;
  color: ${({ theme }) => theme.colors.error};
`;

export const DocText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;

  strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    ${({ theme }) => textStyle(theme.typography.bodyMedium)}
    color: ${({ theme }) => theme.colors.onSurface};
    font-weight: 500;
  }

  small {
    ${({ theme }) => textStyle(theme.typography.labelSmall)}
  }
`;

export const DocAction = styled.button`
  ${resetButton}
  ${focusRing}
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space1}px;
  min-width: 32px;
  height: 32px;
  padding: 0 ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.08)};
  }
`;

export const HiddenFileInput = styled.input`
  display: none;
`;

export const ApprovalNote = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin: 0 0 ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space3}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.warningContainer};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  i {
    margin-top: 1px;
    color: ${({ theme }) => theme.colors.warning};
  }
`;

export const FormActions = styled.div`
  display: flex;
  flex-direction: column-reverse;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin-top: ${({ theme }) => theme.spacing.space5}px;

  ${({ theme }) => theme.media.sm} {
    flex-direction: row;
    justify-content: flex-end;
  }
`;

const actionButton = css`
  ${resetButton}
  ${focusRing}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: 44px;
  padding: 0 ${({ theme }) => theme.spacing.space5}px;
  border-radius: ${({ theme }) => theme.components.button.radius}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}

  &:disabled {
    cursor: progress;
    opacity: 0.7;
  }
`;

export const SecondaryButton = styled.button`
  ${actionButton}
  border: ${({ theme }) => theme.components.button.outlinedBorderWidth}px solid
    ${({ theme }) => theme.components.button.outlinedBorder};
  background: ${({ theme }) => theme.colors.surface};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const PrimaryButton = styled.button<{ $busy: boolean }>`
  ${actionButton}
  background: ${({ theme }) => theme.components.button.background};
  color: ${({ theme }) => theme.components.button.foreground};

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primaryPressed};
  }

  i {
    ${({ $busy }) =>
      $busy &&
      css`
        animation: ${spin} 0.8s linear infinite;
      `}
  }
`;

// ── Account list (Flutter `_ProfileTile`s + Sign out) ──────────────────
export const AccountTitle = styled.h2`
  margin: ${({ theme }) => `${theme.spacing.space4}px 0 ${theme.spacing.space2}px`};
  padding-left: ${({ theme }) => theme.spacing.space1}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}

  ${({ theme }) => theme.media.md} {
    margin-top: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const AccountRow = styled.div`
  display: grid;
  gap: ${({ theme }) => theme.spacing.space2}px;

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: ${({ theme }) => theme.spacing.space4}px;
  }
`;

export const AccountTile = styled.button<{ $danger?: boolean }>`
  ${resetButton}
  ${focusRing}
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  width: 100%;
  padding: ${({ theme }) => `${theme.spacing.space3}px ${theme.spacing.space4}px`};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  text-align: left;

  > i:first-child {
    font-size: 20px;
    color: ${({ theme, $danger }) => ($danger ? theme.colors.error : theme.colors.primary)};
  }

  > i:last-child {
    color: ${({ theme }) => theme.colors.outline};
  }

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const AccountText = styled.span`
  flex: 1;
  display: flex;
  flex-direction: column;

  strong {
    ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  }

  small {
    ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  }
`;

export const Loading = styled.div`
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.space12}px 0;
`;
