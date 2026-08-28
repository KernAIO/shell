import type { Handle } from '@sveltejs/kit'
import { localeCookieName, publicLocale } from '$lib/public/locale'

/**
 * The one thing a published page cannot say for itself: what language the document is in.
 *
 * `app.html` is a static file, so `<html lang="en">` is a literal, and the application corrects it
 * after hydration with an effect in the root layout. That is enough for the app — nobody reads it
 * signed out, and there is nothing in the document before JavaScript runs anyway. It is not enough
 * for a published site, which is the one part of Kern rendered on the server for readers who never
 * run any of it: a crawler and a screen reader both take the document's language from `<html lang>`
 * and neither waits for an effect. A Persian handbook was served as `<html lang="en">` with a
 * Persian body — measured on the built server, in every locale but English.
 *
 * The publication's own layout already carries `lang` and `dir` on its wrapper, and that is right
 * for the direction and the theme, which descendants inherit. `lang` on the root element is the
 * part a wrapper cannot supply, so it is supplied here, where the response is assembled.
 *
 * Scoped to the published routes and to nothing else. Every other request is resolved exactly as it
 * was before this file existed: the application decides its own language in the browser, and a hook
 * guessing on its behalf would be a second source for a value that already has one.
 */
export const handle: Handle = ({ event, resolve }) => {
  if (!event.route.id?.startsWith('/(public)')) return resolve(event)

  const { locale } = publicLocale(
    event.cookies.get(localeCookieName),
    event.request.headers.get('accept-language'),
  )
  return resolve(event, {
    transformPageChunk: ({ html }) => html.replace('<html lang="en">', `<html lang="${locale}">`),
  })
}
