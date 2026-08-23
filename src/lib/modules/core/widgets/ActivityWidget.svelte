<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { Avatar } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import WidgetState from '$lib/dashboard/WidgetState.svelte'
import { relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * The workspace audit log.
 *
 * `workspaces.audit` is gated on `core.audit.view`, so this widget is admin-shaped by nature — the
 * picker says so rather than letting somebody place a card that will only ever refuse them.
 */
let { workspaceId, workspaceSlug, settings }: WidgetProps = $props()

const api = getApi()
const limit = $derived(Number(settings.limit ?? 8))

const query = createQuery(() => ({
  queryKey: [...keys.audit(workspaceId), 'widget', limit],
  queryFn: () => api.workspaces.audit({ workspaceId, limit }),
}))

/** Members are what turns an actor id into a name; the audit page resolves it the same way. */
const members = createQuery(() => ({
  queryKey: keys.members(workspaceId),
  queryFn: () => api.workspaces.members.list({ workspaceId, limit: 100 }),
}))
const actorOf = (id: string | null) => members.data?.items.find((mem) => mem.userId === id)

const events = $derived(query.data?.items ?? [])

/** "updated · title, status" reads better than an opaque action name, as on the audit page. */
const describe = (e: { action: string; changes: Array<{ field: string }> }) => {
  const fields = e.changes.map((c) => c.field).join(', ')
  return fields ? `${e.action} · ${fields}` : e.action
}
</script>

<WidgetState
  pending={query.isPending}
  error={query.error}
  empty={events.length === 0}
  emptyTitle={m.audit_empty()}
  emptyIcon="scroll-text"
  onRetry={() => query.refetch()}
>
  <ul>
    {#each events as event (event.id)}
      {@const who = actorOf(event.actorId)}
      <li>
        <a href="/{workspaceSlug}/settings/audit">
          {#if who}
            <Avatar name={who.user.name} src={who.user.avatarUrl} size={22} id={who.userId} />
          {/if}
          <span class="what">
            <span class="verb">{describe(event)}</span>
            <span class="mod">{event.module}</span>
          </span>
          <time datetime={event.occurredAt}>{relativeTime(event.occurredAt)}</time>
        </a>
      </li>
    {/each}
  </ul>
</WidgetState>

<style>
  li {
    border-block-end: 1px solid var(--kern-border-hairline);
  }
  li:last-child {
    border-block-end: 0;
  }
  a {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 8px 14px;
    color: inherit;
  }
  a:hover {
    background: var(--kern-surface-hover);
  }
  .what {
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 6px;
    align-items: baseline;
    overflow: hidden;
  }
  .verb {
    font-size: 13px;
    color: var(--kern-ink-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mod {
    font-family: var(--kern-font-mono);
    font-size: 11px;
    color: var(--kern-ink-400);
  }
  time {
    flex-shrink: 0;
    font-family: var(--kern-font-mono);
    font-size: 11px;
    color: var(--kern-ink-400);
  }
</style>
