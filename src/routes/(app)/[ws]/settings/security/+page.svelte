<script lang="ts">
import { Badge, Button, Checkbox, Dialog, Field, Input, Skeleton, toast } from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { auth, authDisabled, instanceName } from '$lib/auth/client'
import { demoBackupCodes, demoTotpUri, groupSecret, secretFromTotpUri } from '$lib/auth/two-factor'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import QrCode from '$lib/components/QrCode.svelte'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Account security. These operations belong to the identity provider rather than to a workspace, so
 * they talk to Better Auth directly and apply everywhere the account is used.
 *
 * Two-factor authentication is the whole enrolment, not a switch: Better Auth writes the secret on
 * `enable` and only marks the account protected once a code from the authenticator comes back, so
 * a person who scans the picture and then closes the laptop is left exactly as they were. The
 * recovery codes arrive with the secret and are shown after the code is verified — once, which is
 * why the last step will not close until somebody says they have kept them.
 */
const queryClient = useQueryClient()

let currentPassword = $state('')
let newPassword = $state('')
let busy = $state(false)

/**
 * `dev:mock` has no auth server, so this is the demo's answer to "is 2FA on".
 *
 * Without it the one environment the interface is developed, demoed and audited in shows a button
 * that does nothing — the defect this screen was rebuilt to remove. Nothing here is a credential:
 * the secret and the codes are fixtures from `$lib/auth/two-factor`.
 */
let demoEnabled = $state(false)

const twoFactor = createQuery(() => ({
  queryKey: ['auth', 'two-factor'],
  queryFn: async () => {
    if (authDisabled()) return { enabled: demoEnabled }
    const res = await auth.getSession()
    if (res.error) throw new Error(res.error.message ?? m.error_generic())
    const user = res.data?.user as { twoFactorEnabled?: boolean | null } | undefined
    return { enabled: Boolean(user?.twoFactorEnabled) }
  },
}))

const enabled = $derived(twoFactor.data?.enabled ?? false)
const refreshTwoFactor = () => queryClient.invalidateQueries({ queryKey: ['auth', 'two-factor'] })

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

// ---------------------------------------------------------------------------------------------
// Two-factor enrolment
// ---------------------------------------------------------------------------------------------

/** What the dialog is in the middle of. Each intent starts at the password and ends somewhere else. */
type Intent = 'enable' | 'regenerate' | 'disable'
type Step = 'password' | 'scan' | 'codes'

let dialogOpen = $state(false)
let intent = $state<Intent>('enable')
let step = $state<Step>('password')
let password = $state('')
let code = $state('')
let totpUri = $state<string | null>(null)
let codes = $state<string[]>([])
let codesKept = $state(false)
let working = $state(false)
let dialogError = $state<string | null>(null)

const secret = $derived(totpUri ? secretFromTotpUri(totpUri) : null)
const codeReady = $derived(code.trim().length === 6)

const dialogTitle = $derived(
  step === 'codes'
    ? m.security_2fa_codes_title()
    : intent === 'disable'
      ? m.security_2fa_disable()
      : intent === 'regenerate'
        ? m.security_2fa_new_codes()
        : m.security_2fa_enable(),
)

function open(next: Intent) {
  intent = next
  step = 'password'
  password = ''
  code = ''
  totpUri = null
  codes = []
  codesKept = false
  dialogError = null
  working = false
  dialogOpen = true
}

/** Closing part-way through leaves the account where it was: nothing is written until a step ends. */
function onOpenChange(isOpen: boolean) {
  if (!isOpen) {
    password = ''
    code = ''
    codes = []
    totpUri = null
  }
}

/**
 * The password step, which is three different requests wearing one form.
 *
 * Better Auth asks for the password on all three — enabling writes a new secret, regenerating
 * throws the old codes away, and disabling removes the factor — so the guard is the same and the
 * step after it is not.
 */
async function submitPassword(event?: SubmitEvent) {
  event?.preventDefault()
  if (working || !password) return
  working = true
  dialogError = null

  if (authDisabled()) {
    // the demo has no server to ask, so it walks the same steps with the fixture secret
    if (intent === 'disable') {
      demoEnabled = false
      finish(m.security_2fa_disabled_toast())
    } else if (intent === 'regenerate') {
      codes = demoBackupCodes()
      step = 'codes'
    } else {
      totpUri = demoTotpUri(session.user?.email ?? 'you@example.com', instanceName())
      codes = demoBackupCodes()
      step = 'scan'
    }
    working = false
    return
  }

  if (intent === 'disable') {
    const res = await auth.twoFactor.disable({ password })
    working = false
    if (res.error) {
      dialogError = res.error.message ?? m.error_generic()
      return
    }
    finish(m.security_2fa_disabled_toast())
    return
  }

  if (intent === 'regenerate') {
    const res = await auth.twoFactor.generateBackupCodes({ password })
    working = false
    if (res.error) {
      dialogError = res.error.message ?? m.error_generic()
      return
    }
    codes = res.data?.backupCodes ?? []
    step = 'codes'
    return
  }

  const res = await auth.twoFactor.enable({ password })
  working = false
  if (res.error) {
    dialogError = res.error.message ?? m.error_generic()
    return
  }
  const data = res.data as { totpURI?: string; backupCodes?: string[] } | null
  totpUri = data?.totpURI ?? null
  codes = data?.backupCodes ?? []
  step = 'scan'
}

/**
 * The code from the authenticator, which is what actually turns the factor on.
 *
 * `enable` alone leaves the row unverified and the account unprotected, so this step is not a
 * confirmation screen — it is the write.
 */
async function submitCode(event?: SubmitEvent) {
  event?.preventDefault()
  if (working || !codeReady) return
  working = true
  dialogError = null

  if (authDisabled()) {
    demoEnabled = true
    working = false
    step = 'codes'
    void refreshTwoFactor()
    return
  }

  const res = await auth.twoFactor.verifyTotp({ code: code.trim() })
  working = false
  if (res.error) {
    dialogError = res.error.message ?? m.auth_two_factor_invalid()
    code = ''
    return
  }
  step = 'codes'
  void refreshTwoFactor()
}

function finish(message: string) {
  dialogOpen = false
  toast.success(message)
  void refreshTwoFactor()
}

function closeCodes() {
  dialogOpen = false
  toast.success(intent === 'regenerate' ? m.security_2fa_codes_replaced() : m.security_2fa_enabled_toast())
  void refreshTwoFactor()
}

async function copyCodes() {
  await navigator.clipboard.writeText(codes.join('\n'))
  toast.success(m.copied())
}

async function copySecret() {
  if (!secret) return
  await navigator.clipboard.writeText(secret)
  toast.success(m.copied())
}

/** Six digits and nothing else; a space pasted out of an authenticator should not fail the form. */
function onCodeInput() {
  code = code.replace(/\D/g, '').slice(0, 6)
}
</script>


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
    {#if twoFactor.isPending}
      <div class="py-2"><Skeleton height="40px" radius="8px" /></div>
    {:else if twoFactor.isError}
      <SettingsRow label={m.security_2fa()} hint={m.security_2fa_status_unknown()} first>
        <Button variant="secondary" size="sm" onclick={() => twoFactor.refetch()}>{m.retry()}</Button>
      </SettingsRow>
    {:else if enabled}
      <SettingsRow label={m.security_2fa()} hint={m.security_2fa_on_hint()} first>
        <div class="flex items-center gap-3">
          <Badge tone="success">{m.security_2fa_status_on()}</Badge>
          <Button variant="secondary" size="sm" onclick={() => open('disable')}>
            {m.security_2fa_disable()}
          </Button>
        </div>
      </SettingsRow>
      <SettingsRow label={m.security_2fa_new_codes()} hint={m.security_2fa_new_codes_hint()}>
        <Button variant="secondary" size="sm" onclick={() => open('regenerate')}>
          {m.security_2fa_new_codes()}
        </Button>
      </SettingsRow>
    {:else}
      <SettingsRow label={m.security_2fa()} hint={m.security_2fa_off_hint()} first>
        <div class="flex items-center gap-3">
          <Badge tone="grey">{m.security_2fa_status_off()}</Badge>
          <Button size="sm" onclick={() => open('enable')}>{m.security_2fa_enable()}</Button>
        </div>
      </SettingsRow>
    {/if}
  </SettingsSection>
</SettingsPage>

<Dialog bind:open={dialogOpen} title={dialogTitle} size="sm" {onOpenChange} hideClose={step === 'codes'}>
  {#if dialogError}
    <div class="alert"><AuthAlert tone="danger">{dialogError}</AuthAlert></div>
  {/if}

  {#if step === 'password'}
    <form class="stack" onsubmit={submitPassword}>
      <p class="lede">
        {intent === 'disable'
          ? m.security_2fa_disable_body()
          : intent === 'regenerate'
            ? m.security_2fa_new_codes_body()
            : m.security_2fa_enable_body()}
      </p>
      <Field label={m.security_current_password()} id="tfa-password">
        <Input
          id="tfa-password"
          type="password"
          bind:value={password}
          autocomplete="current-password"
          required
        />
      </Field>
    </form>
  {:else if step === 'scan'}
    <div class="stack">
      <p class="lede">{m.security_2fa_scan()}</p>
      {#if totpUri}
        <div class="scan">
          <QrCode value={totpUri} label={m.security_2fa_qr_label()} size={168} />
          <div class="manual">
            <span class="manual-label">{m.security_2fa_manual_key()}</span>
            <code class="key">{secret ? groupSecret(secret) : '—'}</code>
            <Button variant="ghost" size="sm" icon="copy" onclick={copySecret} disabled={!secret}>
              {m.copy()}
            </Button>
          </div>
        </div>
      {/if}
      <form class="stack" onsubmit={submitCode}>
        <Field label={m.auth_two_factor_code()} id="tfa-code">
          <Input
            id="tfa-code"
            bind:value={code}
            oninput={onCodeInput}
            autocomplete="one-time-code"
            inputmode="numeric"
            maxlength={6}
            placeholder="000000"
            mono
            required
          />
        </Field>
      </form>
    </div>
  {:else}
    <div class="stack">
      <p class="lede">{m.security_2fa_codes_hint()}</p>
      <ul class="codes">
        {#each codes as recovery (recovery)}
          <li>{recovery}</li>
        {/each}
      </ul>
      <div class="codes-actions">
        <Button variant="secondary" size="sm" icon="copy" onclick={copyCodes}>{m.copy()}</Button>
      </div>
      <Checkbox id="tfa-kept" bind:checked={codesKept} label={m.security_2fa_codes_saved()} />
    </div>
  {/if}

  {#snippet footer()}
    {#if step === 'password'}
      <Button variant="ghost" onclick={() => (dialogOpen = false)}>{m.cancel()}</Button>
      <Button
        variant={intent === 'disable' ? 'danger' : 'primary'}
        loading={working}
        disabled={!password}
        onclick={() => submitPassword()}
      >
        {intent === 'disable' ? m.security_2fa_disable() : m.action_continue()}
      </Button>
    {:else if step === 'scan'}
      <Button variant="ghost" onclick={() => (dialogOpen = false)}>{m.cancel()}</Button>
      <Button loading={working} disabled={!codeReady} onclick={() => submitCode()}>{m.auth_verify()}</Button>
    {:else}
      <Button disabled={!codesKept} onclick={closeCodes}>{m.done()}</Button>
    {/if}
  {/snippet}
</Dialog>

<style>
  .stack {
    display: grid;
    gap: 14px;
  }
  .lede {
    font-size: 13px;
    line-height: 1.55;
    color: var(--kern-ink-600);
    text-wrap: pretty;
  }
  .alert {
    margin-block-end: 14px;
  }
  /* the picture and the key it stands for, side by side down to a narrow dialog */
  .scan {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16px;
  }
  .manual {
    display: grid;
    justify-items: start;
    gap: 5px;
    min-width: 0;
    flex: 1 1 180px;
  }
  .manual-label {
    font-size: 12px;
    color: var(--kern-ink-500);
  }
  .key {
    font-family: var(--kern-font-mono);
    font-size: 13px;
    line-height: 1.6;
    letter-spacing: 0.02em;
    color: var(--kern-ink-900);
    /* a 32-character key wraps rather than pushing the dialog sideways */
    overflow-wrap: anywhere;
  }
  .codes {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
    gap: 6px 14px;
    border-radius: var(--kern-r-2xl);
    border: 1px solid var(--kern-border);
    background: var(--kern-surface-chip);
    padding: 12px 14px;
  }
  .codes li {
    font-family: var(--kern-font-mono);
    font-size: 13px;
    color: var(--kern-ink-800);
  }
  .codes-actions {
    display: flex;
    justify-content: flex-end;
  }
</style>
