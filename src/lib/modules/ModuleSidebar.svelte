<script lang="ts">
import type { AnyComponent } from '@kernhq/ui'
import type { SidebarEntry } from '$lib/modules/registry'

/**
 * Renders the sidebar the module in view owns.
 *
 * The memoisation is not an optimisation. `{#await entry.component()}` calls the thunk *during
 * render*, so every re-render of the layout produces a new promise, the await block restarts, and
 * the whole sidebar unmounts and remounts — chat's conversation list and the tracker's saved views
 * refetched on every navigation because of it. Loading each component once and remembering it is
 * what makes the column stable.
 */
interface Props {
  entries: SidebarEntry[]
  which: 'controls' | 'component'
  workspaceId: string
  workspaceSlug: string
  pathname: string
  segment: string
}
let { entries, which, workspaceId, workspaceSlug, pathname, segment }: Props = $props()

const loaded = new Map<string, Promise<{ default: AnyComponent }>>()

function load(entry: SidebarEntry): Promise<{ default: AnyComponent }> | null {
  const thunk = which === 'controls' ? entry.controls : entry.component
  if (!thunk) return null
  const key = `${entry.moduleId}:${entry.id}:${which}`
  const cached = loaded.get(key)
  if (cached) return cached
  const promise = thunk() as Promise<{ default: AnyComponent }>
  loaded.set(key, promise)
  return promise
}
</script>

{#each entries as entry (entry.moduleId + entry.id)}
  {@const promise = load(entry)}
  {#if promise}
    {#await promise then mod}
      {@const Body = mod.default}
      <Body {workspaceId} {workspaceSlug} {pathname} {segment} />
    {/await}
  {/if}
{/each}
