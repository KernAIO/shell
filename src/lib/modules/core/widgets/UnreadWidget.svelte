<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import { formatCount } from '$lib/format'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'
import StatTileWidget from './StatTileWidget.svelte'

/** Unread notifications in this workspace. Same source the rail badge reads, so they cannot disagree. */
let { workspaceId, workspaceSlug }: WidgetProps = $props()

const api = getApi()
const counts = createQuery(() => ({
  queryKey: keys.notificationCounts(),
  queryFn: () => api.notifications.counts(),
}))

const value = $derived.by(() => {
  const row = (counts.data ?? []).find((r) => r.workspaceId === workspaceId)
  // The live badge wins when it has arrived: it is newer than the query by definition.
  return realtime.badges[workspaceId]?.unread ?? row?.unread ?? 0
})
</script>

<StatTileWidget
  label={m.home_stat_unread()}
  value={formatCount(value)}
  href="/{workspaceSlug}/inbox"
/>
