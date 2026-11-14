import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'
import { execFileSync } from 'node:child_process'

// Vendor libraries in their own chunks: they change rarely, so an app update re-downloads (and re-precaches)
// only the small app chunks. Charts stay out of the first load: only the lazy Record screen imports them.
const vendor = (names: string) => new RegExp(`[\\\\/]node_modules[\\\\/](${names})[\\\\/]`)

// content/ and contracts/ live at the repo root, outside app/.
export default defineConfig({
  // Public deployments use the reviewed recording artifact. Local live/auto demos remain
  // available; a reachable old model service is not evidence that this corpus was reviewed.
  define: process.env.CF_PAGES === '1' ? { 'import.meta.env.VITE_ASSISTANT_MODE': JSON.stringify('cached') } : {},
  plugins: [
    react(),
    {
      name: 'vitalents-build-info',
      generateBundle() {
        const commit = process.env.CF_PAGES_COMMIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
        this.emitFile({ type: 'asset', fileName: 'build-info.json', source: JSON.stringify({ commit, built_at_utc: new Date().toISOString() }) })
      },
    },
    // Offline after one visit (NFR-01, FR-SY-01): the service worker precaches the built shell, fonts and
    // the scenario fixtures. It only ever answers same-origin GET requests; the local assistant
    // (http://localhost:8008) is cross-origin and never matched, so it is never cached.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt', // a new version waits until the user chooses "Reload" (src/pwa/UpdateToast.tsx)
      injectRegister: false, // registered from src/pwa/register.ts
      manifest: false, // hand-written: public/manifest.webmanifest, linked from index.html
      workbox: {
        globPatterns: [
          '**/*.{js,css,html,woff2,svg,png,webmanifest}',
          'data/fixtures/*.json',
          'data/cached_answers.json',
          'data/proof.json',
          'data/research/*.json',
        ],
        globIgnores: ['**/*-dev.html'],
        // Scenario bundles are up to ~0.5 MB each; generated ones may grow.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/data\//, /^\/build-info\.json$/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Other generated data files (same origin only) stay readable offline once seen.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/data/') && url.pathname.endsWith('.json'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'vitalents-data' },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { fs: { allow: ['..'] } },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: vendor('react|react-dom|scheduler|react-router|react-router-dom|cookie|set-cookie-parser') },
            { name: 'vendor-dexie', test: vendor('dexie|dexie-react-hooks') },
            {
              name: 'vendor-charts',
              test: vendor('recharts|d3-[a-z-]+|victory-vendor|internmap|es-toolkit|@reduxjs|immer|redux|redux-thunk|react-redux|reselect|decimal\\.js-light|eventemitter3|tiny-invariant|clsx|use-sync-external-store'),
            },
          ],
        },
      },
    },
  },
})
