/**
 * BuildMate 24x7 theme — mirrors Flutter `lib/core/theme/*`
 * (AppColors, AppSpacing, AppRadius, AppElevation, AppTypography, AppTheme).
 *
 * Single source of truth: components must read values from `theme`,
 * never hardcode colors, sizes or fonts.
 */

// ── AppColors ───────────────────────────────────────────────────────────
const colors = {
  // Primary (Brand Blue)
  primary: '#1A56DB',
  primaryContainer: '#D6E4FF',
  onPrimary: '#FFFFFF',
  onPrimaryContainer: '#001B4D',
  primaryPressed: '#1246BE',
  primarySidebarSelected: '#BFD3F7',

  // Secondary (Amber Accent)
  secondary: '#D97706',
  secondaryContainer: '#FFECD0',
  onSecondary: '#FFFFFF',
  onSecondaryContainer: '#3D2000',

  // Tertiary (Emerald)
  tertiary: '#059669',
  tertiaryContainer: '#CCFCE7',
  onTertiary: '#FFFFFF',
  onTertiaryContainer: '#002B1A',

  // Accent (Catalog CTA Green)
  accentGreen: '#5FAF2E',
  accentGreenContainer: '#D8EEBF',
  onAccentGreenContainer: '#3D7A1A',

  // Semantic / status
  error: '#DC2626',
  errorContainer: '#FFE0E0',
  onError: '#FFFFFF',
  success: '#16A34A',
  successContainer: '#DCFCE7',
  warning: '#CA8A04',
  warningContainer: '#FEF9C3',
  info: '#0369A1',
  infoContainer: '#E0F2FE',

  // Surface / neutrals
  background: '#F8FAFF',
  surface: '#FFFFFF',
  surfaceVariant: '#E8EDF8',
  surfaceContainer: '#F1F3FA',
  onBackground: '#181C24',
  onSurface: '#181C24',
  onSurfaceVariant: '#44484F',
  outline: '#74777F',
  outlineVariant: '#C4C7CF',
  divider: '#E2E5EC',
  disabled: '#BBBEC7',
  disabledContainer: '#F2F3F7',
  shadow: 'rgba(0, 0, 0, 0.102)', // 0x1A000000
  scrim: 'rgba(0, 0, 0, 0.54)', // Colors.black54
  inversePrimary: '#6B9FFF',

  // Flutter `Colors.white` / `Colors.black` (used with alpha in shadows)
  white: '#FFFFFF',
  black: '#000000',
} as const;

// ── LoginFlowColors (auth/presentation/widgets/login_flow_widgets.dart) ─
const loginFlowAccent = '#2F5FE0';

const loginFlow = {
  accent: loginFlowAccent,
  accentDeep: '#1A3FB0',
  accentMuted: '#DCE6FF',
  link: loginFlowAccent,
  fieldBorder: '#D1D5DB',
  disabledButton: '#E5E7EB',
  disabledText: '#9CA3AF',
  accentGradient: ['#4C7BFF', loginFlowAccent],
  backdropGradient: ['#EEF3FF', '#FFFFFF'],
} as const;

// ── Brand mark (public/assets/images/branding/buildmate_logo.png) ──
// Web-only: colours sampled from the logo's slate-blue → teal → green
// sweep, darkened so white text on them stays readable. Used by the
// desktop brand panel; mobile/Flutter-mirrored screens don't use these.
const brand = {
  panelGradient: ['#2C4A8F', '#1A7A9E', '#2F7F55'],
  highlight: '#A6EBD9',
} as const;

// ── Storefront chrome (web-only checkout header + payment marks) ──────
const storefront = {
  headerBackground: '#1B2A47',
  headerForeground: '#FFFFFF',
  headerMuted: '#C9D3E6',
  brandAccent: '#F59E0B',
  // Card network / UPI wordmarks in the "payment is secure" box.
  visa: '#1A1F71',
  mastercardRed: '#EB001B',
  mastercardOrange: '#F79E1B',
  rupay: '#1E4AA8',
  upi: '#6B7280',
} as const;

// ── My Rewards points card (my_rewards_screen.dart `_RewardPointsCard`) ─
const rewards = {
  cardGradient: ['#0B1F4D', '#1A3F9E', colors.primary],
  gold: '#FBBF24',
  earnedGreen: '#4ADE80',
} as const;

// ── AppSpacing (8-point scale, px) ─────────────────────────────────────
const spacing = {
  space1: 4,
  space2: 8,
  space3: 12,
  space4: 16,
  space5: 20,
  space6: 24,
  space8: 32,
  space10: 40,
  space12: 48,
  space14: 56,
  space16: 64,

  // Shared control heights
  buttonHeight: 52,
  inputHeight: 56,
  otpBoxHeight: 56,
} as const;

// ── AppRadius (px) ──────────────────────────────────────────────────────
const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 9999,
} as const;

// ── AppElevation → CSS box-shadow (Material 3 levels, color = shadow) ──
const elevation = {
  level0: 'none',
  level1: `0 1px 2px ${colors.shadow}, 0 1px 3px 1px ${colors.shadow}`,
  level2: `0 1px 2px ${colors.shadow}, 0 2px 6px 2px ${colors.shadow}`,
  level3: `0 1px 3px ${colors.shadow}, 0 4px 8px 3px ${colors.shadow}`,
  level4: `0 2px 3px ${colors.shadow}, 0 6px 10px 4px ${colors.shadow}`,
  level5: `0 4px 4px ${colors.shadow}, 0 8px 12px 6px ${colors.shadow}`,
} as const;

// ── AppTypography ───────────────────────────────────────────────────────
// DM Sans for display/headline/title/label; Inter for body;
// JetBrains Mono for labelSmall / mono labels (loaded in index.html).
const fontFamily = {
  display: "'DM Sans', sans-serif",
  body: "'Inter', sans-serif",
  mono: "'JetBrains Mono', monospace",
} as const;

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  color: string;
}

const text = (
  family: string,
  fontSize: number,
  fontWeight: number,
  lineHeightPx: number,
  letterSpacing: number,
  color: string,
): TextStyle => ({
  fontFamily: family,
  fontSize,
  fontWeight,
  lineHeight: lineHeightPx / fontSize,
  letterSpacing,
  color,
});

const ink = colors.onSurface;
const muted = colors.onSurfaceVariant;

const typography = {
  displayLarge: text(fontFamily.display, 57, 300, 64, -0.25, ink),
  displayMedium: text(fontFamily.display, 45, 400, 52, 0, ink),
  displaySmall: text(fontFamily.display, 36, 400, 44, 0, ink),
  headlineLarge: text(fontFamily.display, 32, 600, 40, 0, ink),
  headlineMedium: text(fontFamily.display, 28, 600, 36, 0, ink),
  headlineSmall: text(fontFamily.display, 24, 600, 32, 0, ink),
  titleLarge: text(fontFamily.display, 22, 500, 28, 0, ink),
  titleMedium: text(fontFamily.display, 16, 600, 24, 0.15, ink),
  titleSmall: text(fontFamily.display, 14, 600, 20, 0.1, ink),
  bodyLarge: text(fontFamily.body, 16, 400, 24, 0.5, ink),
  bodyMedium: text(fontFamily.body, 14, 400, 20, 0.25, muted),
  bodySmall: text(fontFamily.body, 12, 400, 16, 0.4, muted),
  labelLarge: text(fontFamily.display, 14, 500, 20, 0.1, ink),
  labelMedium: text(fontFamily.display, 12, 500, 16, 0.5, muted),
  labelSmall: text(fontFamily.mono, 11, 500, 16, 0.5, colors.outline),
  // Design-system extensions (AppTextStyles)
  caption: text(fontFamily.body, 11, 400, 16, 0.4, muted),
  labelSmallMono: text(fontFamily.mono, 11, 500, 16, 0.5, colors.outline),
} as const;

// ── Component themes (from AppTheme.light()) ────────────────────────────
const components = {
  scaffold: { background: colors.background },
  progressIndicator: {
    color: colors.primary,
    trackColor: colors.primaryContainer,
  },
  input: {
    fill: colors.surfaceContainer,
    border: colors.outlineVariant,
    focusedBorder: colors.primary,
    errorBorder: colors.error,
    borderWidth: 1.5,
    radius: radius.md,
    paddingX: spacing.space4,
    paddingY: spacing.space4,
  },
  button: {
    background: colors.primary,
    foreground: colors.onPrimary,
    disabledBackground: colors.disabledContainer,
    disabledForeground: colors.disabled,
    height: spacing.buttonHeight,
    radius: radius.md,
    outlinedBorder: colors.outlineVariant,
    outlinedBorderWidth: 1.5,
  },
  checkbox: {
    fill: colors.primary,
    check: colors.onPrimary,
    border: colors.outlineVariant,
    borderWidth: 2,
    radius: radius.xs,
  },
  card: { background: colors.surface, radius: radius.lg, shadow: elevation.level1 },
  dialog: { background: colors.surface, radius: radius.xl, shadow: elevation.level4 },
  snackBar: {
    background: colors.onSurface,
    foreground: colors.surface,
    radius: radius.md,
    shadow: elevation.level3,
    // Flutter SnackBar defaults (floating behavior, Material 3)
    durationMs: 4000,
    marginX: 15,
    marginBottom: 10,
    paddingX: spacing.space4,
    paddingY: 14,
  },
  divider: { color: colors.divider, thickness: 1 },
  icon: { color: colors.onSurfaceVariant },
  // Flutter kMinInteractiveDimension — min height of a non-dense InputDecorator
  minInteractiveDimension: 48,
} as const;

// ── Motion (Flutter Curves / durations) ────────────────────────────────
const motion = {
  easeOutCubic: 'cubic-bezier(0.215, 0.61, 0.355, 1)',
} as const;

// ── Web adaptation (not in Flutter — layout only, no visual change) ────
const breakpoints = {
  sm: 600,
  md: 900,
  lg: 1200,
  xl: 1440,
} as const;

const layout = {
  // Mobile screens are rendered in a centered column on wider viewports.
  authMaxWidth: 480,
  // Web (≥ md): wider card for list/grid screens, map sidebar, brand panel copy.
  authWideMaxWidth: 680,
  authSidebarWidth: 440,
  brandPanelMaxWidth: 520,

  // Pipes & Fittings catalog (Flutter sidebar is a fixed 108px column).
  pipeSidebarWidth: 108,
  // Web (≥ md): full-height sidebar rail, toolbar height, grid card min width.
  pipeSidebarWideWidth: 264,
  catalogToolbarHeight: 76,
  catalogCardMinWidth: 220,
  // Web (≥ md): full-bleed configurator — image pane left, details pane right.
  pipeConfiguratorDetailsMinWidth: 420,
  pipeConfiguratorDetailsMaxWidth: 560,

  // Cart (checkout step 1): item thumb, qty stepper, line-total column (≥ md).
  cartThumbSize: 56,
  cartThumbSizeWide: 64,
  cartStepperButtonSize: 32,
  cartLineTotalWidth: 110,

  // Checkout (Address step, web): header bar, content cap, summary column, thumbs.
  checkoutHeaderHeight: 76,
  checkoutSearchMaxWidth: 720,
  checkoutSummaryWidth: 500,
  checkoutThumbSize: 64,
  checkoutRadioSize: 20,
  checkoutDialogWidth: 720,
  checkoutMapHeight: 200,
  checkoutPaymentFieldsWidth: 480,
  checkoutContinueButtonWidth: 320,

  // Main shell (Home): Flutter bottom NavigationBar height; web side menu.
  bottomNavHeight: 64,
  bottomNavIndicatorWidth: 64,
  shellSidebarWidth: 280,
  shellSidebarThumbSize: 28,
  // Home: web top bar + compact square category tiles (image box + label).
  homeTopBarHeight: 80,
  homeLocationMaxWidth: 560,
  homeCategoryTileMinWidth: 132,
  fabSize: 56,

  // My Rewards (web ≥ md): content cap + sticky points-card column.
  rewardsMaxWidth: 1200,
  rewardsSummaryWidth: 420,

  // My Profile: content cap, avatar, section icon tile, mobile label column.
  profileMaxWidth: 1200,
  profileAvatarSize: 76,
  profileAvatarSizeWide: 64,
  profileSectionIconSize: 40,
  profileLabelWidth: 128,
  profileBannerMaxWidth: 460,
} as const;

const media = {
  sm: `@media (min-width: ${breakpoints.sm}px)`,
  md: `@media (min-width: ${breakpoints.md}px)`,
  lg: `@media (min-width: ${breakpoints.lg}px)`,
  xl: `@media (min-width: ${breakpoints.xl}px)`,
} as const;

export const theme = {
  colors,
  loginFlow,
  brand,
  storefront,
  rewards,
  spacing,
  radius,
  elevation,
  fontFamily,
  typography,
  components,
  motion,
  breakpoints,
  layout,
  media,
} as const;

export type AppTheme = typeof theme;

export default theme;
