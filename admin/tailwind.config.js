/** @type {import('tailwindcss').Config} */
// Colours and type of the BuildMate design kit (same tokens as the website and app): brand blue #1A56DB,
// navy #1B2A47, DM Sans headings, Inter body. Names are kept so existing class names still work.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#181C24', soft: '#44484F', faint: '#74777F' },
        pipe: { 50: '#EEF3FF', 100: '#D6E4FF', 500: '#1A56DB', 600: '#1A56DB', 700: '#1246BE', 900: '#1B2A47' },
        leaf: { 50: '#ECFDF3', 100: '#DCFCE7', 500: '#16A34A', 600: '#16A34A', 700: '#15803D' },
        tape: { 100: '#FEF3C7', 400: '#FBBF24', 500: '#D97706', 700: '#92400E' },
        brick: { 50: '#FFE0E0', 500: '#DC2626', 700: '#B91C1C' },
        line: '#E2E5EC',
        paper: '#F8FAFF',
        navy: '#1B2A47',
      },
      fontFamily: {
        sans: ['Inter', '"Noto Sans Devanagari"', 'system-ui', 'sans-serif'],
        display: ['"DM Sans"', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: { '2xs': ['11px', '14px'] },
    },
  },
  plugins: [],
}
