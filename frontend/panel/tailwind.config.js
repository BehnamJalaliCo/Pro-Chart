/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#00C853',
          red: '#FF1744',
          blue: '#2979FF',
        },
        surface: {
          DEFAULT: '#0f1117',
          card: '#161923',
          elevated: '#1c2030',
          border: '#2a2e3d',
          hover: '#222738',
        },
        text: {
          primary: '#e4e6ed',
          secondary: '#9499ae',
          muted: '#636882',
        },
      },
      fontFamily: {
        vazir: ['Vazirmatn', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1rem',
      },
    },
  },
  plugins: [],
};
