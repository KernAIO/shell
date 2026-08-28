import { localeCookieName, publicLocale } from '$lib/public/locale'
import type { LayoutServerLoad } from './$types'

/**
 * The reader's language, resolved once for the whole group and before anything can fail.
 *
 * It sits here rather than on the publication's own layout for one reason: an address that names no
 * published site throws in *that* layout, and a load that throws contributes no data. Anything the
 * not-found page needs therefore has to have been resolved by an ancestor — which is what makes a
 * 404 come out in the reader's language rather than in English.
 */
export const load: LayoutServerLoad = ({ cookies, request }) =>
  publicLocale(cookies.get(localeCookieName), request.headers.get('accept-language'))
