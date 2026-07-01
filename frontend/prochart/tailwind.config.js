/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { green: '#00C853', red: '#FF1744', blue: '#2979FF', amber: '#FFA000' },
        surface: {
          DEFAULT: 'var(--surface-default)', card: 'var(--surface-card)', elevated: 'var(--surface-elevated)',
          border: 'var(--surface-border)', hover: 'var(--surface-hover)',
        },
        text: { primary: 'var(--text-primary)', secondary: 'var(--text-secondary)', muted: 'var(--text-muted)' },
      },
      fontFamily: { sans: ['Ravagh', 'AnjomanMax', 'Vazirmatn', 'sans-serif'], ravagh: ['Ravagh', 'sans-serif'], anjoman: ['AnjomanMax', 'sans-serif'], vazir: ['Vazirmatn', 'sans-serif'] },
      borderRadius: { xl: '0.875rem', '2xl': '1rem' },
    },
  },
  plugins: [],
};
