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
          primary: '#0a0a0a',
          secondary: '#171717',
          tertiary: '#262626',
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
