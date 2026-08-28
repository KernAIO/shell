import { notFound, publicQuire, resolveWorkspaceId } from '$lib/public/quire.server'
import { PUBLICATION_TOKEN_COOKIE } from '$lib/public/token'
import type { RequestHandler } from './$types'

/**
 * The pictures on a published page, served from here rather than from storage.
 *
 * A published page's `<img src>` is `<basePath>__media/<reference>` and this is the route that has
 * to answer it — the module builds that address and cannot serve it, so a missing route here is a
 * published site with no illustrations on it.
 *
 * **The indirection is the point, and it replaced two defects at once.** The stored HTML used to
 * carry a presigned storage URL, which is the object's key — `ws/<workspaceId>/<module>/<yyyy>/
 * <mm>/<fileId>/<name>` — so every published page with a picture on it handed a signed-out stranger
 * the tenant's workspace uuid and a file uuid, on the one surface in Kern whose whole rule is that
 * no answer carries an id; and a presigned GET lasts an hour while the HTML it was written into is
 * rendered once and kept for ever, so the pictures broke the same afternoon they were published.
 * The reference names nothing, does not expire, and is resolved per request against the tree of the
 * publication it was presented on — so a page taken back out of a site takes its pictures with it.
 *
 * The bytes come back through `public.asset` and are relayed here rather than redirected to,
 * because a redirect would put the storage URL back in the reader's browser and undo the whole
 * exercise. This is a Node-side fetch with no reader's cookie on it, exactly like the rest of
 * `quire.server.ts`.
 *
 * `__media` cannot collide with a page. A published page's own segment is `slugifyTitle`'s output —
 * Unicode letters and digits joined by hyphens — so no title can ever produce one starting with an
 * underscore, and SvelteKit sorts a literal segment ahead of the `[...path]` rest parameter beside
 * it in any case.
 */
export const GET: RequestHandler = async ({ params, cookies, setHeaders }) => {
  const workspaceId = resolveWorkspaceId(params.workspace)
  if (!workspaceId) notFound()

  const token = cookies.get(PUBLICATION_TOKEN_COOKIE) ?? null
  const asset = await publicQuire()
    .public.asset({ workspaceId, slug: params.publication, asset: params.asset, token })
    .catch(notFound)

  /*
   * Two headers this response must not be served without.
   *
   * `nosniff` stops a browser deciding for itself that these bytes are markup, and the policy is
   * what makes `image/svg+xml` safe to allow at all: an SVG is a document, it may carry script, and
   * this is the *application's own origin*. `default-src 'none'` leaves it able to draw itself and
   * nothing else. Both are stated in the contract as the route layer's side of the bargain, because
   * the server narrowed the type on the understanding that they would be here.
   */
  setHeaders({
    'content-type': asset.contentType,
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    // A version is immutable and a reference names one file, so this can be cached hard — unless
    // the reader is carrying an unlock token, in which case this is one person's copy of something
    // behind a password and no shared cache may hold it.
    'cache-control': token ? 'private, no-store' : `public, max-age=${asset.maxAge}, immutable`,
  })

  return new Response(Buffer.from(asset.bytes, 'base64'))
}
