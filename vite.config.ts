/// <reference types="vitest/config" />
import { paraglideVitePlugin } from '@inlang/paraglide-js'
import { sveltekit } from '@sveltejs/kit/vite'
import tailwindcss from '@tailwindcss/vite'
import { SvelteKitPWA } from '@vite-pwa/sveltekit'
import { defineConfig, type PluginOption } from 'vite'
import type { ManifestOptions } from 'vite-plugin-pwa'

/**
 * The web app manifest — what the browser reads to install Kern and to pick a home-screen icon.
 *
 * It is a `const` rather than an inline option so `devManifest` below can serve the same object:
 * `src/app.html` links it unconditionally, and vite-plugin-pwa only writes the file in a build.
 *
 * `icons` points at `static/icons/`, which `pnpm icons` generates. `maskable` variants are the
 * full-bleed ones — Android crops a maskable icon to whatever shape the launcher uses, and a
 * rounded icon under that crop shows pale corners.
 */
const manifest: Partial<ManifestOptions> = {
  name: 'Kern',
  short_name: 'Kern',
  description: 'Open-source all-in-one work platform',
  id: '/',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  display_override: ['window-controls-overlay', 'standalone'],
  background_color: '#F0EEE7',
  theme_color: '#F0EEE7',
  orientation: 'any',
  categories: ['productivity', 'business'],
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
  shortcuts: [
    { name: 'Inbox', url: '/?goto=inbox', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
  ],
}

/**
 * Serves the manifest in `pnpm dev`.
 *
 * `devOptions` stays off so no service worker caches the app while you are editing it, and with it
 * off the plugin emits nothing — so the link in `app.html` would 404 all through development, which
 * is both console noise and no way to test the install prompt.
 */
const devManifest: PluginOption = {
  name: 'kern:dev-manifest',
  apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/manifest.webmanifest', (_request, response) => {
      response.setHeader('content-type', 'application/manifest+json')
      response.end(JSON.stringify(manifest))
    })
  },
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/lib/paraglide',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
      cookieName: 'kern_locale',
    }),
    sveltekit(),
    SvelteKitPWA({
      registerType: 'prompt',
      injectRegister: false,
      pwaAssets: { disabled: true },
      manifest,
      workbox: {
        globPatterns: ['client/**/*.{js,css,html,svg,png,woff2,webmanifest}'],
        navigateFallback: '/',
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/collab/, /^\/s3\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'kern-api',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === 'image',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kern-images',
              expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
          {
            urlPattern: ({ url }) =>
              url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'kern-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
    devManifest,
  ],
  optimizeDeps: {
    /*
     * The module clients ship Svelte source, not built JavaScript (`exports["./client"]` points at
     * `src/client/index.ts`), which is what lets `$state` in a module store stay reactive inside the
     * app. The dependency pre-bundler cannot read it: it hands `store.svelte.ts` to Svelte's module
     * compiler, which does not strip TypeScript, and the whole optimise step dies on the first
     * `import type`. Excluding them sends the files through the app's own pipeline instead.
     */
    exclude: [
      '@kernhq/module-billing',
      '@kernhq/module-chat',
      '@kernhq/module-mail',
      '@kernhq/module-tracker',
    ],
  },
  server: {
    port: 5173,
    /*
     * Only the tracker is hosted by core; chat, mail and collab are their own services, and each
     * serves its own `/api/<id>` prefix on its own port. Caddy routes them in production
     * (`selfhost/Caddyfile`) and nothing routed them in development, so every chat and mail request
     * went to core and came back 404 — with `PUBLIC_API_MOCK` unset being the default, which is a
     * dev environment that silently only half works.
     *
     * Longest prefix first: Vite matches in insertion order, so a bare `/api` above these would
     * swallow both.
     */
    proxy: {
      '/api/chat': { target: 'http://localhost:4100', changeOrigin: false },
      '/api/mail': { target: 'http://localhost:4200', changeOrigin: false },
      '/api': { target: 'http://localhost:4000', changeOrigin: false },
      '/ws': { target: 'ws://localhost:4100', ws: true },
      '/collab': { target: 'ws://localhost:4300', ws: true },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
