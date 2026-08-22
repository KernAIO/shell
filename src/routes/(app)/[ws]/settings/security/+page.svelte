<script lang="ts">
import { Button, Field, Input, toast } from '@kernalo/ui'
import { auth, authDisabled } from '$lib/auth/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import * as m from '$msg'

/**
 * Account security. These operations belong to the identity provider rather than to a workspace, so
 * they talk to Better Auth directly and apply everywhere the account is used.
 */
let currentPassword = $state('')
let newPassword = $state('')
let busy = $state(false)

async function changePassword(event: SubmitEvent) {
  event.preventDefault()
  if (authDisabled()) return
  busy = true
  const res = await auth.changePassword({
    currentPassword,
    newPassword,
    revokeOtherSessions: true,
  })
  busy = false
  if (res.error) {
    toast.error(res.error.message ?? m.error_generic())
    return
  }
  toast.success(m.security_password_updated())
  currentPassword = ''
  newPassword = ''
}

async function addPasskey() {
  if (authDisabled()) return
  const res = await auth.passkey.addPasskey()
  if (res?.error) {
    toast.error(res.error.message ?? m.error_generic())
    return
  }
  toast.success(m.security_passkey_added())
}
</script>

<svelte:head><title>{m.security_title()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.security_title()} description={m.security_page_hint()}>
  <SettingsSection title={m.security_password()}>
    <form onsubmit={changePassword}>
      <SettingsRow label={m.security_current_password()} for="current" wide first>
        <Input id="current" type="password" bind:value={currentPassword} autocomplete="current-password" />
      </SettingsRow>
      <SettingsRow label={m.auth_new_password()} for="next" wide>
        <Input
          id="next"
          type="password"
          bind:value={newPassword}
          autocomplete="new-password"
          minlength={8}
        />
      </SettingsRow>
      <div class="flex justify-end pt-1">
        <Button type="submit" size="sm" disabled={!currentPassword || !newPassword} loading={busy}>
          {m.security_change_password()}
        </Button>
      </div>
    </form>
  </SettingsSection>

  <SettingsSection title={m.security_passkeys()} description={m.security_passkeys_hint()}>
    <SettingsRow label={m.security_passkey_add()} hint={m.security_passkey_hint()} first>
      <Button variant="secondary" size="sm" onclick={addPasskey}>{m.security_passkey_add()}</Button>
    </SettingsRow>
  </SettingsSection>

  <SettingsSection title={m.security_2fa()} description={m.security_2fa_hint()}>
    <SettingsRow label={m.security_2fa()} hint={m.security_2fa_scan()} first>
      <Button variant="secondary" size="sm" disabled>{m.security_2fa_enable()}</Button>
    </SettingsRow>
  </SettingsSection>
</SettingsPage>
