<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import { formatCount } from '$lib/format'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'
import StatTileWidget from './StatTileWidget.svelte'

let { workspaceId, workspaceSlug }: WidgetProps = $props()

const api = getApi()
const counts = createQuery(() => ({
  queryKey: keys.notificationCounts(),
  queryFn: () => api.notifications.counts(),
}))

const value = $derived.by(() => {
  const row = (counts.data ?? []).find((r) => r.workspaceId === workspaceId)
  return realtime.badges[workspaceId]?.mentions ?? row?.mentions ?? 0
})
</script>

<StatTileWidget
  label={m.home_stat_mentions()}
  value={formatCount(value)}
  href="/{workspaceSlug}/inbox"
/>
