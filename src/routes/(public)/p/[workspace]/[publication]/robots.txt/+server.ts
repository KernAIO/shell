import { pageUrl, publicBasePath } from '$lib/public/address'
import { notFound, publicQuire, resolveWorkspaceId } from '$lib/public/quire.server'
import type { RequestHandler } from './$types'

/**
 * The one file here that never distinguishes one slug from another.
 *
 * `public.robots` succeeds for a slug that does not exist, one that has expired and one behind a
 * password, and says "do not index" for all three — otherwise it becomes the oracle every other
 * procedure carefully refuses to be. This route keeps that: the only 404 it can produce is about
 * the **workspace**, which the address already named out loud.
 *
 * A crawler only obeys `/robots.txt` at the origin, so this file cannot be the thing that keeps a
 * site out of an index; the `noindex` the page itself carries is what does that. What this is for
 * is a publisher who points a domain of their own at one publication, and for saying where the
 * sitemap is without making anybody guess.
 */
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
  const workspaceId = resolveWorkspaceId(params.workspace)
  if (!workspaceId) notFound()

  const { indexable, sitemapPath } = await publicQuire()
    .public.robots({ workspaceId, slug: params.publication })
    .catch(notFound)

  const basePath = publicBasePath(params.workspace, params.publication)
  const lines = ['User-agent: *']
  if (indexable) {
    lines.push(`Allow: ${basePath}/`)
    if (sitemapPath) lines.push('', `Sitemap: ${pageUrl(url.origin, basePath, sitemapPath)}`)
  } else {
    lines.push(`Disallow: ${basePath}/`)
  }

  setHeaders({ 'cache-control': 'public, max-age=600' })
  return new Response(`${lines.join('\n')}\n`, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
