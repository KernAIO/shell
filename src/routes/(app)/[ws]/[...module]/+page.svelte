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
 * Mount point for module-declared routes.
 *
 * Every screen a module contributes is declared in its client manifest (`routes:`) and mounted
 * here — the shell owns no module screens of its own. SvelteKit's more specific file routes win by
 * construction, so this catch-all only ever sees paths no first-party route file claims; as module
 * UI moves into the modules, their hand-written files are deleted and this is what serves them.
 *
 * The same gates apply as everywhere else contributions are read: the workspace must have the
 * module enabled, the capability on, and the person allowed — otherwise this renders nothing and
 * SvelteKit's error page answers, mirroring the API's 404.
 */
const api = getApi()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const segments = $derived((page.params.module ?? '').split('/').filter(Boolean))

// Same query key as the shell layout's, so this shares its result rather than fetching again.
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

/**
 * A path no module claims is not this component's to answer: rendering an empty page would hide
 * real breakage behind a blank screen. Throwing sends it to the app's `+error.svelte`, which says
 * plainly that the page does not exist.
 */
$effect(() => {
  // Only after the workspace's module list has landed — before that, "nothing resolved" means
  // "nothing fetched yet", and throwing would 404 every hard navigation.
  if (modulesQuery.isSuccess && !resolved) throw new Error('not found')
})
</script>

{#if resolved}
  <ModuleRoute {resolved} workspaceId={workspace?.id ?? ''} workspaceSlug={slug} />
{/if}
