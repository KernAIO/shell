<script lang="ts">
import type { AnyComponent } from '@kernhq/ui'
import type { OverlayEntry } from '$lib/modules/registry'

/**
 * Mounts what each module wants to keep, once per workspace.
 *
 * Everything else a module contributes lives inside a page, so a navigation destroys it. This is the
 * one place that does not: the component is mounted when the workspace opens, kept while the person
 * moves between the tracker, chat and a settings screen, and destroyed when the workspace closes.
 * The layout keys it on the workspace id and renders it inside the signed-in branch, so a workspace
 * switch and a sign-out both take it with them.
 *
 * The memoisation is not an optimisation, and here it is the whole point. `{#await entry.component()}`
 * calls the thunk *during render*, so every re-render of the layout produces a new promise, the
 * await block restarts, and the component is unmounted and mounted again — which for a sidebar
 * meant a refetch (see `ModuleSidebar`) and for an overlay would mean whatever it was holding is
 * gone. Loading each component once and remembering it is what makes "survives navigation" true.
 *
 * The overlay decides its own position. The shell gives it no box, because an overlay is a banner
 * across the top for one module and a bar across the bottom for another; what the shell guarantees
 * is where in the tree it sits — above the application, under the command palette — and how long
 * it lives.
 */
interface Props {
  entries: OverlayEntry[]
  workspaceId: string
  workspaceSlug: string
}
let { entries, workspaceId, workspaceSlug }: Props = $props()

const loaded = new Map<string, Promise<{ default: AnyComponent }>>()

function load(entry: OverlayEntry): Promise<{ default: AnyComponent }> {
  const key = `${entry.moduleId}:${entry.id}`
  const cached = loaded.get(key)
  if (cached) return cached
  const promise = entry.component() as Promise<{ default: AnyComponent }>
  loaded.set(key, promise)
  return promise
}
</script>

{#each entries as entry (entry.moduleId + entry.id)}
  {#await load(entry) then mod}
    {@const Body = mod.default}
    <Body {workspaceId} {workspaceSlug} />
  {/await}
{/each}
