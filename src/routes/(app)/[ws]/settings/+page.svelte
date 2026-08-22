<script lang="ts">
import { Avatar, Button, Dialog, Input, Select, Skeleton, Textarea, toast } from '@kernaio/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

const workspace = createQuery(() => ({
  queryKey: keys.workspace(workspaceId),
  queryFn: () => api.workspaces.get({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

let name = $state('')
let description = $state('')
let defaultRole = $state('member')
let autoJoinDomains = $state('')
let loaded = $state(false)
let archiveOpen = $state(false)

// The form is seeded once so a background refetch never overwrites what someone is typing.
$effect(() => {
  const w = workspace.data
  if (w && !loaded) {
    name = w.name
    description = w.description ?? ''
    defaultRole = w.defaultRole
    autoJoinDomains = (w.autoJoinDomains ?? []).join(', ')
    loaded = true
  }
})

const patch = $derived.by(() => {
  const w = workspace.data
  if (!w) return null
  const domains = autoJoinDomains
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  const changed: Record<string, unknown> = {}
  if (name !== w.name) changed.name = name
  if (description !== (w.description ?? '')) changed.description = description
  if (defaultRole !== w.defaultRole) changed.defaultRole = defaultRole
  if (domains.join(',') !== (w.autoJoinDomains ?? []).join(',')) changed.autoJoinDomains = domains
  return Object.keys(changed).length ? changed : null
})

const save = createMutation(() => ({
  mutationFn: () => api.workspaces.update({ workspaceId, patch: patch ?? {} }),
  onSuccess: () => {
    toast.success(m.ws_updated())
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const archive = createMutation(() => ({
  mutationFn: () => api.workspaces.archive({ workspaceId }),
  onSuccess: () => {
    toast.success(m.ws_archived_toast())
    archiveOpen = false
    void goto('/')
  },
}))

function reset() {
  const w = workspace.data
  if (!w) return
  name = w.name
  description = w.description ?? ''
  defaultRole = w.defaultRole
  autoJoinDomains = (w.autoJoinDomains ?? []).join(', ')
}

const roleOptions = [
  { value: 'member', label: m.members_role_member() },
  { value: 'guest', label: m.members_role_guest() },
]
</script>

<svelte:head><title>{m.settings_general()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.settings_general()} description={m.settings_general_desc()}>
  {#if workspace.isPending}
    <Skeleton class="h-[280px] w-full rounded-[10px]" />
  {:else}
    <SettingsSection title={m.ws_identity()} description={m.ws_identity_hint()}>
      <SettingsRow label={m.ws_logo()} hint={m.ws_logo_hint()} first>
        <div class="flex items-center gap-3">
          <Avatar name={name} src={workspace.data?.logoUrl} id={workspaceId} size={40} />
          <Button variant="secondary" size="sm" disabled>{m.ws_logo_upload()}</Button>
        </div>
      </SettingsRow>

      <SettingsRow label={m.ws_name()} for="ws-name" wide>
        <Input id="ws-name" bind:value={name} required />
      </SettingsRow>

      <SettingsRow label={m.ws_slug()} hint={m.ws_slug_hint()} for="ws-slug" wide>
        <div
          class="flex h-9 items-center rounded-[8px] border border-[var(--kern-border-strong)] bg-[var(--kern-surface-chip)] px-3 font-[var(--kern-font-mono)] text-[13px] text-[var(--kern-ink-500)]"
        >
          <span class="text-[var(--kern-ink-400)]">/</span>{workspace.data?.slug}
        </div>
      </SettingsRow>

      <SettingsRow label={m.ws_description()} for="ws-desc" wide>
        <Textarea id="ws-desc" bind:value={description} rows={2} />
      </SettingsRow>

      {#snippet footer()}
        <Button variant="ghost" size="sm" onclick={reset} disabled={!patch}>{m.discard()}</Button>
        <Button size="sm" onclick={() => save.mutate()} disabled={!patch} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>

    <SettingsSection title={m.ws_joining()} description={m.ws_joining_hint()}>
      <SettingsRow label={m.ws_default_role()} hint={m.ws_default_role_hint()} for="ws-role" first>
        <Select id="ws-role" bind:value={defaultRole} options={roleOptions} width="180px" />
      </SettingsRow>

      <SettingsRow label={m.ws_auto_join()} hint={m.ws_auto_join_hint()} for="ws-domains" wide>
        <Input id="ws-domains" bind:value={autoJoinDomains} placeholder="example.com, team.example.com" />
      </SettingsRow>

      {#snippet footer()}
        <Button variant="ghost" size="sm" onclick={reset} disabled={!patch}>{m.discard()}</Button>
        <Button size="sm" onclick={() => save.mutate()} disabled={!patch} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>

    {#if session.can('core.workspace.delete')}
      <SettingsSection title={m.ws_danger_zone()} tone="danger">
        <SettingsRow label={m.ws_archive()} hint={m.ws_archive_hint()} first>
          <Button variant="danger" size="sm" onclick={() => (archiveOpen = true)}>{m.ws_archive()}</Button>
        </SettingsRow>
      </SettingsSection>
    {/if}
  {/if}
</SettingsPage>

<Dialog bind:open={archiveOpen} title={m.ws_archive_confirm_title({ name })} size="sm">
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">{m.ws_archive_confirm_body()}</p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (archiveOpen = false)}>{m.cancel()}</Button>
    <Button variant="danger" onclick={() => archive.mutate()} loading={archive.isPending}>
      {m.ws_archive()}
    </Button>
  {/snippet}
</Dialog>
