import adapter from '@sveltejs/adapter-node'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: vitePreprocess(),
  compilerOptions: { runes: true },
  kit: {
    adapter: adapter(),
    alias: { $msg: 'src/lib/paraglide/messages.js' },
    serviceWorker: { register: false },
    /*
     * The app's own content policy.
     *
     * Written here rather than at the edge because SvelteKit knows which scripts it emits and can
     * hash them; a hand-written header at Caddy cannot, and would either break hydration or have to
     * allow `unsafe-inline`, which is the same as having no script policy at all.
     *
     * `frame-ancestors` is deliberately absent: it is ignored in a `<meta>` tag, so it is set as a
     * real header in `selfhost/Caddyfile` alongside `X-Frame-Options`.
     *
     * The Google Fonts origins are the two `app.html` already preconnects to. Nothing else is
     * allowed to serve a script, which is what makes "an installed module can only come from this
     * instance" enforceable rather than merely intended.
     */
    csp: {
      mode: 'auto',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self', 'unsafe-inline', 'https://fonts.googleapis.com'],
        'font-src': ['self', 'data:', 'https://fonts.gstatic.com'],
        'img-src': ['self', 'data:', 'blob:', 'https:'],
        'connect-src': ['self', 'ws:', 'wss:'],
        'worker-src': ['self', 'blob:'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self'],
      },
    },
  },
}
