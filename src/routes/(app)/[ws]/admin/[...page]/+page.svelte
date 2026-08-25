<script lang="ts">
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'

import { getApi } from '$lib/api/client'
import { capabilitiesOf } from '$lib/modules/capabilities'
import ModuleRoute from '$lib/modules/ModuleRoute.svelte'
import { resolveModuleRoute } from '$lib/modules/routing'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'

/**
 * Mount point for module-declared **instance console** pages.
 *
 * Declaring a page with scope `instance` is enough — this mounts it at `/<ws>/admin/<module>/<id>`,
 * exactly where `instanceLinksFor` already links it.
 *
 * The console is not about a workspace, so unlike every other contribution these are **not** filtered
 * on which modules the workspace has enabled, and never on a capability: an operator looking at what
 * every workspace is billed must still see the screen when the workspace they happen to be standing
 * in has billing switched off. The `admin` layout gates the whole area on the instance-admin flag,
 * which is the check that matters here.
 */
const api = getApi()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const segments = $derived(['admin', ...(page.params.page ?? '').split('/').filter(Boolean)])

// Same query key as the settings layout's, so this shares its result rather than fetching again.
const modulesQuery = createQuery(() => ({
  queryKey: keys.modules(workspace?.id ?? ''),
  queryFn: () => api.workspaces.modules.list({ workspaceId: workspace!.id }),
  enabled: Boolean(workspace),
}))

const resolved = $derived(
  resolveModuleRoute(segments, {
    enabled: new Set((modulesQuery.data ?? []).filter((e) => e.state.enabled).map((e) => e.manifest.id)),
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
