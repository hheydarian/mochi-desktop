/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        glass: {
          light: 'rgba(255, 255, 255, 0.15)',
          medium: 'rgba(255, 255, 255, 0.25)',
          dark: 'rgba(15, 23, 42, 0.45)',
          card: 'rgba(255, 255, 255, 0.08)',
          'card-hover': 'rgba(255, 255, 255, 0.14)',
          border: 'rgba(255, 255, 255, 0.2)',
          'border-light': 'rgba(255, 255, 255, 0.35)',
        },
        mochi: {
          pink: '#FF7AC6',
          purple: '#A78BFA',
          sky: '#38BDF8',
          amber: '#FBBF24',
          emerald: '#34D399',
        },
      },
      backdropBlur: {
        xs: '2px',
        glass: '16px',
        heavy: '24px',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(0, 0, 0, 0.25)',
        'glass-glow': '0 0 25px 2px rgba(255, 255, 255, 0.18)',
        'glass-inset': 'inset 0 1px 1px 0 rgba(255, 255, 255, 0.35)',
      },
      fontFamily: {
        sans: [
          'Vazirmatn',
          'Segoe UI',
          'Tahoma',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Roboto',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
