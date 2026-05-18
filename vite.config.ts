import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJs from 'vite-plugin-css-injected-by-js'

const isPanel = process.env.VITE_BUILD_PANEL === 'true'

export default defineConfig({
  plugins: [
    react(),
    ...(isPanel ? [cssInjectedByJs({
      injectCode: (cssCode) => `
        (function(){
          try {
            window.__dashCss = ${cssCode};
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
