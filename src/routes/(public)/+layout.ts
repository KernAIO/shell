/**
 * The one part of Kern that is a web page rather than an application.
 *
 * The app is a client-rendered SPA — `src/routes/+layout.ts` turns SSR off for the whole of it,
 * because every screen behind it talks to core with the reader's session cookie and there is
 * nothing for a server to render before that exists. A published site is the opposite in every
 * respect: nobody is signed in, the content is already rendered HTML sitting on a pinned version,
 * and the readers who matter most are a search crawler and somebody on a bad connection.
 *
 * A child value beats a parent value, so `ssr = true` here is what stops a published page
 * inheriting the app's `ssr = false` and serving an empty document to everything without a
 * JavaScript engine. Nothing on these pages needs script — the navigation is links, the search is a
 * GET form and the password challenge is a POST form with a server action — so the document that
 * arrives is the whole page, and it is the same page a crawler indexes.
 *
 * **`csr` stays on, and it is not an oversight.** `csr = false` is the obvious choice for a page
 * made of links and prose, it was written that way first, and it broke dark mode across the whole
 * group. SvelteKit adds `'nonce-…'` to the `script-src` directive only when it emits an inline
 * script of its own to nonce (`Csp#add_script`); with client-side rendering off it emits none, the
 * header goes out as a bare `script-src 'self'`, and the pre-paint theme script in `app.html` —
 * which carries a hand-written `nonce="%sveltekit.nonce%"` — is refused by the browser. The page
 * then renders light for a reader whose system is dark, and says so only in a console the reader
 * does not have open. Measured on the running build, in all four renderings.
 */
export const ssr = true
export const csr = true
export const prerender = false
