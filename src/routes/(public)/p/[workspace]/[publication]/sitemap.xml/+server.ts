import { pageUrl, publicBasePath } from '$lib/public/address'
import { notFound, publicQuire, resolveWorkspaceId } from '$lib/public/quire.server'
import type { RequestHandler } from './$types'

/**
 * What a crawler may index, which is not the same list as what a reader may open.
 *
 * `public.sitemap` takes no token and answers an **empty** sitemap for a site behind a password or
 * one marked `indexable: false` — empty rather than private, because the file exists to be fetched
 * by robots and a 404 would say something about the slug that the rest of this surface refuses to
 * say. Every line is a path the module built from titles; there is no id in the file.
 *
 * `lastModified` is when a page was last *published*, never when its draft was last touched: the
 * draft column moves on every keystroke, and publishing it would tell the internet when somebody
 * was working on a change they have not shipped.
 */
export const GET: RequestHandler = async ({ params, url, setHeaders }) => {
  const workspaceId = resolveWorkspaceId(params.workspace)
  if (!workspaceId) notFound()

  const { entries } = await publicQuire()
    .public.sitemap({ workspaceId, slug: params.publication })
    .catch(notFound)

  const basePath = publicBasePath(params.workspace, params.publication)
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (entry) =>
        `  <url><loc>${xml(pageUrl(url.origin, basePath, entry.path))}</loc>` +
        `<lastmod>${xml(entry.lastModified)}</lastmod></url>`,
    ),
    '</urlset>',
    '',
  ].join('\n')

  setHeaders({ 'cache-control': 'public, max-age=600' })
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8' } })
}

const xml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
