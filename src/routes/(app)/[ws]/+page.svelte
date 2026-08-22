<script lang="ts">
import { Button, Card, EmptyState, Page, PageHeader, Skeleton, StatTile } from '@kernaio/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import NotificationBell from '$lib/components/NotificationBell.svelte'
import { relativeTime, today } from '$lib/format'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

const api = getApi()
const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))

const waiting = createQuery(() => ({
  queryKey: keys.notifications(`home:${workspace?.id ?? ''}`),
  queryFn: () => api.notifications.list({ workspaceId: workspace!.id, unreadOnly: true, limit: 6 }),
  enabled: Boolean(workspace),
}))

const counts = createQuery(() => ({
  queryKey: keys.notificationCounts(),
  queryFn: () => api.notifications.counts(),
}))

const greeting = $derived.by(() => {
  const name = session.user?.name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  if (hour < 12) return m.home_greeting_morning({ name })
  if (hour < 18) return m.home_greeting_afternoon({ name })
  return m.home_greeting_evening({ name })
})

const totals = $derived.by(() => {
  const rows = counts.data ?? []
  const mine = rows.find((r) => r.workspaceId === workspace?.id)
  const live = workspace ? realtime.badges[workspace.id] : undefined
  return {
    unread: live?.unread ?? mine?.unread ?? 0,
    mentions: live?.mentions ?? mine?.mentions ?? 0,
    workspaces: session.workspaces.length,
  }
})
</script>

<svelte:head><title>{m.nav_home()} · {workspace?.name ?? 'Kern'}</title></svelte:head>

<Page>
  <PageHeader title={greeting} subtitle={today()}>
    {#snippet actions()}
      {#if workspace}
        <NotificationBell workspaceId={workspace.id} workspaceSlug={slug} />
      {/if}
    {/snippet}
  </PageHeader>

  <div class="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <Card class="p-0">
      <header class="flex items-center justify-between border-b border-[var(--kern-border)] px-4 py-3">
        <h2 class="text-[13.5px] font-semibold text-[var(--kern-ink-900)]">{m.home_inbox_preview()}</h2>
        <Button href="/{slug}/inbox" variant="ghost" size="sm">{m.home_open_inbox()}</Button>
      </header>

      {#if waiting.isPending}
        <div class="grid gap-2 p-4">
          {#each [1, 2, 3] as i (i)}<Skeleton class="h-11 w-full" />{/each}
        </div>
      {:else if (waiting.data?.items.length ?? 0) === 0}
        <div class="p-8"><EmptyState icon="check" title={m.home_inbox_empty()} compact /></div>
      {:else}
        <ul>
          {#each waiting.data!.items as n (n.id)}
            <li class="border-b border-[var(--kern-border-hairline)] last:border-0">
              <a
                href={n.url ? `/${slug}${n.url}` : `/${slug}/inbox`}
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--kern-surface-hover)]"
              >
                <span class="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--kern-accent)]"></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-[13px] text-[var(--kern-ink-900)]">{n.title}</span>
                  {#if n.body}
                    <span class="block truncate text-[12.5px] text-[var(--kern-ink-500)]">{n.body}</span>
                  {/if}
                </span>
                <time class="shrink-0 font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
                  {relativeTime(n.createdAt)}
                </time>
              </a>
            </li>
          {/each}
        </ul>
      {/if}
    </Card>

    <div class="grid content-start gap-3">
      <StatTile label={m.home_stat_unread()} value={totals.unread} href="/{slug}/inbox" />
      <StatTile label={m.home_stat_mentions()} value={totals.mentions} />
      <StatTile label={m.home_stat_workspaces()} value={totals.workspaces} />
    </div>
  </div>
</Page>
