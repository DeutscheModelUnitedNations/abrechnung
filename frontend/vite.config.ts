import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { type Plugin, searchForWorkspaceRoot } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Browsers that once ran the app in development mode keep the dev service worker (/dev-sw.js),
// which serves its cached dev index.html (referencing /src/main.ts etc.) and leaves the production app blank.
// Ship a self-destroying replacement so the browser's update check removes it.
const devSwKillSwitch: Plugin = {
  name: 'dev-sw-kill-switch',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'dev-sw.js',
      source: `self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister()
      await Promise.all((await caches.keys()).map((key) => caches.delete(key)))
      const clients = await self.clients.matchAll({ type: 'window' })
      await Promise.all(clients.map((client) => client.navigate(client.url)))
    })()
  )
})
`
    })
  }
}

// https://vitejs.dev/config/
export default {
  plugins: [
    vue(),
    devSwKillSwitch,
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'injectManifest',
      srcDir: '',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: false,
      devOptions: { enabled: true, navigateFallback: 'index.html', type: 'module' },
      injectManifest: {
        maximumFileSizeToCacheInBytes: 4000000,
        // only precache the main app.js file and not all JS files
        manifestTransforms: [(m) => ({ manifest: m.filter(({ url }) => !url.endsWith('.js') || url.startsWith('app-')) })]
      }
    })
  ],
  server: {
    port: 80,
    strictPort: true,
    host: '0.0.0.0',
    allowedHosts: [process.env.VITE_FRONTEND_URL?.replace(/^https?:\/\//, '')],
    fs: { allow: [searchForWorkspaceRoot(process.cwd()), '../common'] }
  },
  preview: { port: 80, host: '0.0.0.0' },
  resolve: { alias: { '@': resolve(__dirname, './src') } },
  build: { rollupOptions: { output: { entryFileNames: 'app-[hash].js' } } }
}
