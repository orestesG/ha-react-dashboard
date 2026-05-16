import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

const isPanel = process.env.VITE_BUILD_PANEL === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(isPanel ? [cssInjectedByJs()] : []),
  ],
  ...(isPanel && {
    build: {
      lib: {
        entry: 'src/panel-main.ts',
        name: 'MiDashboard',
        formats: ['es'],
        fileName: () => 'main.js',
      },
      rollupOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
  }),
})
