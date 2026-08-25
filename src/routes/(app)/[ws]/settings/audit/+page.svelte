<script lang="ts">
import { Avatar, Badge, EmptyState, Select, Skeleton } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { formatDateTime, relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/** Who changed what, and when. Every module writes here through the same activity stream. */
const api = getApi()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

let moduleFilter = $state('')

const events = createQuery(() => ({
  queryKey: [...keys.audit(workspaceId), moduleFilter],
  queryFn: () => api.workspaces.audit({ workspaceId, module: moduleFilter || undefined, limit: 50 }),
  enabled: Boolean(workspaceId),
}))

const members = createQuery(() => ({
  queryKey: keys.members(workspaceId),
  queryFn: () => api.workspaces.members.list({ workspaceId, limit: 200 }),
  enabled: Boolean(workspaceId),
}))

const actor = (id: string | null) => members.data?.items.find((mem) => mem.userId === id)?.user

const modules = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const moduleOptions = $derived([
  { value: '', label: m.audit_filter_module() },
  ...(modules.data ?? []).map((e) => ({ value: e.manifest.id, label: e.manifest.name })),
])

/** "updated" plus the fields touched reads better than an opaque action name. */
const describe = (e: NonNullable<typeof events.data>['items'][number]) => {
  const fields = e.changes?.map((c) => c.field).join(', ')
  return fields ? `${e.action} · ${fields}` : e.action
}
</script>


<SettingsPage title={m.audit_title()}>
  {#snippet actions()}
    <Select value={moduleFilter} options={moduleOptions} width="170px" onValueChange={(v) => (moduleFilter = v)} />
  {/snippet}

  {#if events.isPending}
    <Skeleton class="h-[300px] w-full rounded-[10px]" />
  {:else if (events.data?.items.length ?? 0) === 0}
    <SettingsSection>
      <EmptyState icon="scroll-text" title={m.audit_empty()} compact />
    </SettingsSection>
  {:else}
    <SettingsSection flush>
      <div
        class="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center gap-3 border-b border-[var(--kern-border)] px-[18px] py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--kern-ink-350)]"
      >
        <span>{m.audit_col_actor()}</span>
        <span>{m.audit_col_action()}</span>
        <span>{m.audit_col_target()}</span>
        <span class="text-end">{m.audit_col_when()}</span>
      </div>

      {#each events.data!.items as event (event.id)}
        {@const who = actor(event.actorId)}
        <div
          class="grid grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)_110px] items-center gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0 hover:bg-[var(--kern-surface-hover)]"
        >
          <div class="flex min-w-0 items-center gap-2">
            {#if who}
              <Avatar name={who.name} src={who.avatarUrl} id={who.id} size={22} />
              <span class="truncate text-[13px] text-[var(--kern-ink-800)]">{who.name}</span>
            {:else}
              <span class="text-[13px] text-[var(--kern-ink-450)]">{m.audit_actor_system()}</span>
            {/if}
          </div>

          <div class="flex min-w-0 items-center gap-2">
            <Badge tone="grey">{event.module}</Badge>
            <span class="truncate text-[13px] text-[var(--kern-ink-700)]">{describe(event)}</span>
          </div>

          <span class="truncate font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-450)]">
            {event.object.type}
          </span>

          <time
            class="text-end font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-400)]"
            title={formatDateTime(event.occurredAt)}
          >
            {relativeTime(event.occurredAt)}
          </time>
        </div>
      {/each}
    </SettingsSection>
  {/if}
</SettingsPage>
