<script lang="ts">
import { Avatar, Button, Card, Field, Input, toast } from '@kernalo/ui'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

const api = getApi()
const queryClient = useQueryClient()

let name = $state('')
let username = $state('')
let loaded = $state(false)

$effect(() => {
  if (session.user && !loaded) {
    name = session.user.name
    username = session.user.username ?? ''
    loaded = true
  }
})

const save = createMutation(() => ({
  mutationFn: () => api.users.updateMe({ name, username: username || null }),
  onSuccess: () => {
    toast.success(m.profile_updated())
    void queryClient.invalidateQueries({ queryKey: ['core', 'me'] })
  },
}))
</script>

<svelte:head><title>{m.profile_title()} · {m.settings_title()}</title></svelte:head>

<Card class="p-5">
  <h2 class="text-[15px] font-semibold text-[var(--kern-ink-900)]">{m.profile_title()}</h2>

  <form
    class="mt-5 grid gap-4"
    onsubmit={(e) => {
      e.preventDefault()
      save.mutate()
    }}
  >
    <div class="flex items-center gap-3">
      <Avatar name={session.user?.name ?? ''} src={session.user?.avatarUrl} id={session.user?.id} size={48} />
      <div class="text-[12.5px] text-[var(--kern-ink-500)]">{session.user?.email}</div>
    </div>

    <Field label={m.profile_name()} id="name">
      <Input id="name" bind:value={name} required />
    </Field>
    <Field label={m.profile_username()} id="username">
      <Input id="username" bind:value={username} class="font-[var(--kern-font-mono)]" />
    </Field>

    <div><Button type="submit" loading={save.isPending}>{m.save()}</Button></div>
  </form>
</Card>
