import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

const isPanel = process.env.VITE_BUILD_PANEL === 'true'
// Each HA panel is its own single-file bundle: main.js (dashboard) and plano.js (3D floor plan, PANEL=plano)
const panel = process.env.PANEL === 'plano'
  ? { entry: 'src/plano-main.ts', file: 'plano.js', tag: 'mi-plano' }
  : { entry: 'src/panel-main.ts', file: 'main.js', tag: 'mi-dashboard' }

export default defineConfig({
  plugins: [
    react(),
    ...(isPanel ? [cssInjectedByJs({
      // Keyed by panel: both bundles can load in the same page, and the dashboard's CSS has more
      // than the plan's (react-grid-layout)
      injectCode: (cssCode) => `
        (function(){
          try {
            (window.__miDashCss = window.__miDashCss || {})[${JSON.stringify(panel.tag)}] = ${cssCode};
            if (typeof document !== 'undefined') {
              var el = document.createElement('style');
              el.appendChild(document.createTextNode(${cssCode}));
              document.head.appendChild(el);
            }
          } catch(e) { console.error('css-inject', e); }
        })();
      `,
    })] : []),
  ],
  ...(isPanel && {
    define: {
      'process.env.NODE_ENV': '"production"',
      'process': '{ env: { NODE_ENV: "production" } }',
    },
    build: {
      // The second build (plano.js) must not wipe main.js
      emptyOutDir: panel.file === 'main.js',
      lib: {
        entry: panel.entry,
        name: 'MiDashboard',
        formats: ['es'],
        fileName: () => panel.file,
      },
      rollupOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
  }),
})
