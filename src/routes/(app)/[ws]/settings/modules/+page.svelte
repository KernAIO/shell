<script lang="ts">
import { Badge, Button, Dialog, Icon, SearchBox, SectionLabel, Skeleton, Switch, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Modules are the unit Kern is assembled from. An instance ships them all; a workspace decides which
 * ones it uses, and everything a disabled module contributes — navigation, API routes, permissions,
 * search results — disappears for that workspace while its data stays untouched.
 *
 * Turning one off affects everybody in the workspace, so it is confirmed rather than toggled away,
 * and modules that others depend on say so instead of failing after the fact.
 */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(session.can('core.modules.manage'))

const modules = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

type Entry = NonNullable<typeof modules.data>[number]

let filter = $state('')
let pendingDisable = $state<Entry | null>(null)

const entries = $derived(modules.data ?? [])

const matches = (e: Entry) => {
  const q = filter.trim().toLowerCase()
  if (!q) return true
  return (
    e.manifest.name.toLowerCase().includes(q) ||
    (e.manifest.description ?? '').toLowerCase().includes(q) ||
    e.manifest.id.includes(q)
  )
}

const included = $derived(entries.filter((e) => e.manifest.core).filter(matches))
const enabled = $derived(entries.filter((e) => !e.manifest.core && e.state.enabled).filter(matches))
const available = $derived(entries.filter((e) => !e.manifest.core && !e.state.enabled).filter(matches))

/** Modules that are switched on and list this one as a dependency. */
const dependants = (id: string) =>
  entries.filter((e) => e.state.enabled && (e.manifest.dependsOn ?? []).includes(id))

const setEnabled = createMutation(() => ({
  mutationFn: (vars: { moduleId: string; enabled: boolean }) =>
    api.workspaces.modules.setEnabled({ workspaceId, ...vars }),
  onSuccess: (_res, vars) => {
    const name = entries.find((e) => e.manifest.id === vars.moduleId)?.manifest.name ?? vars.moduleId
    toast.success(vars.enabled ? m.modules_enabled_toast({ name }) : m.modules_disabled_toast({ name }), {
      action: {
        label: m.undo(),
        onClick: () => setEnabled.mutate({ moduleId: vars.moduleId, enabled: !vars.enabled }),
      },
    })
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

function request(entry: Entry, next: boolean) {
  if (!next) {
    // switching off hides the module for everyone in the workspace, so say what that means first
    pendingDisable = entry
    return
  }
  setEnabled.mutate({ moduleId: entry.manifest.id, enabled: true })
}

function confirmDisable() {
  if (!pendingDisable) return
  setEnabled.mutate({ moduleId: pendingDisable.manifest.id, enabled: false })
  pendingDisable = null
}

const contributions = (e: Entry) =>
  [
    e.manifest.permissions?.length
      ? m.modules_meta_permissions({ count: e.manifest.permissions.length })
      : null,
    e.manifest.objectTypes?.length ? m.modules_meta_objects({ count: e.manifest.objectTypes.length }) : null,
    e.manifest.events?.length ? m.modules_meta_events({ count: e.manifest.events.length }) : null,
  ].filter((v) => v !== null)
</script>

<svelte:head><title>{m.modules_title()} · {m.settings_title()}</title></svelte:head>

{#snippet card(entry: Entry, kind: 'core' | 'on' | 'off')}
  {@const blockedBy = kind === 'on' ? dependants(entry.manifest.id) : []}
  <article
    class="rounded-[10px] border p-4 transition-colors {kind === 'off'
      ? 'border-[var(--kern-border)] bg-[var(--kern-surface)]'
      : 'border-[var(--kern-border)] bg-[var(--kern-surface-raised)]'}"
  >
    <div class="flex items-start gap-3.5">
      <div
        class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] {kind === 'off'
          ? 'bg-[var(--kern-surface-chip)] text-[var(--kern-ink-450)]'
          : 'bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]'}"
      >
        <Icon name={entry.manifest.icon ?? 'puzzle'} size={17} />
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="text-[15px] font-medium tracking-[-0.01em] text-[var(--kern-ink-900)]">
            {entry.manifest.name}
          </h3>
          {#if kind === 'core'}
            <Badge tone="grey">{m.modules_core_badge()}</Badge>
          {:else if kind === 'on'}
            <Badge tone="success">{m.enabled()}</Badge>
          {/if}
          <span class="font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-400)]">
            {entry.manifest.version}
          </span>
        </div>

        <p class="mt-1.5 text-[13px] leading-relaxed text-[var(--kern-ink-600)]">
          {entry.manifest.description}
        </p>

        <div class="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5">
          {#each contributions(entry) as item (item)}
            <span
              class="rounded-[6px] bg-[var(--kern-surface-chip)] px-2 py-[3px] text-[12px] text-[var(--kern-ink-550)]"
            >
              {item}
            </span>
          {/each}

          {#if entry.manifest.dependsOn?.length}
            <span class="text-[12px] text-[var(--kern-ink-450)]">
              {m.modules_depends_on({ deps: entry.manifest.dependsOn.join(', ') })}
            </span>
          {/if}

          {#if kind === 'on' && entry.manifest.settingsSchema}
            <a
              href="/{slug}/settings/modules/{entry.manifest.id}"
              class="text-[12.5px] text-[var(--kern-accent-text)] hover:underline"
            >
              {m.modules_configure()}
            </a>
          {/if}
        </div>

        {#if blockedBy.length}
          <p class="mt-2.5 text-[12px] text-[var(--kern-ink-450)]">
            {m.modules_required_by({ modules: blockedBy.map((d) => d.manifest.name).join(', ') })}
          </p>
        {/if}
      </div>

      <div class="shrink-0 pt-1">
        {#if kind === 'core'}
          <span title={m.modules_core_locked()} class="grid h-[18px] w-8 place-items-center">
            <Icon name="lock" size={14} class="text-[var(--kern-ink-350)]" />
          </span>
        {:else}
          <!-- Re-created whenever the stored value changes or a pending confirmation is dismissed, so
               a cancelled switch snaps back instead of showing a state that was never saved. -->
          {#key `${entry.state.enabled}:${pendingDisable?.manifest.id === entry.manifest.id}`}
            <Switch
              checked={entry.state.enabled}
              disabled={!canManage || setEnabled.isPending || blockedBy.length > 0}
              onCheckedChange={(next) => request(entry, next)}
            />
          {/key}
        {/if}
      </div>
    </div>
  </article>
{/snippet}

<SettingsPage title={m.modules_title()} description={m.modules_page_hint()}>
  {#snippet actions()}
    <SearchBox bind:value={filter} placeholder={m.modules_search()} width="200px" />
  {/snippet}

  {#if modules.isPending}
    <div class="grid gap-2.5">
      {#each [1, 2, 3, 4] as i (i)}<Skeleton class="h-[104px] w-full rounded-[10px]" />{/each}
    </div>
  {:else}
    {#if !canManage}
      <p
        class="rounded-[9px] bg-[var(--kern-info-tint)] px-3 py-2.5 text-[12.5px] text-[var(--kern-info)]"
      >
        {m.modules_read_only()}
      </p>
    {/if}

    {#if enabled.length}
      <section>
        <SectionLabel label={m.modules_group_enabled()} count={enabled.length} />
        <div class="mt-2 grid gap-2.5">
          {#each enabled as entry (entry.manifest.id)}{@render card(entry, 'on')}{/each}
        </div>
      </section>
    {/if}

    {#if available.length}
      <section>
        <SectionLabel label={m.modules_group_available()} count={available.length} />
        <div class="mt-2 grid gap-2.5">
          {#each available as entry (entry.manifest.id)}{@render card(entry, 'off')}{/each}
        </div>
      </section>
    {/if}

    {#if included.length}
      <section>
        <SectionLabel label={m.modules_group_included()} count={included.length} />
        <p class="mb-2 mt-1 text-[12.5px] text-[var(--kern-ink-450)]">{m.modules_group_included_hint()}</p>
        <div class="grid gap-2.5">
          {#each included as entry (entry.manifest.id)}{@render card(entry, 'core')}{/each}
        </div>
      </section>
    {/if}

    {#if filter && !included.length && !enabled.length && !available.length}
      <p class="py-8 text-center text-[13px] text-[var(--kern-ink-450)]">
        {m.modules_none_match({ query: filter })}
      </p>
    {/if}
  {/if}
</SettingsPage>

<Dialog
  open={pendingDisable !== null}
  onOpenChange={(open) => {
    if (!open) pendingDisable = null
  }}
  title={pendingDisable ? m.modules_disable_title({ name: pendingDisable.manifest.name }) : ''}
  size="sm"
>
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">
    {m.modules_disable_body({ name: pendingDisable?.manifest.name ?? '' })}
  </p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (pendingDisable = null)}>{m.cancel()}</Button>
    <Button variant="danger" onclick={confirmDisable} loading={setEnabled.isPending}>
      {m.modules_disable()}
    </Button>
  {/snippet}
</Dialog>
