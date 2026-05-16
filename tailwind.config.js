/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: {
          primary: 'var(--color-bg-primary)',
          secondary: 'var(--color-bg-secondary)',
          tertiary: 'var(--color-bg-tertiary)',
        },
        text: {
          primary: 'var(--color-text-primary)',
          secondary: 'var(--color-text-secondary)',
        },
        border: {
          main: 'var(--color-border)',
        },
        accent: {
          blue: '#3b82f6',
          green: '#10b981',
          yellow: '#eab308',
          orange: '#f97316',
          red: '#ef4444',
          purple: '#a855f7',
        },
      },
    },
  },
  plugins: [],
}
