<script lang="ts">
import type { WidgetProps } from '@kernhq/ui'
import { Avatar, StatusDot } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import WidgetState from '$lib/dashboard/WidgetState.svelte'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import * as m from '$msg'

/**
 * Who is in the workspace, and who is here now.
 *
 * Deliberately a list and not a count: `members.list` returns `{items, nextCursor}` and no total, so
 * a number on this card would either be a lie or a full walk of every page.
 */
let { workspaceId, workspaceSlug, settings }: WidgetProps = $props()

const api = getApi()
const limit = $derived(Number(settings.limit ?? 8))

const query = createQuery(() => ({
  queryKey: [...keys.members(workspaceId), 'widget', limit],
  queryFn: () => api.workspaces.members.list({ workspaceId, limit }),
}))

const members = $derived(query.data?.items ?? [])
const online = (userId: string) => realtime.online.has(userId)
</script>

<WidgetState
  pending={query.isPending}
  error={query.error}
  empty={members.length === 0}
  emptyTitle={m.members_empty()}
  emptyIcon="users"
  onRetry={() => query.refetch()}
>
  <ul>
    {#each members as member (member.userId)}
      <li>
        <a href="/{workspaceSlug}/settings/members">
          <Avatar name={member.user.name} src={member.user.avatarUrl} size={24} id={member.userId} />
          <span class="name">{member.user.name}</span>
          {#if online(member.userId)}
            <StatusDot status="online" />
          {/if}
          <span class="role">{member.role}</span>
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
    padding: 7px 14px;
    color: inherit;
  }
  a:hover {
    background: var(--kern-surface-hover);
  }
  .name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    color: var(--kern-ink-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .role {
    font-size: 11.5px;
    color: var(--kern-ink-400);
    text-transform: capitalize;
  }
</style>
