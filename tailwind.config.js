/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#0B1730',
          900: '#0f1d4a',
          800: '#162257',
          700: '#1B2A6B',
          600: '#2336A0',
          100: '#eef0f8',
          50:  '#f5f6fc',
        },
        ucasal: {
          red:  '#C8102E',
          navy: '#1B2A6B',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontVariantNumeric: {
        tabular: 'tabular-nums',
      }
    },
  },
  plugins: [],
}
