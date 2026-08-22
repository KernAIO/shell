<script lang="ts">
import type { View } from '@kernhq/module-tracker/client'
import {
  DropdownMenu,
  EmptyState,
  Icon,
  IconButton,
  type MenuItem,
  SectionLabel,
  Skeleton,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getTrackerApi } from '../api'
import { canTracker } from '../permissions'
import { trackerKeys } from '../query'
import { viewHref } from '../views'

/**
 * Saved views, in the application sidebar (DESIGN.md 2.3).
 *
 * A view is a query somebody named: the KQL, the layout, the grouping and the filters, kept
 * together so "the bugs I own that are overdue" is one click rather than four. The server has had
 * them since the module existed and nothing offered them.
 *
 * Pinned views come first because they are the ones somebody uses daily; the rest follow under a
 * quieter heading rather than in a menu, because a view you cannot see is a view you forget you
 * saved.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManageShared = $derived(canTracker('viewManageShared'))

const viewsQuery = createQuery(() => ({
  queryKey: trackerKeys.views(workspaceId),
  queryFn: () => api.views.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))
const views = $derived(viewsQuery.data ?? [])
const pinned = $derived(views.filter((v) => v.pinned))
const rest = $derived(views.filter((v) => !v.pinned))

/** The view the page is showing, so the sidebar marks it the way the nav marks a page. */
const activeId = $derived(page.url.searchParams.get('view_id'))

const invalidate = () => queryClient.invalidateQueries({ queryKey: trackerKeys.views(workspaceId) })
const fail = (error: Error) => toast.error(error.message)

const pin = createMutation(() => ({
  mutationFn: (input: { id: string; pinned: boolean }) => api.views.pin({ workspaceId, ...input }),
  onSuccess: invalidate,
  onError: fail,
}))

const remove = createMutation(() => ({
  mutationFn: (id: string) => api.views.delete({ workspaceId, id }),
  onSuccess: () => {
    invalidate()
    // Leaving the deleted view in the URL would reopen a query that no longer exists.
    if (activeId) void goto(`/${slug}/tracker`, { replaceState: true, keepFocus: true })
  },
  onError: fail,
}))

/** Who may change a view: your own always, a shared one only with the permission for it. */
const mayEdit = (view: View) =>
  !view.builtin && (view.visibility === 'private' ? view.ownerId === session.user?.id : canManageShared)

const menuFor = (view: View): MenuItem[] => [
  {
    type: 'item',
    id: 'pin',
    label: view.pinned ? m.tracker_view_unpin() : m.tracker_view_pin(),
    icon: 'star',
    onSelect: () => pin.mutate({ id: view.id, pinned: !view.pinned }),
  },
  ...(mayEdit(view)
    ? [
        {
          type: 'item' as const,
          id: 'delete',
          label: m.delete(),
          icon: 'trash-2',
          danger: true,
          onSelect: () => remove.mutate(view.id),
        },
      ]
    : []),
]
</script>

{#snippet row(view: View)}
  <li>
    <a
      href={viewHref(slug, view)}
      aria-current={activeId === view.id ? 'page' : undefined}
      class="vrow"
      class:on={activeId === view.id}
      data-testid="saved-view"
      data-view-name={view.name}
    >
      <Icon name={view.icon ?? (view.layout === 'board' ? 'columns-3' : 'list')} size={14} strokeWidth={1.8} />
      <span class="vname">{view.name}</span>
    </a>
    <DropdownMenu items={menuFor(view)} align="end">
      {#snippet trigger(props)}
        <IconButton {...props} icon="ellipsis" size={22} label={m.tracker_view_actions({ name: view.name })} />
      {/snippet}
    </DropdownMenu>
  </li>
{/snippet}

<div class="views">
  {#if viewsQuery.isPending}
    <div class="loading">
      {#each [1, 2, 3] as row (row)}<Skeleton class="h-[26px] w-full" />{/each}
    </div>
  {:else if !views.length}
    <EmptyState icon="list" title={m.tracker_views_empty()} description={m.tracker_views_empty_hint()} />
  {:else}
    {#if pinned.length}
      <SectionLabel label={m.tracker_views_pinned()} />
      <ul>{#each pinned as view (view.id)}{@render row(view)}{/each}</ul>
    {/if}
    {#if rest.length}
      <SectionLabel label={m.tracker_views_all()} />
      <ul>{#each rest as view (view.id)}{@render row(view)}{/each}</ul>
    {/if}
  {/if}
</div>

<style>
.views {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.loading {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px 2px;
}
ul {
  list-style: none;
  margin: 0 0 8px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}
li {
  display: flex;
  align-items: center;
  gap: 2px;
}
.vrow {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
  height: 30px;
  padding: 0 8px;
  border-radius: 8px;
  color: var(--kern-ink-700);
  font-size: 13px;
  text-decoration: none;
}
.vrow:hover {
  background: var(--kern-surface-hover);
}
.vrow.on {
  background: var(--kern-ink-900);
  color: var(--kern-ink-inverse);
  font-weight: 500;
}
.vname {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
