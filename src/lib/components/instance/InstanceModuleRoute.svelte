<script lang="ts">
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'

import { getApi } from '$lib/api/client'
import { capabilitiesOf } from '$lib/modules/capabilities'
import ModuleRoute from '$lib/modules/ModuleRoute.svelte'
import { enabledModuleIds } from '$lib/modules/registry'
import { resolveModuleRoute } from '$lib/modules/routing'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'

/**
 * Mount point for module-declared **instance** pages.
 *
 * Declaring a page with scope `instance` is enough — this mounts it under whichever base this
 * hosting puts the instance pages at (`/<ws>/admin` on cloud, `/<ws>/settings/instance` on a
 * self-hosted install), exactly where `instanceLinksFor` already links it.
 *
 * The declared path stays `/admin/<module>/<id>` whichever base is in use, so the segments are
 * normalised to it here rather than the base leaking into `routing.ts` and into every module's
 * declaration. A module author never sees this: they declare a page id, and the two navigations
 * build the href from `instanceHref`.
 *
 * These pages are not about a workspace, so unlike every other contribution they are **not**
 * filtered on which modules the workspace has enabled, and never on a capability: an operator
 * looking at what every workspace is billed must still see the screen when the workspace they
 * happen to be standing in has billing switched off. The layout above gates the whole area on the
 * instance-admin flag, which is the check that matters here.
 */
const api = getApi()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
// `'admin'` is the declared prefix, not the URL's — see the note above. Both catch-alls hand us the
// same `page` rest parameter: the part after their own base.
const segments = $derived(['admin', ...(page.params.page ?? '').split('/').filter(Boolean)])

// Same query key as the settings layout's, so this shares its result rather than fetching again.
const modulesQuery = createQuery(() => ({
  queryKey: keys.modules(workspace?.id ?? ''),
  queryFn: () => api.workspaces.modules.list({ workspaceId: workspace!.id }),
  enabled: Boolean(workspace),
}))

const resolved = $derived(
  resolveModuleRoute(segments, {
    enabled: enabledModuleIds(modulesQuery.data),
    capabilities: capabilitiesOf(modulesQuery.data ?? []),
    can: (permission: string) => session.can(permission),
    scope: 'instance',
  }),
)

$effect(() => {
  // Only judge after the module list has landed; before that, "nothing resolved" means "not fetched yet".
  if (modulesQuery.isSuccess && !resolved) throw new Error('not found')
})
</script>

{#if resolved}
  <ModuleRoute {resolved} workspaceId={workspace?.id ?? ''} workspaceSlug={slug} />
{/if}
