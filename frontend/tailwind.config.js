/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        spooky: {
          orange: '#ff7700',
          orangeDark: '#e65c00',
          purple: '#6b21a8',
          purpleDark: '#4c1d95',
          slime: '#10b981',
          blood: '#dc2626',
          night: '#0a0714',
          grave: '#15102a',
          card: '#1e1738',
        },
        primary: {
          50: '#fff7ed',
          100: '#ffedd5',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
      },
      padding: {
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
      }
    },
  },
  plugins: [],
}
