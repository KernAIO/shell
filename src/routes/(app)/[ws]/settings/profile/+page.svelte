<script lang="ts">
import { Avatar, Button, Input, Select, toast } from '@kernhq/ui'
import { createMutation, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import { toastMutationError } from '$lib/api/mutation-errors'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { timezoneOptions } from '$lib/i18n/timezone-options'
import { timezoneList } from '$lib/i18n/timezones.svelte'
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
  onError: (err) => toastMutationError(err),
}))

// the browser knows every zone it supports; only the city names are ours to translate
const here = Intl.DateTimeFormat().resolvedOptions().timeZone
const zoneOptions = $derived(timezoneOptions(timezoneList([here]), m.profile_timezone_yours()))
</script>


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
      <Select id="tz" bind:value={timezone} options={zoneOptions} width="260px" />
    </SettingsRow>

    {#snippet footer()}
      <Button size="sm" onclick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
        {m.save()}
      </Button>
    {/snippet}
  </SettingsSection>
</SettingsPage>
