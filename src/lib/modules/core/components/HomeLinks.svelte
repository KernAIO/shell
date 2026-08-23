<script lang="ts">
import { SidebarGroup, SidebarItem } from '@kernhq/ui'
import { formatCount } from '$lib/format'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'

/** The one row on the home sidebar that is the platform's rather than a module's. */
interface Props {
  workspaceId: string
  workspaceSlug: string
}
let { workspaceId, workspaceSlug }: Props = $props()

const unread = $derived(realtime.badges[workspaceId]?.unread ?? 0)
</script>

<SidebarGroup title={m.nav_home()}>
  <SidebarItem
    label={m.nav_inbox()}
    icon="inbox"
    href="/{workspaceSlug}/inbox"
    badge={unread > 0 ? formatCount(unread) : undefined}
    glow={unread > 0}
  />
</SidebarGroup>
