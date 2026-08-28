import { baseLocale, isLocale, type Locale } from '$lib/paraglide/runtime'

/**
 * Which language a signed-out reader is served, decided on the server.
 *
 * The rest of the application never has to ask. It renders in the browser, where Paraglide reads
 * its own cookie and `navigator.language` for itself, and the root layout keeps `<html lang/dir>`
 * in step through an effect. A published page renders on the server, before any of that exists —
 * and effects do not run there, so the effect is no help either.
 *
 * So this reads the same two inputs Paraglide's own `['cookie', 'preferredLanguage', 'baseLocale']`
 * strategy reads, in the same order, and the answer is passed down to the layout as data. Every
 * string on a published page is then rendered with an explicit `{ locale }`, which is the one form
 * that gives the same answer on the server and in the browser: a message left to `getLocale()`
 * would come out English on the server and Persian a tick later, and the reader would watch it
 * change.
 *
 * `Accept-Language` is parsed rather than matched exactly, because a browser sends `fa-IR` and
 * `de-AT`, and both of those are a language we ship.
 */
const COOKIE = 'kern_locale'

export interface PublicLocale {
  locale: Locale
  dir: 'ltr' | 'rtl'
}

const RTL = new Set<string>(['ar', 'fa'])

export function publicLocale(cookie: string | undefined, acceptLanguage: string | null): PublicLocale {
  const locale = fromCookie(cookie) ?? fromAcceptLanguage(acceptLanguage) ?? baseLocale
  return { locale, dir: RTL.has(locale) ? 'rtl' : 'ltr' }
}

export const localeCookieName = COOKIE

function fromCookie(value: string | undefined): Locale | null {
  return value && isLocale(value) ? value : null
}

/**
 * The first language in the header this instance actually ships, honouring the quality order.
 *
 * `en-GB;q=0.9, fa;q=1.0` means Persian, so the entries are sorted by `q` before anything is
 * matched — reading the header left to right gets that backwards, and a reader who put their own
 * language second in their browser settings would be served the wrong one.
 */
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null
  const wanted = header
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      return { tag: tag.trim().toLowerCase(), q: q ? Number.parseFloat(q.slice(2)) : 1 }
    })
    .filter((entry) => entry.tag.length > 0 && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q)
  for (const { tag } of wanted) {
    const language = tag.split('-')[0] ?? ''
    if (isLocale(language)) return language
  }
  return null
}
