<script lang="ts">
import { type AnyComponent, setRouteParams } from '@kernhq/ui'
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

/*
 * Publish the parameters this route matched, so things outside it can read them.
 *
 * `:space` and `:page` are declared by the module and matched here; the shell's layout only ever
 * sees SvelteKit's `{ws, module}`, where `module` is the whole unparsed rest of the path. Passing
 * `resolved.params` to the page component alone left `navigation.params.space` undefined for
 * everything else — and Quire's sidebar, which picks the space to draw from it, silently fell back
 * to the first space in the list. Standing in any space but the first, it listed another space's
 * pages and every row navigated you out of the one you were reading.
 *
 * Cleared on teardown, or the page you left outlives it.
 */
$effect(() => {
  setRouteParams(resolved.params)
  return () => setRouteParams({})
})

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
