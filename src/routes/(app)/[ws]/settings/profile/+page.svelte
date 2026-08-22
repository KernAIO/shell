<script lang="ts">
import { Avatar, Button, Input, Select, toast } from '@kernalo/ui'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

const api = getApi()
const queryClient = useQueryClient()

let name = $state('')
let username = $state('')
let timezone = $state('UTC')
let loaded = $state(false)

$effect(() => {
  const u = session.user
  if (u && !loaded) {
    name = u.name
    username = u.username ?? ''
    timezone = u.timezone
    loaded = true
  }
})

const dirty = $derived(
  loaded &&
    (name !== session.user?.name ||
      username !== (session.user?.username ?? '') ||
      timezone !== session.user?.timezone),
)

const save = createMutation(() => ({
  mutationFn: () => api.users.updateMe({ name, username: username || null, timezone }),
  onSuccess: () => {
    toast.success(m.profile_updated())
    void queryClient.invalidateQueries({ queryKey: ['core', 'me'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

// the browser knows every zone it supports; no need to ship a list
const timezones = Intl.supportedValuesOf?.('timeZone') ?? ['UTC']
const timezoneOptions = timezones.map((tz) => ({ value: tz, label: tz.replace(/_/g, ' ') }))
</script>

<svelte:head><title>{m.profile_title()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.profile_title()} description={m.profile_hint()}>
  <SettingsSection>
    <SettingsRow label={m.profile_avatar()} hint={session.user?.email ?? ''} first>
      <div class="flex items-center gap-3">
        <Avatar name={name} src={session.user?.avatarUrl} id={session.user?.id} size={44} />
        <Button variant="secondary" size="sm" disabled>{m.ws_logo_upload()}</Button>
      </div>
    </SettingsRow>

    <SettingsRow label={m.profile_name()} for="name" wide>
      <Input id="name" bind:value={name} required />
    </SettingsRow>

    <SettingsRow label={m.profile_username()} hint={m.profile_username_hint()} for="username" wide>
      <Input id="username" bind:value={username} class="font-[var(--kern-font-mono)]" />
    </SettingsRow>

    <SettingsRow label={m.profile_timezone()} hint={m.profile_timezone_hint()} for="tz">
      <Select id="tz" bind:value={timezone} options={timezoneOptions} width="240px" />
    </SettingsRow>

    {#snippet footer()}
      <Button size="sm" onclick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
        {m.save()}
      </Button>
    {/snippet}
  </SettingsSection>
</SettingsPage>
