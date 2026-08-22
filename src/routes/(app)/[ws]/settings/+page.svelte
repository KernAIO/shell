<script lang="ts">
import { Button, Card, Field, Input, Textarea, toast } from '@kernalo/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
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
let loaded = $state(false)

// seed the form once, then leave it alone so background refetches do not overwrite typing
$effect(() => {
  if (workspace.data && !loaded) {
    name = workspace.data.name
    description = workspace.data.description ?? ''
    loaded = true
  }
})

const save = createMutation(() => ({
  mutationFn: () => api.workspaces.update({ workspaceId, patch: { name, description } }),
  onSuccess: () => {
    toast.success(m.ws_updated())
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
}))

const dirty = $derived(
  loaded && (name !== workspace.data?.name || description !== (workspace.data?.description ?? '')),
)
</script>

<svelte:head><title>{m.settings_general()} · {m.settings_title()}</title></svelte:head>

<Card class="p-5">
  <h2 class="text-[15px] font-semibold text-[var(--kern-ink-900)]">{m.settings_general()}</h2>
  <p class="mt-1 text-[12.5px] text-[var(--kern-ink-500)]">{m.settings_general_desc()}</p>

  <form
    class="mt-5 grid gap-4"
    onsubmit={(e) => {
      e.preventDefault()
      save.mutate()
    }}
  >
    <Field label={m.ws_name()} id="ws-name">
      <Input id="ws-name" bind:value={name} required />
    </Field>
    <Field label={m.ws_slug()} id="ws-slug">
      <Input id="ws-slug" value={workspace.data?.slug ?? ''} readonly class="font-[var(--kern-font-mono)]" />
    </Field>
    <Field label={m.ws_description()} id="ws-desc">
      <Textarea id="ws-desc" bind:value={description} rows={3} />
    </Field>

    <div>
      <Button type="submit" disabled={!dirty} loading={save.isPending}>{m.save()}</Button>
    </div>
  </form>
</Card>
