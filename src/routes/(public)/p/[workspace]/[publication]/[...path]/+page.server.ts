import type { PublicPage, PublicSearchHit } from '@kernhq/module-quire/client'
import { fail, redirect } from '@sveltejs/kit'
import { publicLinkBase } from '$lib/public/address'
import { notFound, publicQuire, resolveWorkspaceId } from '$lib/public/quire.server'
import { PUBLICATION_TOKEN_COOKIE } from '$lib/public/token'
import type { Actions, PageServerLoad } from './$types'

/**
 * One route for every page of a published site, the front page included.
 *
 * A rest parameter matches zero segments as well as many, so `/p/acme/handbook` and
 * `/p/acme/handbook/guide/install` are the same route with `path` of `''` and `guide/install` — the
 * two forms the module's `public.page` already distinguishes. `sitemap.xml` and `robots.txt` sit
 * beside this as static segments, which SvelteKit sorts ahead of a rest parameter; neither can ever
 * be shadowed by a page, because a page's slug is built from its title and carries no dots.
 *
 * Search shares the route rather than taking one of its own, and that is a correctness decision
 * rather than a saving. A `search` directory here would shadow a published page whose title is
 * "Search" — silently, and only for the customer who wrote one. `?q=` on the front page cannot
 * collide with anything.
 */
const MIN_QUERY = 2

export const load: PageServerLoad = async ({ params, url, parent, cookies, setHeaders }) => {
  const { basePath, locked, locale } = await parent()

  /*
   * A locked site renders its challenge and asks the module for nothing else. `public.page` would
   * answer 404 while the door is shut — correctly — and turning that into the app's not-found here
   * would tell a reader with the right password that they had the wrong address.
   */
  if (locked) {
    setHeaders({ 'cache-control': 'private, no-store' })
    return { locked: true as const, page: null, results: null, query: '' }
  }

  const workspaceId = resolveWorkspaceId(params.workspace)
  if (!workspaceId) notFound()
  const token = cookies.get(PUBLICATION_TOKEN_COOKIE) ?? null
  const api = publicQuire()

  const query = (url.searchParams.get('q') ?? '').trim()
  if (query.length > 0) {
    /*
     * Results are never cached and never indexed. They are one reader's question, they change with
     * every publish, and a crawler following them would fill an index with the same site under a
     * thousand addresses.
     */
    setHeaders({ 'cache-control': 'private, no-store' })
    const results: PublicSearchHit[] =
      query.length < MIN_QUERY
        ? []
        : (
            await api.public
              .search({ workspaceId, slug: params.publication, q: query, limit: 20, token })
              .catch(notFound)
          ).items
    return { locked: false as const, page: null, results, query }
  }

  const page: PublicPage = await api.public
    .page({
      workspaceId,
      slug: params.publication,
      path: params.path,
      // What the module rewrites every inter-page link in the rendered HTML against, so a mention
      // of another page in this site is a link to where this route actually serves it.
      basePath: publicLinkBase(basePath),
      token,
    })
    .catch(notFound)

  /*
   * A published page is immutable until it is published again, which is what makes it a static
   * read. `etag` is the module's validator for the pinned version — a hash rather than the version
   * id, because the id addresses a procedure that asks a permission and handing it to the internet
   * turns a cache key into something to try.
   *
   * A reader carrying an unlock token gets none of this: the response is one person's copy of a
   * site behind a password, and a shared cache must never be able to hand it to the next person.
   *
   * **The version is not the whole of what identifies this document, and saying it was is a bug
   * with a demonstration.** Every string on the page is rendered in a language negotiated from
   * `Accept-Language` and the `kern_locale` cookie, so one published version has five bodies. With
   * no `Vary` a shared cache keys them all together and hands the first reader's language to
   * everybody after them; and because the validator was the version alone, a Persian reader
   * revalidating an English copy was answered `304 Not Modified` and told to keep it — measured, on
   * this build, with `If-None-Match` plus `Accept-Language: fa`. The locale therefore names the
   * representation in both places: in `Vary`, so a cache knows what selected it, and in the entity
   * tag, so a conditional request cannot confirm the wrong one. `cookie` is in `Vary` because the
   * cookie is one of the two selectors — it costs a signed-out stranger and a crawler nothing, and
   * those are the readers this response is cached for.
   */
  if (token) setHeaders({ 'cache-control': 'private, no-store' })
  else
    setHeaders({
      'cache-control': 'public, max-age=60, stale-while-revalidate=600',
      vary: 'accept-language, cookie',
      etag: `"${page.etag}.${locale}"`,
    })

  return { locked: false as const, page, results: null, query: '' }
}

export const actions: Actions = {
  /**
   * Present the password, keep the token.
   *
   * A plain form post, handled by the server and answered with a redirect, so it works with no
   * JavaScript on the page — which on this route is not a nicety, since `csr = false` means there
   * is none. The redirect target is the request's own path and never anything the form carried: a
   * `next` field on a form anybody can reach is an open redirect waiting to be found.
   */
  unlock: async ({ request, params, url, cookies }) => {
    const workspaceId = resolveWorkspaceId(params.workspace)
    if (!workspaceId) notFound()

    const password = String((await request.formData()).get('password') ?? '')
    if (password.length === 0) return fail(400, { wrong: true })

    const opened = await publicQuire()
      .public.unlock({ workspaceId, slug: params.publication, password })
      .catch(() => null)
    // Every refusal reads the same, whatever it was: a wrong password, an expired site and a slug
    // that never existed must not be distinguishable by anyone standing at the door.
    if (!opened) return fail(400, { wrong: true })

    cookies.set(PUBLICATION_TOKEN_COOKIE, opened.token, {
      path: `/p/${encodeURIComponent(params.workspace)}/${encodeURIComponent(params.publication)}`,
      httpOnly: true,
      sameSite: 'lax',
      secure: url.protocol === 'https:',
      expires: new Date(opened.expiresAt),
    })
    redirect(303, url.pathname)
  },
}
