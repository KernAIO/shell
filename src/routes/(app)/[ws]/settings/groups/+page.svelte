<script lang="ts">
import { Avatar, Button, Dialog, EmptyState, Field, Icon, Input, Skeleton, Textarea, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { toastMutationError } from '$lib/api/mutation-errors'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/** Groups are how you address several people at once — in mentions and when granting permissions. */
const api = getApi()
const queryClient = useQueryClient()
const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')

let createOpen = $state(false)
let name = $state('')
let handle = $state('')
let description = $state('')
let handleTouched = $state(false)

const groups = createQuery(() => ({
  queryKey: keys.groups(workspaceId),
  queryFn: () => api.workspaces.groups.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

$effect(() => {
  if (!handleTouched) handle = slugify(name)
})

const create = createMutation(() => ({
  mutationFn: () =>
    api.workspaces.groups.create({ workspaceId, name, handle, description: description || null }),
  onSuccess: () => {
    toast.success(m.groups_created())
    createOpen = false
    name = ''
    handle = ''
    description = ''
    handleTouched = false
    void queryClient.invalidateQueries({ queryKey: keys.groups(workspaceId) })
  },
  onError: (err) => toastMutationError(err),
}))
</script>


<SettingsPage title={m.groups_title()} description={m.groups_empty()}>
  {#snippet actions()}
    <Button size="sm" onclick={() => (createOpen = true)}>{m.groups_new()}</Button>
  {/snippet}

  {#if groups.isPending}
    <Skeleton class="h-[180px] w-full rounded-[10px]" />
  {:else if (groups.data?.length ?? 0) === 0}
    <SettingsSection>
      <EmptyState icon="users" title={m.groups_title()} description={m.groups_empty()} compact />
    </SettingsSection>
  {:else}
    <SettingsSection flush>
      {#each groups.data! as group (group.id)}
        <div
          class="flex items-center gap-3 border-b border-[var(--kern-border-hairline)] px-[18px] py-3 last:border-0 hover:bg-[var(--kern-surface-hover)]"
        >
          <div
            class="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--kern-surface-chip)] text-[var(--kern-ink-550)]"
          >
            <Icon name="users" size={15} />
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-baseline gap-2">
              <span class="truncate text-[13.5px] font-medium text-[var(--kern-ink-900)]">{group.name}</span>
              <span class="font-[var(--kern-font-mono)] text-[11.5px] text-[var(--kern-ink-400)]">
                @{group.handle}
              </span>
            </div>
            {#if group.description}
              <p class="truncate text-[12.5px] text-[var(--kern-ink-500)]">{group.description}</p>
            {/if}
          </div>

          <span class="shrink-0 text-[12.5px] text-[var(--kern-ink-450)]">
            {m.groups_members({ count: group.memberCount })}
          </span>
        </div>
      {/each}
    </SettingsSection>
  {/if}
</SettingsPage>

<Dialog bind:open={createOpen} title={m.groups_new()} size="sm">
  <div class="grid gap-3.5">
    <Field label={m.groups_name()} id="group-name">
      {#snippet children(id)}
        <Input {id} bind:value={name} required />
      {/snippet}
    </Field>
    <Field label={m.groups_handle()} id="group-handle">
      {#snippet children(id)}
        <Input
          {id}
          bind:value={handle}
          oninput={() => (handleTouched = true)}
          class="font-[var(--kern-font-mono)]"
        />
      {/snippet}
    </Field>
    <Field label={m.groups_description()} id="group-desc" hint={m.optional()}>
      {#snippet children(id)}
        <Textarea {id} bind:value={description} rows={2} />
      {/snippet}
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (createOpen = false)}>{m.cancel()}</Button>
    <Button onclick={() => create.mutate()} disabled={!name || !handle} loading={create.isPending}>
      {m.create()}
    </Button>
  {/snippet}
</Dialog>
