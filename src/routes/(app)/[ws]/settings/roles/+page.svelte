<script lang="ts">
import { Badge, Button, Checkbox, Dialog, Field, Icon, Input, Skeleton, Textarea, toast } from '@kernaio/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Roles grant permissions. Owner, admin, member and guest are built in and cannot be edited; a custom
 * role is a named set of permission keys, which modules register as they are enabled — so this list
 * describes exactly what the workspace can do today rather than a fixed catalogue.
 */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

const roles = createQuery(() => ({
  queryKey: keys.roles(workspaceId),
  queryFn: () => api.workspaces.roles.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const registry = createQuery(() => ({
  queryKey: keys.permissionRegistry(),
  queryFn: () => api.workspaces.roles.permissions(),
}))

type Role = NonNullable<typeof roles.data>[number]

let selectedId = $state<string | null>(null)
let draft = $state<Set<string> | null>(null)
let createOpen = $state(false)
let newName = $state('')
let newDescription = $state('')

const custom = $derived(roles.data ?? [])
const selected = $derived(custom.find((r) => r.id === selectedId) ?? custom[0] ?? null)

// the draft starts from the selected role and is discarded when the selection changes
$effect(() => {
  const id = selected?.id
  if (id) {
    draft = null
  }
})

const granted = $derived(draft ?? new Set(selected?.permissions ?? []))
const dirty = $derived(
  draft !== null &&
    selected !== null &&
    (draft.size !== selected.permissions.length || selected.permissions.some((p) => !draft?.has(p))),
)

function toggle(key: string, on: boolean) {
  const next = new Set(granted)
  on ? next.add(key) : next.delete(key)
  draft = next
}

/** Permissions arrive flat; grouping by module is what makes the matrix readable. */
const byModule = $derived.by(() => {
  const out = new Map<string, NonNullable<typeof registry.data>>()
  for (const p of registry.data ?? []) {
    const list = out.get(p.module) ?? []
    list.push(p)
    out.set(p.module, list)
  }
  return [...out.entries()].sort(([a], [b]) => (a === 'core' ? -1 : b === 'core' ? 1 : a.localeCompare(b)))
})

const save = createMutation(() => ({
  mutationFn: () =>
    api.workspaces.roles.update({
      workspaceId,
      id: selected!.id,
      patch: { permissions: [...granted] },
    }),
  onSuccess: () => {
    toast.success(m.roles_updated())
    draft = null
    void queryClient.invalidateQueries({ queryKey: keys.roles(workspaceId) })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const create = createMutation(() => ({
  mutationFn: () =>
    api.workspaces.roles.create({
      workspaceId,
      name: newName,
      description: newDescription || null,
      permissions: [],
    }),
  onSuccess: (role) => {
    toast.success(m.roles_created())
    createOpen = false
    newName = ''
    newDescription = ''
    selectedId = role.id
    void queryClient.invalidateQueries({ queryKey: keys.roles(workspaceId) })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const remove = createMutation(() => ({
  mutationFn: (id: string) => api.workspaces.roles.delete({ workspaceId, id }),
  onSuccess: () => {
    toast.success(m.roles_deleted())
    selectedId = null
    void queryClient.invalidateQueries({ queryKey: keys.roles(workspaceId) })
  },
}))

const BUILTIN = [
  { id: 'owner', label: m.members_role_owner(), hint: m.roles_builtin_owner() },
  { id: 'admin', label: m.members_role_admin(), hint: m.roles_builtin_admin() },
  { id: 'member', label: m.members_role_member(), hint: m.roles_builtin_member() },
  { id: 'guest', label: m.members_role_guest(), hint: m.roles_builtin_guest() },
]
</script>

<svelte:head><title>{m.roles_title()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.roles_title()} description={m.roles_page_hint()}>
  {#snippet actions()}
    <Button size="sm" onclick={() => (createOpen = true)}>{m.roles_new()}</Button>
  {/snippet}

  <SettingsSection title={m.roles_builtin()} description={m.roles_builtin_hint()} flush>
    {#each BUILTIN as role (role.id)}
      <div
        class="flex items-center gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0"
      >
        <Icon name="shield-check" size={15} class="shrink-0 text-[var(--kern-ink-400)]" />
        <span class="w-[80px] shrink-0 text-[13px] font-medium text-[var(--kern-ink-900)]">{role.label}</span>
        <span class="min-w-0 flex-1 truncate text-[12.5px] text-[var(--kern-ink-500)]">{role.hint}</span>
      </div>
    {/each}
  </SettingsSection>

  {#if roles.isPending || registry.isPending}
    <Skeleton class="h-[320px] w-full rounded-[10px]" />
  {:else if custom.length === 0}
    <SettingsSection title={m.roles_custom()}>
      <p class="py-6 text-center text-[13px] text-[var(--kern-ink-450)]">{m.roles_empty()}</p>
    </SettingsSection>
  {:else}
    <div class="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <SettingsSection title={m.roles_custom()} flush>
        {#each custom as role (role.id)}
          <button
            type="button"
            onclick={() => (selectedId = role.id)}
            class="flex w-full items-center gap-2 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 text-start last:border-0 {selected?.id ===
            role.id
              ? 'bg-[var(--kern-accent-tint)]'
              : 'hover:bg-[var(--kern-surface-hover)]'}"
          >
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[13px] text-[var(--kern-ink-900)]">{role.name}</span>
              <span class="block text-[11.5px] text-[var(--kern-ink-450)]">
                {m.roles_permission_count({ count: role.permissions.length })}
              </span>
            </span>
          </button>
        {/each}
      </SettingsSection>

      {#if selected}
        <SettingsSection
          title={selected.name}
          description={selected.description ?? m.roles_permissions_of()}
          flush
        >
          {#snippet action()}
            <Button
              variant="ghost"
              size="sm"
              onclick={() => {
                if (confirm(m.roles_delete_confirm({ name: selected.name }))) remove.mutate(selected.id)
              }}
            >
              {m.delete()}
            </Button>
          {/snippet}

          {#each byModule as [moduleId, permissions] (moduleId)}
            <div
              class="border-b border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-[18px] py-1.5 font-[var(--kern-font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-[var(--kern-ink-400)]"
            >
              {moduleId}
            </div>
            {#each permissions as permission (permission.key)}
              <label
                class="flex cursor-pointer items-start gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0 hover:bg-[var(--kern-surface-hover)]"
              >
                <span class="pt-0.5">
                  <Checkbox
                    checked={granted.has(permission.key)}
                    onCheckedChange={(v) => toggle(permission.key, v)}
                    ariaLabel={permission.label}
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="flex flex-wrap items-center gap-2">
                    <span class="text-[13px] text-[var(--kern-ink-800)]">{permission.label}</span>
                    {#if permission.dangerous}
                      <Badge tone="danger">{m.roles_dangerous()}</Badge>
                    {/if}
                  </span>
                  <span
                    class="mt-0.5 block font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-400)]"
                  >
                    {permission.key}
                  </span>
                </span>
              </label>
            {/each}
          {/each}

          {#snippet footer()}
            <Button variant="ghost" size="sm" onclick={() => (draft = null)} disabled={!dirty}>
              {m.discard()}
            </Button>
            <Button size="sm" onclick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
              {m.save()}
            </Button>
          {/snippet}
        </SettingsSection>
      {/if}
    </div>
  {/if}
</SettingsPage>

<Dialog bind:open={createOpen} title={m.roles_new()} size="sm">
  <div class="grid gap-3.5">
    <Field label={m.roles_name()} id="role-name">
      {#snippet children(id)}
        <Input {id} bind:value={newName} required />
      {/snippet}
    </Field>
    <Field label={m.roles_description()} id="role-desc" hint={m.optional()}>
      {#snippet children(id)}
        <Textarea {id} bind:value={newDescription} rows={2} />
      {/snippet}
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (createOpen = false)}>{m.cancel()}</Button>
    <Button onclick={() => create.mutate()} disabled={!newName} loading={create.isPending}>{m.create()}</Button>
  {/snippet}
</Dialog>
