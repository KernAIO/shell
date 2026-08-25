<script lang="ts">
import { Badge, EmptyState, IconButton, Popover } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import { relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'

interface Props {
  workspaceId: string
  workspaceSlug: string
}
let { workspaceId, workspaceSlug }: Props = $props()

const api = getApi()
let open = $state(false)

const recent = createQuery(() => ({
  queryKey: keys.notifications(`bell:${workspaceId}`),
  queryFn: () => api.notifications.list({ workspaceId, unreadOnly: true, limit: 8 }),
}))

const unread = $derived(realtime.badges[workspaceId]?.unread ?? recent.data?.items.length ?? 0)

async function openNotification(n: { id: string; url: string | null }) {
  open = false
  await api.notifications.markRead({ ids: [n.id] })
  await recent.refetch()
  if (n.url) await goto(`/${workspaceSlug}${n.url}`)
}
</script>

<Popover bind:open align="end" class="w-[360px] p-0">
  {#snippet trigger(props)}
    <span {...props} class="relative inline-flex">
      <IconButton icon="bell" label={m.notifications()} />
      {#if unread}
        <span
          class="pointer-events-none absolute -end-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--kern-accent-badge-bg)] px-1 font-[var(--kern-font-mono)] text-[10px] leading-none text-[var(--kern-accent-badge-fg)]"
        >
          {unread > 99 ? '99+' : unread}
        </span>
      {/if}
    </span>
  {/snippet}

  <header class="flex items-center justify-between border-b border-[var(--kern-border)] px-3.5 py-2.5">
    <span class="text-[13px] font-semibold text-[var(--kern-ink-900)]">{m.notifications()}</span>
    <a
      href="/{workspaceSlug}/inbox"
      class="text-[12px] text-[var(--kern-accent)] hover:underline"
      onclick={() => (open = false)}
    >
      {m.inbox_title()}
    </a>
  </header>

  <div class="max-h-[380px] overflow-y-auto">
    {#if (recent.data?.items.length ?? 0) === 0}
      <div class="p-6"><EmptyState icon="check" title={m.no_notifications()} compact /></div>
    {:else}
      {#each recent.data!.items as n (n.id)}
        <button
          type="button"
          class="flex w-full flex-col items-start gap-0.5 border-b border-[var(--kern-border-hairline)] px-3.5 py-2.5 text-start last:border-0 hover:bg-[var(--kern-surface-hover)]"
          onclick={() => openNotification(n)}
        >
          <span class="flex w-full items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--kern-ink-900)]">{n.title}</span>
            <time class="shrink-0 font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
              {relativeTime(n.createdAt)}
            </time>
          </span>
          {#if n.body}
            <span class="line-clamp-2 text-[12.5px] text-[var(--kern-ink-500)]">{n.body}</span>
          {/if}
        </button>
      {/each}
    {/if}
  </div>
</Popover>
