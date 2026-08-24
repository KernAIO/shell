<script lang="ts">
import { Button, Checkbox, Icon, Input, Label } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth, landingFor } from '$lib/auth/client'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import * as m from '$msg'

/**
 * Where sign-in sends someone whose account carries a second factor. Better Auth has already
 * checked the password by this point and is holding the session open, so the only thing this page
 * can do is complete it — or send them back to start again.
 */
let code = $state('')
let backup = $state(false)
let trustDevice = $state(false)
let busy = $state(false)
let error = $state<string | null>(null)

const next = $derived(page.url.searchParams.get('next') ?? '/')
const landing = $derived(landingFor(next))
const ready = $derived(backup ? code.trim().length > 0 : code.trim().length === 6)

async function verify(e?: SubmitEvent) {
  e?.preventDefault()
  if (!ready || busy) return
  busy = true
  error = null
  const value = code.trim()
  const res = backup
    ? await auth.twoFactor.verifyBackupCode({ code: value, trustDevice })
    : await auth.twoFactor.verifyTotp({ code: value, trustDevice })
  busy = false
  if (res.error) {
    error = res.error.message ?? m.auth_two_factor_invalid()
    code = ''
    return
  }
  await goto(landing)
}

/** A six-digit code is finished the moment the sixth digit lands; making people press Enter is noise. */
function onInput() {
  if (!backup) code = code.replace(/\D/g, '').slice(0, 6)
  if (!backup && code.length === 6) void verify()
}

function switchMode() {
  backup = !backup
  code = ''
  error = null
}
</script>

<svelte:head><title>{m.auth_two_factor()} · Kern</title></svelte:head>

<span class="seal"><Icon name="shield-check" size={20} strokeWidth={1.6} /></span>
<h1>{m.auth_two_factor()}</h1>
<p class="sub">{backup ? m.auth_backup_code_hint() : m.auth_two_factor_hint()}</p>

<div class="stack">
  {#if error}<AuthAlert tone="danger">{error}</AuthAlert>{/if}

  <form class="stack" onsubmit={verify}>
    <div class="fld">
      <Label for="code">{backup ? m.auth_backup_code() : m.auth_two_factor_code()}</Label>
      <Input
        id="code"
        bind:value={code}
        oninput={onInput}
        autocomplete="one-time-code"
        inputmode={backup ? 'text' : 'numeric'}
        maxlength={backup ? 40 : 6}
        placeholder={backup ? 'XXXXXXXXXX' : '000000'}
        mono
        required
        autofocus
        class={backup ? undefined : 'otp'}
      />
    </div>

    <Checkbox
      id="trust"
      bind:checked={trustDevice}
      label={m.auth_trust_device()}
      description={m.auth_trust_device_hint()}
    />

    <Button type="submit" loading={busy} disabled={!ready} block size="lg">{m.auth_verify()}</Button>
  </form>

  <button type="button" class="link swap" onclick={switchMode}>
    {backup ? m.auth_use_authenticator() : m.auth_use_backup_code()}
  </button>
</div>

<p class="foot"><a class="link" href="/sign-in">{m.auth_back_to_sign_in()}</a></p>

<style>
  .seal {
    display: inline-grid; place-items: center; width: 46px; height: 46px; margin-bottom: 18px;
    border-radius: var(--kern-r-2xl); background: var(--kern-accent-tint); color: var(--kern-accent);
  }
  h1 { margin: 0; font-size: 25px; font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; color: var(--kern-ink-900); }
  .sub { margin: 8px 0 24px; font-size: 13.5px; line-height: 1.55; color: var(--kern-ink-500); text-wrap: pretty; }
  .stack { display: grid; gap: 14px; }
  .fld { display: grid; gap: 6px; }
  /* a one-time code is read back digit by digit, so it is set wide and large rather than as prose */
  .fld :global(.kin.otp input) { font-size: 19px; letter-spacing: 0.4em; text-align: center; }
  .fld :global(.kin.otp) { height: 46px; }
  .swap { justify-self: center; font-size: 13px; background: none; }
  .foot { margin: 24px 0 0; text-align: center; font-size: 13px; }
  .link { color: var(--kern-accent-text); }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }
</style>
