<script lang="ts">
import { Button, Input, Select, Skeleton, Switch, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import { toastMutationError } from '$lib/api/mutation-errors'
import { instanceName } from '$lib/auth/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * The settings that belong to the installation rather than to a workspace.
 *
 * `admin.settings` and `admin.updateSettings` have existed in core for as long as the contract has,
 * and until now nothing called either — so on a self-hosted instance, where `install.sh` always
 * seeds `allowSignup: false`, an operator could **never open sign-up**. The setting is written once
 * on the first boot and belongs to the admin console from then on (`seedSignupPolicy`), and there
 * was no admin console for it to belong to. That is the hole this screen fills.
 *
 * **Only the fields core actually reads get a control**, and that is the whole design of this page.
 * `InstanceSettings` has seven fields; a grep of core for the ones that consume them finds exactly
 * three:
 *
 * - `allowSignup` — `src/auth/signup.ts`, enforced in `user.validateUserInfo`, which every
 *   authentication method provisions through.
 * - `allowWorkspaceCreation` — `src/modules/core/services/workspaces.ts`, checked in `create`.
 * - `supportEmail` — `src/modules/core/services/notifications.ts`, as the VAPID subject.
 *
 * `name`, `mailFrom` and `defaultLocale` are stored, returned by the procedure, and read by nothing
 * at all: the app's instance name is `PUBLIC_INSTANCE_NAME`, the mailer's sender is `MAIL_FROM`, and
 * mail's fallback language is `KERN_DEFAULT_LOCALE`. Giving them inputs would have shipped the exact
 * defect that came out of workspace settings this morning — a field that saves, reads back and
 * changes nothing, which teaches an administrator that the whole screen is decorative. They are
 * shown as read-only, saying where each one really comes from, because "where is the instance name
 * set?" is a question this is the right screen to answer.
 */
const api = getApi()
const queryClient = useQueryClient()

const settings = createQuery(() => ({
  queryKey: keys.adminSettings(),
  queryFn: () => api.admin.settings(),
}))

let allowSignup = $state(true)
let allowWorkspaceCreation = $state<'everyone' | 'admins'>('everyone')
let supportEmail = $state('')
let loaded = $state(false)

// Seeded once, so a background refetch never overwrites what somebody is part-way through typing.
$effect(() => {
  const s = settings.data
  if (s && !loaded) {
    allowSignup = s.allowSignup
    allowWorkspaceCreation = s.allowWorkspaceCreation
    supportEmail = s.supportEmail ?? ''
    loaded = true
  }
})

const patch = $derived.by(() => {
  const s = settings.data
  if (!s) return null
  const changed: Record<string, unknown> = {}
  if (allowSignup !== s.allowSignup) changed.allowSignup = allowSignup
  if (allowWorkspaceCreation !== s.allowWorkspaceCreation)
    changed.allowWorkspaceCreation = allowWorkspaceCreation
  // An emptied box means "no address", which the contract spells `null` rather than `''`.
  const nextEmail = supportEmail.trim() === '' ? null : supportEmail.trim()
  if (nextEmail !== (s.supportEmail ?? null)) changed.supportEmail = nextEmail
  return Object.keys(changed).length ? changed : null
})

const save = createMutation(() => ({
  mutationFn: () => api.admin.updateSettings((patch ?? {}) as never),
  onSuccess: () => {
    toast.success(m.admin_settings_saved())
    void queryClient.invalidateQueries({ queryKey: keys.adminSettings() })
  },
  onError: (err) => toastMutationError(err),
}))

function reset() {
  const s = settings.data
  if (!s) return
  allowSignup = s.allowSignup
  allowWorkspaceCreation = s.allowWorkspaceCreation
  supportEmail = s.supportEmail ?? ''
}

const creationOptions = $derived([
  { value: 'everyone', label: m.admin_settings_everyone() },
  { value: 'admins', label: m.admin_settings_admins() },
])

const localeNames: Record<string, string> = {
  en: 'English',
  fa: 'فارسی',
  ar: 'العربية',
  de: 'Deutsch',
  tr: 'Türkçe',
}
</script>

<SettingsPage
  title={m.admin_settings()}
  description={m.admin_settings_hint()}
  section={m.admin_title()}
>
  {#if settings.isPending}
    <Skeleton class="h-[260px] w-full rounded-[10px]" />
  {:else if settings.isError}
    <SettingsSection title={m.admin_settings()}>
      <SettingsRow label={m.error_generic()} first>
        <Button variant="secondary" size="sm" onclick={() => settings.refetch()}>{m.retry()}</Button>
      </SettingsRow>
    </SettingsSection>
  {:else}
    <SettingsSection title={m.admin_settings_access()}>
      <SettingsRow label={m.admin_settings_signup()} hint={m.admin_settings_signup_hint()} first>
        <Switch bind:checked={allowSignup} ariaLabel={m.admin_settings_signup()} />
      </SettingsRow>

      <SettingsRow
        label={m.admin_settings_ws_creation()}
        hint={m.admin_settings_ws_creation_hint()}
        for="ws-creation"
      >
        <Select
          id="ws-creation"
          bind:value={allowWorkspaceCreation}
          options={creationOptions}
          width="220px"
          ariaLabel={m.admin_settings_ws_creation()}
        />
      </SettingsRow>

      {#snippet footer()}
        <Button variant="ghost" size="sm" onclick={reset} disabled={!patch}>{m.discard()}</Button>
        <Button size="sm" onclick={() => save.mutate()} disabled={!patch} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>

    <SettingsSection title={m.admin_settings_contact()}>
      <SettingsRow
        label={m.admin_settings_support_email()}
        hint={m.admin_settings_support_email_hint()}
        for="support-email"
        wide
        first
      >
        <Input id="support-email" type="email" bind:value={supportEmail} placeholder="help@example.com" />
      </SettingsRow>

      {#snippet footer()}
        <Button variant="ghost" size="sm" onclick={reset} disabled={!patch}>{m.discard()}</Button>
        <Button size="sm" onclick={() => save.mutate()} disabled={!patch} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>

    <!--
      Read-only on purpose, and with no Save button anywhere near them. Each of these is stored by
      core and consumed by nothing; the value that is actually in force comes from the environment,
      which is what the hint names. See the note at the top of this file.
    -->
    <SettingsSection title={m.admin_settings_env()} description={m.admin_settings_env_hint()}>
      <SettingsRow label={m.admin_settings_name()} hint={m.admin_settings_name_env()} first>
        <span class="font-[var(--kern-font-mono)] text-[13px] text-[var(--kern-ink-700)]">
          {instanceName()}
        </span>
      </SettingsRow>
      <SettingsRow label={m.admin_settings_base_url()} hint={m.admin_settings_base_url_env()}>
        <span class="break-all font-[var(--kern-font-mono)] text-[13px] text-[var(--kern-ink-700)]">
          {settings.data?.baseUrl}
        </span>
      </SettingsRow>
      <SettingsRow label={m.admin_settings_default_locale()} hint={m.admin_settings_locale_env()}>
        <span class="text-[13px] text-[var(--kern-ink-700)]">
          {localeNames[settings.data?.defaultLocale ?? 'en'] ?? settings.data?.defaultLocale}
        </span>
      </SettingsRow>
      <!--
        `mailFrom` is deliberately not a fourth row here. Nothing writes it, so it is `null` on every
        instance there has ever been — the row would read "Not set" on a system that is sending mail
        perfectly well from MAIL_FROM, which is a more misleading thing to show than nothing.
      -->
    </SettingsSection>
  {/if}
</SettingsPage>
