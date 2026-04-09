/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['var(--font-display)'],
        body: ['var(--font-body)'],
        mono: ['var(--font-mono)'],
      },
      colors: {
        ink: {
          950: '#06060A',
          900: '#0C0C12',
          800: '#13131C',
          700: '#1C1C28',
          600: '#4a5568',  // was #252535 — now readable
        },
        gold: {
          300: '#F5D88A',
          400: '#ECC84A',
          500: '#D4A017',
          600: '#B8860B',
        },
        silver: {
          400: '#c8c8d8',  // was #A8A8B8 — bumped brighter
          500: '#a8a8c0',  // was #8888A0
          600: '#8888a8',  // was #666680
        },
        crimson: {
          400: '#E85D7A',
          500: '#D44060',
        }
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        }
      }
    },
  },
  plugins: [],
}


