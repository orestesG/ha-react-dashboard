import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isPanel = process.env.VITE_BUILD_PANEL === 'true'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  ...(isPanel && {
    build: {
      rollupOptions: {
        output: {
          entryFileNames: 'main.js',
          assetFileNames: 'main.[ext]',
          inlineDynamicImports: true,
        },
      },
    },
  }),
})
