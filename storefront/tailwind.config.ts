import type { Config } from 'tailwindcss'

/**
 * Tailwind for the pages not yet rebuilt in the design kit (orders, addresses, policies…). The colour names are the
 * old ones so those pages keep working, but the values are the kit's (ui/theme/theme.ts): brand blue #1A56DB,
 * navy header #1B2A47, Inter body / DM Sans headings, flat white cards.
 */
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#181C24', soft: '#44484F', faint: '#74777F' },
        pipe: { 50: '#EEF3FF', 100: '#D6E4FF', 200: '#BFD3F7', 500: '#1A56DB', 600: '#1A56DB', 700: '#1246BE', 900: '#1B2A47' },
        leaf: { 50: '#ECFDF3', 100: '#DCFCE7', 500: '#16A34A', 600: '#16A34A', 700: '#15803D' },
        tape: { 100: '#FEF3C7', 400: '#FBBF24', 500: '#D97706', 700: '#92400E' },
        brick: { 50: '#FFE0E0', 500: '#DC2626', 700: '#B91C1C' },
        line: '#E2E5EC',
        paper: '#F8FAFF',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: { '2xs': ['11px', '14px'] },
    },
  },
  plugins: [],
} satisfies Config
