<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { Icon, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import WidgetState from '$lib/dashboard/WidgetState.svelte'
import { relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * Unread notifications, and the two things you actually want to do with one.
 *
 * A row that only navigates makes the dashboard a table of contents. Marking read and archiving are
 * the same two actions the inbox offers, so the card is somewhere work finishes rather than
 * somewhere it is announced.
 */
let { workspaceId, workspaceSlug, settings, editing }: WidgetProps = $props()

const api = getApi()
const client = useQueryClient()
const limit = $derived(Number(settings.limit ?? 6))

const query = createQuery(() => ({
  // The limit is part of the key: a query key that ignores a setting serves the cached answer, and
  // the setting looks broken on a warm cache.
  queryKey: [...keys.notifications(`widget:${workspaceId}`), limit],
  queryFn: () => api.notifications.list({ workspaceId, unreadOnly: true, limit }),
}))

const invalidate = () => {
  void client.invalidateQueries({ queryKey: ['core', 'notification'] })
  void client.invalidateQueries({ queryKey: keys.notificationCounts() })
}

const markRead = createMutation(() => ({
  mutationFn: (id: string) => api.notifications.markRead({ ids: [id] }),
  onSuccess: invalidate,
  onError: (e: unknown) => toast.error(e instanceof Error ? e.message : m.error_generic()),
}))

const archive = createMutation(() => ({
  mutationFn: (id: string) => api.notifications.archive({ id }),
  onSuccess: invalidate,
  onError: (e: unknown) => toast.error(e instanceof Error ? e.message : m.error_generic()),
}))

const items = $derived(query.data?.items ?? [])
</script>

<WidgetState
  pending={query.isPending}
  error={query.error}
  empty={items.length === 0}
  emptyTitle={m.home_inbox_empty()}
  emptyIcon="check"
  onRetry={() => query.refetch()}
>
  <ul>
    {#each items as n (n.id)}
      <li>
        <a class="row" href={n.url ? `/${workspaceSlug}${n.url}` : `/${workspaceSlug}/inbox`}>
          <span class="dot" aria-hidden="true"></span>
          <span class="text">
            <span class="title">{n.title}</span>
            {#if n.body}<span class="body">{n.body}</span>{/if}
          </span>
          <time datetime={n.createdAt}>{relativeTime(n.createdAt)}</time>
        </a>
        <!-- Hidden while the grid is being rearranged: a card you are dragging is not a card you
             are acting on, and a stray click would archive something. -->
        {#if !editing}
          <span class="actions">
            <button
              type="button"
              title={m.inbox_mark_read()}
              aria-label={m.inbox_mark_read()}
              onclick={() => markRead.mutate(n.id)}
            >
              <Icon name="check" size={14} />
            </button>
            <button
              type="button"
              title={m.inbox_archive()}
              aria-label={m.inbox_archive()}
              onclick={() => archive.mutate(n.id)}
            >
              <Icon name="archive" size={14} />
            </button>
          </span>
        {/if}
      </li>
    {/each}
  </ul>
</WidgetState>

<style>
  li {
    position: relative;
    border-block-end: 1px solid var(--kern-border-hairline);
  }
  li:last-child {
    border-block-end: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 14px;
    color: inherit;
  }
  li:hover .row {
    background: var(--kern-surface-hover);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: var(--kern-r-full);
    background: var(--kern-accent);
    flex-shrink: 0;
  }
  .text {
    flex: 1;
    min-width: 0;
    display: grid;
  }
  .title,
  .body {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .title {
    font-size: 13px;
    color: var(--kern-ink-900);
  }
  .body {
    font-size: 12.5px;
    color: var(--kern-ink-500);
  }
  time {
    flex-shrink: 0;
    font-family: var(--kern-font-mono);
    font-size: 11px;
    color: var(--kern-ink-400);
  }
  .actions {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 8px;
    display: none;
    align-items: center;
    gap: 2px;
  }
  li:hover .actions,
  .actions:focus-within {
    display: flex;
  }
  .actions button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: var(--kern-r-sm);
    background: var(--kern-surface-raised);
    border: 1px solid var(--kern-border);
    color: var(--kern-ink-600);
  }
  .actions button:hover {
    color: var(--kern-ink-900);
    background: var(--kern-surface-hover);
  }
</style>
