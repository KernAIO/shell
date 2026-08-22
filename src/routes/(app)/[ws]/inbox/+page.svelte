<script lang="ts">
import { Avatar, Badge, Button, EmptyState, Page, PageHeader, Skeleton, Tabs, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { formatDateTime, relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The unified inbox. Notifications from every workspace land here — the point of Kern's
 * multi-workspace model is that you do not have to go looking in each one.
 */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))

let tab = $state<'unread' | 'all'>('unread')
let scope = $state<'workspace' | 'all'>('workspace')
let selectedId = $state<string | null>(null)

const scopeWorkspaceId = $derived(scope === 'workspace' ? workspace?.id : undefined)

const notifications = createQuery(() => ({
  queryKey: keys.notifications(`${scope}:${scopeWorkspaceId ?? 'all'}:${tab}`),
  queryFn: () =>
    api.notifications.list({
      workspaceId: scopeWorkspaceId,
      unreadOnly: tab === 'unread',
      limit: 50,
    }),
  enabled: scope === 'all' || Boolean(workspace),
}))

const items = $derived(notifications.data?.items ?? [])
const selected = $derived(items.find((n) => n.id === selectedId) ?? items[0] ?? null)

const markRead = createMutation(() => ({
  mutationFn: (ids: string[]) => api.notifications.markRead({ ids }),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['core', 'notification'] }),
}))

const markAll = createMutation(() => ({
  mutationFn: () => api.notifications.markRead({ workspaceId: scopeWorkspaceId, all: scope === 'all' }),
  onSuccess: (res) => {
    toast.success(m.inbox_marked_read({ count: res.updated }))
    void queryClient.invalidateQueries({ queryKey: ['core', 'notification'] })
  },
}))

const archive = createMutation(() => ({
  mutationFn: (id: string) => api.notifications.archive({ id }),
  onSuccess: () => {
    toast.success(m.inbox_archived())
    void queryClient.invalidateQueries({ queryKey: ['core', 'notification'] })
  },
}))

function select(id: string) {
  selectedId = id
  const n = items.find((x) => x.id === id)
  if (n && !n.readAt) markRead.mutate([n.id])
}

function open(n: (typeof items)[number]) {
  if (!n.url) return
  const target = session.workspaces.find((w) => w.id === n.workspaceId)
  void goto(`/${target?.slug ?? slug}${n.url}`)
}

const workspaceName = (id: string | null) => session.workspaces.find((w) => w.id === id)?.name ?? ''
</script>

<svelte:head><title>{m.inbox_title()} · Kern</title></svelte:head>

<Page>
  <PageHeader title={m.inbox_title()} subtitle={scope === 'all' ? m.inbox_all_workspaces() : workspace?.name}>
    {#snippet actions()}
      <Button variant="ghost" onclick={() => (scope = scope === 'all' ? 'workspace' : 'all')}>
        {scope === 'all' ? (workspace?.name ?? '') : m.inbox_all_workspaces()}
      </Button>
      <Button variant="secondary" size="sm" onclick={() => markAll.mutate()} loading={markAll.isPending}>
        {m.mark_all_read()}
      </Button>
    {/snippet}
  </PageHeader>

  <div class="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]">
    <section class="flex min-h-0 flex-col border-e border-[var(--kern-border)]">
      <div class="border-b border-[var(--kern-border)] px-3 py-2">
        <Tabs
          items={[
            { value: 'unread', label: m.inbox_tab_unread() },
            { value: 'all', label: m.inbox_tab_all() },
          ]}
          value={tab}
          onValueChange={(v) => (tab = v as 'unread' | 'all')}
        />
      </div>

      <div class="min-h-0 flex-1 overflow-y-auto">
        {#if notifications.isPending}
          <div class="grid gap-2 p-3">
            {#each [1, 2, 3, 4] as i (i)}<Skeleton class="h-14 w-full" />{/each}
          </div>
        {:else if items.length === 0}
          <div class="p-8">
            <EmptyState
              icon="check"
              title={tab === 'unread' ? m.inbox_empty_unread() : m.inbox_empty_all()}
              description={tab === 'unread' ? m.inbox_empty_unread_body() : undefined}
              compact
            />
          </div>
        {:else}
          {#each items as n (n.id)}
            <button
              type="button"
              class="flex w-full items-start gap-2.5 border-b border-[var(--kern-border-hairline)] px-3.5 py-3 text-start last:border-0 hover:bg-[var(--kern-surface-hover)] {selected?.id ===
              n.id
                ? 'bg-[var(--kern-accent-tint)]'
                : ''}"
              onclick={() => select(n.id)}
            >
              {#if !n.readAt}
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kern-accent)]"></span>
              {:else}
                <span class="mt-1.5 h-1.5 w-1.5 shrink-0"></span>
              {/if}

              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--kern-ink-900)]">{n.title}</span>
                  <time class="shrink-0 font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
                    {relativeTime(n.createdAt)}
                  </time>
                </span>
                {#if n.body}
                  <span class="mt-0.5 line-clamp-2 block text-[12.5px] text-[var(--kern-ink-500)]">{n.body}</span>
                {/if}
                {#if scope === 'all' && n.workspaceId}
                  <Badge class="mt-1.5" tone="grey">{workspaceName(n.workspaceId)}</Badge>
                {/if}
              </span>
            </button>
          {/each}
        {/if}
      </div>
    </section>

    <section class="hidden min-h-0 overflow-y-auto p-6 lg:block">
      {#if !selected}
        <EmptyState icon="inbox" title={m.inbox_select_hint()} compact />
      {:else}
        <article class="mx-auto max-w-[620px]">
          <div class="flex items-start gap-3">
            {#if selected.actor}
              <Avatar name={selected.actor.name} src={selected.actor.avatarUrl} id={selected.actor.id} size={36} />
            {/if}
            <div class="min-w-0 flex-1">
              <h1 class="text-[17px] font-semibold tracking-[-0.015em] text-[var(--kern-ink-900)]">
                {selected.title}
              </h1>
              <p class="mt-0.5 font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-400)]">
                {formatDateTime(selected.createdAt)}
                {#if selected.workspaceId}· {workspaceName(selected.workspaceId)}{/if}
              </p>
            </div>
          </div>

          {#if selected.body}
            <p class="mt-4 text-[13.5px] leading-relaxed text-[var(--kern-ink-700)]">{selected.body}</p>
          {/if}

          <div class="mt-6 flex gap-2">
            {#if selected.url}
              <Button size="sm" onclick={() => open(selected)}>{m.inbox_open_object()}</Button>
            {/if}
            <Button size="sm" variant="ghost" onclick={() => archive.mutate(selected.id)}>
              {m.inbox_archive()}
            </Button>
          </div>
        </article>
      {/if}
    </section>
  </div>
</Page>
