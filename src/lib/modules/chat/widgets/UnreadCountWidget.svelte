<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { StatTile } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { formatCount } from '$lib/format'
import { getChatApi } from '$lib/modules/chat/api'
import * as m from '$msg'

let { workspaceId, workspaceSlug }: WidgetProps = $props()

const api = getChatApi()
const query = createQuery(() => ({
  queryKey: ['chat', 'unread', workspaceId],
  queryFn: () => api.channels.unread({ workspaceId }),
  enabled: Boolean(workspaceId),
}))
</script>

<div class="wrap">
  <StatTile
    label={m.widget_chat_unread_title()}
    value={query.isPending ? '—' : formatCount(query.data?.totals.unread ?? 0)}
    href="/{workspaceSlug}/chat"
    size="md"
    class="tile"
  />
</div>

<style>
  .wrap {
    display: grid;
    align-content: center;
    height: 100%;
    padding: 14px 16px;
  }
  .wrap :global(.tile) {
    border: 0;
    background: transparent;
    padding: 0;
  }
</style>
