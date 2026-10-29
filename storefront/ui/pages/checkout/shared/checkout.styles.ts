/** Styles shared by the checkout pages (address, payment, confirmation). */
import styled, { css, keyframes } from 'styled-components';
import { textStyle, withAlpha } from '../../../theme';

export const resetButton = css`
  appearance: none;
  border: none;
  margin: 0;
  padding: 0;
  background: none;
  font: inherit;
  color: inherit;
  cursor: pointer;

  &:disabled {
    cursor: not-allowed;
  }

  &:focus-visible {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const ellipsis = css`
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
`;

export const cardSurface = css`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.lg}px;
  box-shadow: 0 1px 2px ${({ theme }) => withAlpha(theme.colors.black, 0.04)};
`;

export const gutters = css`
  padding-left: ${({ theme }) => theme.spacing.space4}px;
  padding-right: ${({ theme }) => theme.spacing.space4}px;

  ${({ theme }) => theme.media.md} {
    padding-left: ${({ theme }) => theme.spacing.space6}px;
    padding-right: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const rise = keyframes`
  from { opacity: 0; transform: translateY(12px) scale(0.98); }
  to { opacity: 1; transform: translateY(0) scale(1); }
`;

export const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

export const Screen = styled.div`
  min-height: 100vh;
  min-height: 100dvh;
  background: ${({ theme }) => theme.colors.background};
  padding-bottom: ${({ theme }) => theme.spacing.space10}px;
`;

/** Web (≥ md): `WebSideMenu` beside the checkout content, like `MainShell`. */
export const ShellBody = styled.div`
  ${({ theme }) => theme.media.md} {
    display: grid;
    grid-template-columns: ${({ theme }) => theme.layout.shellSidebarWidth}px minmax(0, 1fr);
    align-items: start;
  }
`;

// ── Body: main column + order summary ──────────────────────────────────

/** Fills the content area beside the side menu. `$single`: no order-summary column (confirmation step). */
export const Body = styled.div<{ $single?: boolean }>`
  ${gutters}
  padding-top: ${({ theme }) => theme.spacing.space6}px;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${({ theme }) => theme.spacing.space6}px;
  align-items: start;

  ${({ theme }) => theme.media.xl} {
    grid-template-columns: ${({ theme, $single }) =>
      $single ? 'minmax(0, 1fr)' : `minmax(0, 1fr) ${theme.layout.checkoutSummaryWidth}px`};
  }
`;

export const Main = styled.main`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space4}px;
  min-width: 0;
`;

// ── Stepper ────────────────────────────────────────────────────────────

type StepState = 'done' | 'current' | 'upcoming';

export const StepList = styled.ol`
  list-style: none;
  margin: 0 0 ${({ theme }) => theme.spacing.space2}px;
  padding: 0 ${({ theme }) => theme.spacing.space1}px;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
`;

export const StepItem = styled.li<{ $state: StepState; $lineDone: boolean; $last: boolean }>`
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.space1}px;
  min-width: 0;

  /* Connector from this dot to the next step's dot. */
  &::after {
    content: '';
    display: ${({ $last }) => ($last ? 'none' : 'block')};
    position: absolute;
    top: ${({ theme }) => theme.spacing.space4 - 1}px;
    left: ${({ theme }) => theme.spacing.space8 + theme.spacing.space2}px;
    right: ${({ theme }) => theme.spacing.space2}px;
    height: 2px;
    border-radius: 1px;
    background: ${({ theme, $lineDone }) =>
      $lineDone ? theme.colors.primary : theme.colors.divider};
    transition: background 0.3s ease;
  }
`;

export const StepDot = styled.span<{ $state: StepState }>`
  width: ${({ theme }) => theme.spacing.space8}px;
  height: ${({ theme }) => theme.spacing.space8}px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  ${({ theme, $state }) =>
    $state === 'upcoming'
      ? css`
          background: ${theme.colors.surfaceVariant};
          color: ${theme.colors.onSurfaceVariant};
        `
      : css`
          background: ${theme.colors.primary};
          color: ${theme.colors.onPrimary};
          box-shadow: 0 0 0 4px ${withAlpha(theme.colors.primary, 0.14)};
        `}

  i {
    font-size: 12px;
    font-weight: 700;
  }
`;

export const StepLabel = styled.span<{ $state: StepState }>`
  margin-top: ${({ theme }) => theme.spacing.space1}px;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  color: ${({ theme, $state }) =>
    $state === 'current' ? theme.colors.primary : theme.colors.onSurface};
  ${ellipsis}
  max-width: 100%;

  ${({ theme }) => theme.media.md} {
    ${({ theme }) => textStyle(theme.typography.titleMedium)}
    color: ${({ theme, $state }) =>
      $state === 'current' ? theme.colors.primary : theme.colors.onSurface};
  }
`;

export const StepSubtitle = styled.span`
  display: none;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}

  ${({ theme }) => theme.media.sm} {
    display: block;
  }
`;

// ── Section cards ──────────────────────────────────────────────────────

export const SectionCard = styled.section`
  ${cardSurface}
  padding: ${({ theme }) => theme.spacing.space5}px;

  ${({ theme }) => theme.media.md} {
    padding: ${({ theme }) => theme.spacing.space6}px;
  }
`;

export const SectionHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  margin-bottom: ${({ theme }) => theme.spacing.space5}px;
`;

export const SectionIcon = styled.span`
  width: ${({ theme }) => theme.spacing.space12}px;
  height: ${({ theme }) => theme.spacing.space12}px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  color: ${({ theme }) => theme.storefront.headerBackground};

  i {
    font-size: 20px;
  }
`;

export const SectionTitle = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  font-size: 18px;
  font-weight: 600;
`;

export const SectionSubtitle = styled.p`
  margin: 2px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const OptionGrid = styled.div<{ $columns: 2 | 4 }>`
  display: grid;
  gap: ${({ theme }) => theme.spacing.space4}px;
  grid-template-columns: ${({ $columns }) =>
    $columns === 4 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)'};

  ${({ theme }) => theme.media.sm} {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  ${({ theme }) => theme.media.md} {
    grid-template-columns: repeat(${({ $columns }) => $columns}, minmax(0, 1fr));
  }
`;

/** A `<label>` around a visually-hidden radio input. */
export const OptionCard = styled.label<{ $selected: boolean }>`
  position: relative;
  display: flex;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  cursor: pointer;
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

  &:has(input:focus-visible) {
    outline: 2px solid ${({ theme }) => theme.colors.primary};
    outline-offset: 2px;
  }
`;

export const HiddenRadio = styled.input.attrs({ type: 'radio' })`
  position: absolute;
  opacity: 0;
  width: 1px;
  height: 1px;
  pointer-events: none;
`;

export const RadioMark = styled.span<{ $selected: boolean }>`
  flex-shrink: 0;
  width: ${({ theme }) => theme.layout.checkoutRadioSize}px;
  height: ${({ theme }) => theme.layout.checkoutRadioSize}px;
  margin-top: 1px;
  border-radius: 50%;
  border: 2px solid
    ${({ theme, $selected }) => ($selected ? theme.colors.primary : theme.colors.outlineVariant)};
  display: grid;
  place-items: center;
  transition: border-color 0.15s ease;

  &::after {
    content: '';
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primary};
    transform: scale(${({ $selected }) => ($selected ? 1 : 0)});
    transition: transform 0.15s ease;
  }
`;

// Address card

export const AddressBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space1}px;
`;

export const AddressTop = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space2}px;
  margin-bottom: ${({ theme }) => theme.spacing.space1}px;
`;

export const AddressType = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  ${ellipsis}
`;

export const DefaultChip = styled.span`
  flex-shrink: 0;
  padding: 2px ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.xs}px;
  background: ${({ theme }) => theme.colors.successContainer};
  ${({ theme }) => textStyle(theme.typography.labelMedium)}
  color: ${({ theme }) => theme.colors.success};
`;

export const AddressLine = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  overflow-wrap: anywhere;
`;

export const AddAddressButton = styled.button`
  ${resetButton}
  margin-top: ${({ theme }) => theme.spacing.space4}px;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border: 1px solid ${({ theme }) => theme.colors.divider};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.primary};
  transition: background 0.15s ease;

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.05)};
  }
`;

// Delivery card

export const DeliveryIcon = styled.span`
  flex-shrink: 0;
  color: ${({ theme }) => theme.storefront.headerBackground};

  i {
    font-size: 22px;
  }
`;

export const DeliveryText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
`;

export const OptionLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
`;

export const OptionSubtitle = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
`;

export const Fee = styled.span<{ $free: boolean }>`
  flex-shrink: 0;
  align-self: center;
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  color: ${({ theme, $free }) => ($free ? theme.colors.success : theme.colors.onSurface)};
`;

// Footer actions

export const Actions = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space6}px;
  padding-top: ${({ theme }) => theme.spacing.space5}px;
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
  display: flex;
  flex-direction: column-reverse;
  gap: ${({ theme }) => theme.spacing.space3}px;

  ${({ theme }) => theme.media.sm} {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
`;

export const BackLink = styled.button`
  ${resetButton}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  padding: 0 ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.primary};

  &:hover {
    background: ${({ theme }) => withAlpha(theme.colors.primary, 0.05)};
  }
`;

export const PrimaryButton = styled.button`
  ${resetButton}
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: ${({ theme }) => theme.components.button.height}px;
  padding: 0 ${({ theme }) => theme.spacing.space6}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.components.button.background};
  ${({ theme }) => textStyle(theme.typography.titleSmall)}
  font-size: 15px;
  color: ${({ theme }) => theme.components.button.foreground};
  box-shadow: 0 6px 16px ${({ theme }) => withAlpha(theme.colors.primary, 0.28)};
  transition:
    background 0.15s ease,
    transform 0.15s ease;

  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primaryPressed};
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    background: ${({ theme }) => theme.components.button.disabledBackground};
    color: ${({ theme }) => theme.components.button.disabledForeground};
    box-shadow: none;
  }

  i {
    transition: transform 0.15s ease;
  }

  &:hover:not(:disabled) i {
    transform: translateX(3px);
  }
`;

// ── Order summary ──────────────────────────────────────────────────────

export const Aside = styled.aside`
  min-width: 0;

  ${({ theme }) => theme.media.xl} {
    position: sticky;
    top: ${({ theme }) => theme.layout.checkoutHeaderHeight + theme.spacing.space6}px;
  }
`;

export const SummaryCard = styled.div`
  ${cardSurface}
  overflow: hidden;
`;

export const SummaryHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space4}px;
  padding: ${({ theme }) => theme.spacing.space6}px;
  background: ${({ theme }) => theme.colors.background};
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const SummaryTitle = styled.h2`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-size: 22px;
`;

export const SummaryBody = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.space6}px ${({ theme }) => theme.spacing.space6}px;
`;

export const SummaryItems = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0;
`;

export const SummaryItem = styled.li`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space5}px;
  padding: ${({ theme }) => theme.spacing.space4}px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const Thumb = styled.div`
  flex-shrink: 0;
  width: ${({ theme }) => theme.layout.checkoutThumbSize}px;
  height: ${({ theme }) => theme.layout.checkoutThumbSize}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  overflow: hidden;
  border: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const ItemText = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space2}px;
`;

export const ItemName = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}
  font-size: 15px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

export const ItemQty = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const ItemPrices = styled.div`
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing.space2}px;
`;

export const ItemTotal = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleMedium)}
  font-size: 17px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

export const ItemUnit = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
`;

export const Rows = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space6}px 0;
  border-bottom: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
`;

export const RowValue = styled.span<{ $tone?: 'success' }>`
  font-variant-numeric: tabular-nums;
  color: ${({ theme, $tone }) => ($tone === 'success' ? theme.colors.success : theme.colors.onSurface)};
  font-weight: ${({ $tone }) => ($tone === 'success' ? 700 : 400)};
`;

/** "Add ₹ X more for free shipping" under the shipping row (cart step). */
export const RowHint = styled.p`
  margin: -${({ theme }) => theme.spacing.space2}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.secondary};
`;

export const TotalRow = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space6}px 0;
`;

export const TotalLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.titleLarge)}
  font-weight: 700;
`;

export const TotalValue = styled.span`
  ${({ theme }) => textStyle(theme.typography.headlineSmall)}
  font-size: 26px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;

export const CouponBox = styled.div<{ $applied: boolean }>`
  border: 1px solid
    ${({ theme, $applied }) => ($applied ? theme.colors.success : theme.colors.divider)};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme, $applied }) =>
    $applied ? withAlpha(theme.colors.success, 0.06) : theme.colors.surface};
`;

export const CouponToggle = styled.button`
  ${resetButton}
  width: 100%;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurface};

  > i:first-child {
    font-size: 18px;
  }

  > span {
    flex: 1;
    text-align: left;
  }

  > i:last-child {
    font-size: 12px;
    transition: transform 0.2s ease;
  }

  &[aria-expanded='true'] > i:last-child {
    transform: rotate(90deg);
  }
`;

export const CouponForm = styled.form`
  display: flex;
  gap: ${({ theme }) => theme.spacing.space2}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px ${({ theme }) => theme.spacing.space4}px;
  animation: ${slideDown} 0.15s ease;
`;

export const CouponInput = styled.input`
  flex: 1;
  min-width: 0;
  height: ${({ theme }) => theme.spacing.space10}px;
  padding: 0 ${({ theme }) => theme.spacing.space3}px;
  border: 1px solid ${({ theme }) => theme.colors.outlineVariant};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}
  color: ${({ theme }) => theme.colors.onSurface};
  text-transform: uppercase;

  &::placeholder {
    text-transform: none;
    color: ${({ theme }) => theme.colors.outline};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.colors.error};
  }
`;

export const CouponApply = styled.button`
  ${resetButton}
  height: ${({ theme }) => theme.spacing.space10}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.primary};
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.onPrimary};
`;

export const CouponError = styled.p`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.space4}px ${({ theme }) => theme.spacing.space3}px;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.error};
`;

export const CouponApplied = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space3}px ${({ theme }) => theme.spacing.space4}px;
  ${({ theme }) => textStyle(theme.typography.bodyMedium)}

  > i {
    font-size: 18px;
    color: ${({ theme }) => theme.colors.success};
  }

  > span {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  strong {
    ${({ theme }) => textStyle(theme.typography.titleSmall)}
  }
`;

export const TextButton = styled.button`
  ${resetButton}
  padding: ${({ theme }) => theme.spacing.space1}px ${({ theme }) => theme.spacing.space2}px;
  border-radius: ${({ theme }) => theme.radius.xs}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  color: ${({ theme }) => theme.colors.primary};
`;

export const SecureBox = styled.div`
  margin-top: ${({ theme }) => theme.spacing.space6}px;
  padding: ${({ theme }) => theme.spacing.space5}px;
  border-radius: ${({ theme }) => theme.radius.md}px;
  background: ${({ theme }) => theme.colors.surfaceContainer};
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: ${({ theme }) => theme.spacing.space4}px;
  row-gap: ${({ theme }) => theme.spacing.space4}px;

  > i {
    font-size: 26px;
    color: ${({ theme }) => theme.colors.primary};
  }
`;

export const SecureTitle = styled.p`
  margin: 0;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
`;

export const SecureText = styled.p`
  margin: ${({ theme }) => theme.spacing.space1}px 0 0;
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
`;

export const Marks = styled.div`
  grid-column: 2;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.space6}px;
`;

const wordmark = css`
  font-family: ${({ theme }) => theme.fontFamily.display};
  font-style: italic;
  font-weight: 800;
  letter-spacing: -0.3px;
`;

export const Mark = styled.span<{ $brand: 'visa' | 'rupay' | 'upi' }>`
  ${wordmark}
  font-size: ${({ $brand }) => ($brand === 'visa' ? 20 : 16)}px;
  color: ${({ theme, $brand }) => theme.storefront[$brand]};
`;

export const Mastercard = styled.span`
  position: relative;
  width: 34px;
  height: 22px;

  &::before,
  &::after {
    content: '';
    position: absolute;
    top: 0;
    width: 22px;
    height: 22px;
    border-radius: 50%;
  }

  &::before {
    left: 0;
    background: ${({ theme }) => theme.storefront.mastercardRed};
  }

  &::after {
    right: 0;
    background: ${({ theme }) => theme.storefront.mastercardOrange};
    mix-blend-mode: multiply;
    opacity: 0.9;
  }
`;

// ── Add address dialog ─────────────────────────────────────────────────

export const Scrim = styled.div`
  position: fixed;
  inset: 0;
  z-index: 20;
  display: grid;
  place-items: center;
  padding: ${({ theme }) => theme.spacing.space4}px;
  background: ${({ theme }) => theme.colors.scrim};
  animation: ${fadeIn} 0.15s ease;
`;

export const CloseButton = styled.button`
  ${resetButton}
  width: ${({ theme }) => theme.spacing.space8}px;
  height: ${({ theme }) => theme.spacing.space8}px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  color: ${({ theme }) => theme.colors.onSurfaceVariant};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const Field = styled.label<{ $wide?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.space1}px;
  min-width: 0;

  ${({ theme }) => theme.media.sm} {
    grid-column: ${({ $wide }) => ($wide ? '1 / -1' : 'auto')};
  }
`;

export const FieldLabel = styled.span`
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
`;

export const Input = styled.input`
  height: ${({ theme }) => theme.components.minInteractiveDimension}px;
  padding: 0 ${({ theme }) => theme.components.input.paddingX}px;
  border: 1px solid ${({ theme }) => theme.components.input.border};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  background: ${({ theme }) => theme.colors.surface};
  ${({ theme }) => textStyle(theme.typography.bodyLarge)}

  &::placeholder {
    color: ${({ theme }) => theme.colors.outline};
  }

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.components.input.focusedBorder};
    box-shadow: 0 0 0 3px ${({ theme }) => withAlpha(theme.colors.primary, 0.12)};
  }

  &[aria-invalid='true'] {
    border-color: ${({ theme }) => theme.components.input.errorBorder};
  }
`;

export const FieldError = styled.span`
  ${({ theme }) => textStyle(theme.typography.bodySmall)}
  color: ${({ theme }) => theme.colors.error};
`;

export const TypeChips = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.space2}px;
`;

export const TypeChip = styled.button<{ $selected: boolean }>`
  ${resetButton}
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.space2}px;
  height: ${({ theme }) => theme.spacing.space10}px;
  padding: 0 ${({ theme }) => theme.spacing.space4}px;
  border-radius: ${({ theme }) => theme.radius.pill}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}
  ${({ theme, $selected }) =>
    $selected
      ? css`
          border: 1.5px solid ${theme.colors.primary};
          background: ${withAlpha(theme.colors.primary, 0.06)};
          color: ${theme.colors.primary};
        `
      : css`
          border: 1.5px solid ${theme.colors.divider};
          color: ${theme.colors.onSurfaceVariant};
        `}
`;

export const DialogActions = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.space3}px;
  padding: ${({ theme }) => theme.spacing.space4}px ${({ theme }) => theme.spacing.space6}px;
  background: ${({ theme }) => theme.components.dialog.background};
  border-top: 1px solid ${({ theme }) => theme.colors.divider};
`;

export const OutlinedButton = styled.button`
  ${resetButton}
  height: ${({ theme }) => theme.spacing.space12}px;
  padding: 0 ${({ theme }) => theme.spacing.space5}px;
  border: 1.5px solid ${({ theme }) => theme.components.button.outlinedBorder};
  border-radius: ${({ theme }) => theme.radius.sm}px;
  ${({ theme }) => textStyle(theme.typography.labelLarge)}

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceContainer};
  }
`;

export const SaveButton = styled(PrimaryButton)`
  height: ${({ theme }) => theme.spacing.space12}px;
  box-shadow: none;
`;
