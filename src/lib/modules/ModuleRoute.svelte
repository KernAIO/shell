<script lang="ts">
import type { AnyComponent } from '@kernhq/ui'
import type { ResolvedModuleRoute } from '$lib/modules/routing'

/**
 * Renders one module-declared route (`ClientRoute`).
 *
 * Same memoisation as `ModuleSidebar`: the thunk is called once per module+path and remembered,
 * because calling it during render produces a fresh promise every re-render and remounts the page
 * underneath the user.
 */
interface Props {
  resolved: ResolvedModuleRoute
  workspaceId: string
  workspaceSlug: string
}
let { resolved, workspaceId, workspaceSlug }: Props = $props()

const loaded = new Map<string, Promise<{ default: AnyComponent }>>()

function load({ moduleId, route }: ResolvedModuleRoute): Promise<{ default: AnyComponent }> {
  const key = `${moduleId}:${route.path}`
  const cached = loaded.get(key)
  if (cached) return cached
  const promise = route.component() as Promise<{ default: AnyComponent }>
  loaded.set(key, promise)
  return promise
}
</script>

{#await load(resolved) then mod}
  {@const Page = mod.default}
  <!--
    Keyed on the resolved path *and its parameter values*, so navigating from one page of a wiki to
    another remounts rather than reusing a component whose state belongs to the page you left.
    Without the key, `/quire/eng/a` -> `/quire/eng/b` keeps the first page's editor and its unsaved
    text.
  -->
  {#key `${resolved.moduleId}:${resolved.route.path}:${Object.values(resolved.params).join('/')}`}
    <Page {workspaceId} {workspaceSlug} params={resolved.params} rest={resolved.rest} />
  {/key}
{/await}
