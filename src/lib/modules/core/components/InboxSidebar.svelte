<script lang="ts">
import { SidebarGroup, SidebarItem } from '@kernhq/ui'
import { page } from '$app/state'
import { formatCount } from '$lib/format'
import { realtime } from '$lib/realtime.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The inbox's own navigation.
 *
 * Every row is a link to a query string the inbox page reads, not a mode it is put into — which is
 * why the sidebar can drive a page it does not own, and why a filtered inbox can be linked to and
 * gone back from.
 */
interface Props {
  workspaceId: string
  workspaceSlug: string
}
let { workspaceId, workspaceSlug }: Props = $props()

const params = $derived(page.url.searchParams)
const filter = $derived(params.get('filter') === 'all' ? 'all' : 'unread')
const scope = $derived(params.get('scope') === 'all' ? 'all' : 'workspace')

const unread = $derived(realtime.badges[workspaceId]?.unread ?? 0)
const workspaceName = $derived(session.workspaces.find((w) => w.id === workspaceId)?.name ?? workspaceSlug)
</script>

<SidebarGroup title={m.nav_inbox()}>
  <SidebarItem
    label={m.inbox_tab_unread()}
    icon="inbox"
    href="/{workspaceSlug}/inbox"
    active={filter !== 'all'}
    badge={unread > 0 ? formatCount(unread) : undefined}
    glow={unread > 0}
  />
  <SidebarItem
    label={m.inbox_tab_all()}
    icon="list"
    href="/{workspaceSlug}/inbox?filter=all"
    active={filter === 'all'}
  />
</SidebarGroup>

<SidebarGroup title={m.inbox_scope()}>
  <SidebarItem
    label={workspaceName}
    icon="building"
    href="/{workspaceSlug}/inbox{filter === 'all' ? '?filter=all' : ''}"
    active={scope !== 'all'}
  />
  <SidebarItem
    label={m.inbox_all_workspaces()}
    icon="globe"
    href="/{workspaceSlug}/inbox?scope=all{filter === 'all' ? '&filter=all' : ''}"
    active={scope === 'all'}
  />
</SidebarGroup>
