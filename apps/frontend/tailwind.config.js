/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        whatsapp: {
          50: '#eefdf3',
          100: '#d8fae3',
          200: '#b4f3ca',
          300: '#7de7a6',
          400: '#40d47c',
          500: '#25d366',
          600: '#17b550',
          700: '#128c42',
          800: '#106e37',
          900: '#0e5a30',
        },
        ink: {
          50: '#f7f8f9',
          100: '#eef0f2',
          200: '#d9dde1',
          300: '#b6bcc4',
          400: '#8e96a1',
          500: '#6b7480',
          600: '#525a66',
          700: '#414650',
          800: '#262b33',
          900: '#171b21',
          950: '#0f1216',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.05)',
        pop: '0 4px 16px -2px rgb(0 0 0 / 0.10), 0 2px 6px -2px rgb(0 0 0 / 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.18s ease-out',
        'slide-up': 'slideUp 0.22s ease-out',
        'slide-in-right': 'slideInRight 0.22s ease-out',
      },
      keyframes: {
        fadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideInRight: { from: { opacity: 0, transform: 'translateX(16px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
      },
    },
  },
  plugins: [],
};