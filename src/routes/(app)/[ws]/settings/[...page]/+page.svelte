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
 * Mount point for module-declared **settings** pages.
 *
 * Declaring a workspace settings page (`settingsPages`, scope `workspace`) is enough — this mounts
 * it at the conventional URL inside the settings chrome, exactly as the settings navigation already
 * links it. Hand-written route files under `settings/<module>/` are legacy: they win while they
 * exist (more specific beats the catch-all) and are deleted as each module's UI moves into the
 * module package.
 *
 * Gates are the same as every contribution read: module enabled, capability on, permission held.
 */
const api = getApi()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const segments = $derived(['settings', ...(page.params.page ?? '').split('/').filter(Boolean)])

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
