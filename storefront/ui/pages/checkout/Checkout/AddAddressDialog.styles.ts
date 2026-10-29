import styled, { css } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';
import { resetButton, rise } from '../shared/checkout.styles';

type PincodeStatus = 'idle' | 'loading' | 'found' | 'notFound';

export const Dialog = styled.form`
  width: min(${({ theme }) => theme.layout.checkoutDialogWidth}px, 100%);
  max-height: calc(100dvh - ${({ theme }) => theme.spacing.space8}px);
  display: flex;
  flex-direction: column;
  background: ${({ theme }) => theme.components.dialog.background};
  border-radius: ${({ theme }) => theme.components.dialog.radius}px;
  box-shadow: ${({ theme }) => theme.components.dialog.shadow};
  overflow: hidden;
  animation: ${rise} 0.2s ${({ theme }) => theme.motion.easeOutCubic};
`;

export const DialogHead = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space5}px ${({ theme }) => theme.spacing.space6}px;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};

  > div {
    flex: 1;
  }
`;

export const DialogBody = styled.div`
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space5}px ${({ theme }) => theme.spacing.space6}px;
  background: ${({ theme }) => theme.colors.background};
`;

// ── "Use my current location" ──────────────────────────────────────────

export const GpsButton = styled.button`
  ${resetButton}
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  border: 1.5px solid ${({ theme }) => withAlpha(theme.colors.primary, 0.35)};
  background: ${({ theme }) => withAlpha(theme.colors.primary, 0.05)};
  color: ${({ theme }) => theme.colors.primary};
  text-align: left;
  transition: background 0.15s ease;

  &:hover:not(:disabled) {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.09)};
  }

  &:disabled {
    cursor: progress;
  }

  > i {
    font-size: 14px;
  }
`;

export const GpsIcon = styled.span`
  flex-shrink: 0;
  width: ${({ theme }) => theme.spacing.space10}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ theme }) => withAlpha(theme.colors.primary, 0.12)};

  i {
    font-size: 20px;
  }
`;

export const GpsText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
    color: ${({ theme }) => theme.colors.primary};
  }

  span {
    ${({ theme }) => textStyle(theme.typography.bodySmall)}
  }
`;

export const OrDivider = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.labelSmall)}
  letter-spacing: 0.8px;
  color: ${({ theme }) => theme.colors.outline};

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background: ${({ theme }) => theme.colors.divider};
  }
`;

// ── Section cards ──────────────────────────────────────────────────────

export const FormSection = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.lg}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  background: ${({ theme }) => theme.colors.surface};
`;

export const FormSectionHead = styled.h3`
  margin: 0;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}

  i {
    font-size: 16px;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const FormSectionTrailing = styled.span`
  margin-left: auto;
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.outline};
`;

export const FormGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.sm} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;

// ── Inputs with prefix / suffix ────────────────────────────────────────

export const MobileInputWrap = styled.div`
  position: relative;

  input {
    width: 100%;
    padding-left: ${({ theme }) => theme.spacing.space12}px;
  }
`;

export const MobilePrefix = styled.span`
  position: absolute;
  left: ${({ theme }) => theme.components.input.paddingX}px;
  top: 50%;
  transform: translateY(-50%);
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  color: ${({ theme }) => theme.colors.onSurfaceVariant};
  pointer-events: none;
`;

export const PincodeInputWrap = styled.div`
  position: relative;

  input {
    width: 100%;
    padding-right: ${({ theme }) => theme.spacing.space12}px;
  }
`;

const statusColor = css<{ $status: PincodeStatus }>`
  color: ${({ theme, $status }) =>
    $status === 'found'
      ? theme.colors.success
      : $status === 'notFound'
        ? theme.colors.warning
        : theme.colors.onSurfaceVariant};
`;

export const PincodeSuffix = styled.span<{ $status: PincodeStatus }>`
  position: absolute;
  right: ${({ theme }) => theme.components.input.paddingX}px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  ${statusColor}

  i {
    font-size: 18px;
  }
`;

export const FieldHelper = styled.span<{ $status: PincodeStatus }>`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  ${statusColor}
`;

// ── Pin location map ───────────────────────────────────────────────────

export const MapFrame = styled.div`
  position: relative;
  height: ${({ theme }) => theme.layout.checkoutMapHeight}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.divider};

  .leaflet-container {
    width: 100%;
    height: 100%;
  }
`;

/** Fixed centre pin — the map pans beneath it (Flutter `_MapPreview`). */
export const MapPin = styled.span`
  position: absolute;
  left: 50%;
  top: 50%;
  z-index: 500;
  transform: translate(-50%, -100%);
  color: ${({ theme }) => theme.colors.error};
  pointer-events: none;

  i {
    font-size: 36px;
    filter: drop-shadow(0 2px 2px ${({ theme }) => withAlpha(theme.colors.black, 0.3)});
  }
`;

export const MapHint = styled.span`
  position: absolute;
  left: ${({ theme }) => theme.spacing.space3}px;
  right: ${({ theme }) => theme.spacing.space3}px;
  bottom: ${({ theme }) => theme.spacing.space3}px;
  z-index: 500;
  padding: ${({ theme }) => theme.spacing.space2}px ${({ theme }) => theme.spacing.space3}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => withAlpha(theme.colors.surface, 0.94)};
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  text-align: center;
  pointer-events: none;
`;

// ── Default toggle ─────────────────────────────────────────────────────

export const DefaultToggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding-top: ${({ theme }) => theme.spacing.space3}px;
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  cursor: pointer;
`;

export const DefaultToggleText = styled.span`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;

  strong {
    ${({ theme }) => textStyle(theme.typography.labelLarge)}
  }

  span {
    ${({ theme }) => textStyle(theme.typography.bodySmall)}
  }
`;

/** Material switch drawn on a native checkbox. */
export const Switch = styled.input`
  appearance: none;
  flex-shrink: 0;
  position: relative;
  width: 44px;
  height: 24px;
  margin: 0;
  border-radius: 12px;
  background: ${({ theme }) => theme.colors.outlineVariant};
  cursor: pointer;
  transition: background 0.15s ease;

  &::after {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 0 1px 2px ${({ theme }) => withAlpha(theme.colors.black, 0.25)};
    transition: transform 0.15s ease;
  }

  &:checked {
    background: ${({ theme }) => theme.colors.primary};
  }

  &:checked::after {
    transform: translateX(20px);
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;
