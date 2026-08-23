<script lang="ts">
import { SidebarGroup, SidebarItem } from '@kernhq/ui'
import { page } from '$app/state'
import * as m from '$msg'
import { trackerHref } from '../nav'

/**
 * What the tracker puts on the home sidebar.
 *
 * These three rows lived in the application layout, which meant a workspace with the tracker
 * switched off still saw them and still linked into it. They are the tracker's presets — real
 * queries the issues screen reads out of the URL — so they belong to the tracker, and appear only
 * when it is enabled and the reader may see issues.
 */
interface Props {
  workspaceSlug: string
}
let { workspaceSlug }: Props = $props()

const params = $derived(page.url.searchParams)
const inTracker = $derived(page.url.pathname === `/${workspaceSlug}/tracker`)

const rows = [
  { preset: 'assigned', icon: 'circle-user', label: () => m.tracker_preset_assigned() },
  { preset: 'created', icon: 'square-pen', label: () => m.tracker_preset_created() },
  { preset: 'subscribed', icon: 'eye', label: () => m.tracker_preset_subscribed() },
] as const
</script>

<SidebarGroup title={m.tracker_title()}>
  {#each rows as row (row.preset)}
    <SidebarItem
      label={row.label()}
      icon={row.icon}
      href={trackerHref(workspaceSlug, { preset: row.preset })}
      active={inTracker && params.get('preset') === row.preset}
    />
  {/each}
</SidebarGroup>
