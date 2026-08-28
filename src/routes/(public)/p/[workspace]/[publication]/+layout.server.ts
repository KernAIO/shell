import type { PublicSite } from '@kernhq/module-quire/client'
import { publicBasePath } from '$lib/public/address'
import { notFound, publicQuire, resolveWorkspaceId } from '$lib/public/quire.server'
import { PUBLICATION_TOKEN_COOKIE } from '$lib/public/token'
import type { LayoutServerLoad } from './$types'

/**
 * Everything the chrome around a published page needs, and nothing a reader could try elsewhere.
 *
 * One call: `public.site` answers the title, the description, the theme, whether a crawler may
 * index it, when the site was last published, and the whole navigation tree — flat, addressed by
 * path, with no id of any kind in it.
 *
 * A locked site answers `{ locked: true, site: null }` and that is all it answers. The title and
 * the shape of the tree stay behind the door, because a table of contents is most of what a private
 * handbook is; the theme comes out anyway, so the challenge screen is not white on a site that is
 * not.
 *
 * `token` is read from an HttpOnly cookie scoped to this publication's path, never from the URL: a
 * token in a link is a token in a referrer header and in somebody's access log.
 */
export const load: LayoutServerLoad = async ({ params, url, cookies }) => {
  const workspaceId = resolveWorkspaceId(params.workspace)
  if (!workspaceId) notFound()

  const basePath = publicBasePath(params.workspace, params.publication)
  const token = cookies.get(PUBLICATION_TOKEN_COOKIE) ?? null

  const site: PublicSite = await publicQuire()
    .public.site({ workspaceId, slug: params.publication, token })
    .catch(notFound)

  return {
    basePath,
    slug: site.slug,
    theme: site.theme,
    locked: site.locked,
    site: site.site,
    origin: url.origin,
  }
}
