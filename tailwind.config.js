/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14171F',
          soft: '#3A3F4B',
        },
        paper: {
          DEFAULT: '#FAFAF9',
          surface: '#FFFFFF',
          line: '#E7E7E4',
        },
        night: {
          DEFAULT: '#0B0D12',
          surface: '#14171F',
          line: '#242835',
        },
        route: {
          DEFAULT: '#3D5AFE',
          soft: '#EEF1FF',
          dark: '#5B7CFA',
          softDark: '#1B2036',
        },
        // Header estilo tienda: UN solo lugar para cambiar el azul (variables
        // CSS en index.css, con versión oscura). `cta` = botón amarillo.
        header: {
          DEFAULT: 'rgb(var(--tr-header) / <alpha-value>)',
          band: 'rgb(var(--tr-header-band) / <alpha-value>)',
        },
        cta: {
          DEFAULT: '#FFE000',
          dark: '#E6C800',
        },
        signal: {
          green: '#12A150',
          amber: '#C77D19',
          red: '#D64545',
        },
      },
      fontFamily: {
        display: ['"Sora"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(20,23,31,0.04), 0 8px 24px -12px rgba(20,23,31,0.12)',
        'card-dark': '0 1px 2px rgba(0,0,0,0.2), 0 8px 24px -12px rgba(0,0,0,0.5)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-up': { '0%': { opacity: 0, transform: 'translateY(8px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        'slide-in-right': { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        'slide-out-right': { '0%': { transform: 'translateX(0)' }, '100%': { transform: 'translateX(100%)' } },
        'toast-in': { '0%': { opacity: 0, transform: 'translateY(-8px) scale(0.98)' }, '100%': { opacity: 1, transform: 'translateY(0) scale(1)' } },
        dash: { '0%': { strokeDashoffset: 24 }, '100%': { strokeDashoffset: 0 } },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease both',
        'slide-in-right': 'slide-in-right 0.3s cubic-bezier(0.16,1,0.3,1) both',
        'slide-out-right': 'slide-out-right 0.25s cubic-bezier(0.4,0,1,1) both',
        'toast-in': 'toast-in 0.25s ease both',
        dash: 'dash 1.2s linear infinite',
      },
    },
  },
  plugins: [],
}