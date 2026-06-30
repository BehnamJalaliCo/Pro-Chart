/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        vazir: ['Vazirmatn', 'sans-serif'],
      },
      colors: {
        bullish: {
          DEFAULT: '#00C853',
          light: '#69F0AE',
          dark: '#00A844',
        },
        bearish: {
          DEFAULT: '#FF1744',
          light: '#FF616F',
          dark: '#C4001D',
        },
        accent: {
          DEFAULT: '#2979FF',
          light: '#75A7FF',
          dark: '#004ECB',
        },
        // پالتِ سطح‌ها از طریقِ CSS variable کنترل می‌شود تا حالتِ روز/شب
        // (با تمام واریانت‌های شفافیت مثل bg-dark-900/60) خودکار جابه‌جا شود.
        dark: {
          50: 'rgb(var(--d-50) / <alpha-value>)',
          100: 'rgb(var(--d-100) / <alpha-value>)',
          200: 'rgb(var(--d-200) / <alpha-value>)',
          300: 'rgb(var(--d-300) / <alpha-value>)',
          400: 'rgb(var(--d-400) / <alpha-value>)',
          500: 'rgb(var(--d-500) / <alpha-value>)',
          600: 'rgb(var(--d-600) / <alpha-value>)',
          700: 'rgb(var(--d-700) / <alpha-value>)',
          800: 'rgb(var(--d-800) / <alpha-value>)',
          900: 'rgb(var(--d-900) / <alpha-value>)',
          950: 'rgb(var(--d-950) / <alpha-value>)',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(41, 121, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(41, 121, 255, 0.6)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'grid-pattern': 'linear-gradient(rgba(41, 121, 255, 0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(41, 121, 255, 0.03) 1px, transparent 1px)',
      },
      backgroundSize: {
        'grid': '50px 50px',
      },
    },
  },
  plugins: [],
};
