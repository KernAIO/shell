<script lang="ts">
import { Button, Field, Input, Separator } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth, authDisabled, landingFor, socialProviders } from '$lib/auth/client'
import { twoFactorPending } from '$lib/auth/two-factor'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import PasswordField from '$lib/components/auth/PasswordField.svelte'
import ProviderButton from '$lib/components/auth/ProviderButton.svelte'
import * as m from '$msg'

let email = $state('')
let password = $state('')
let busy = $state<null | 'password' | 'magic' | 'passkey'>(null)
let magicSent = $state(false)
let error = $state<string | null>(null)

const next = $derived(page.url.searchParams.get('next') ?? '/')
const landing = $derived(landingFor(next))
const providers = socialProviders()

/**
 * A passkey button is only honest where the browser can answer it. Safari on an old macOS, a
 * hardened build with WebAuthn off, and any non-browser context all lack it, and offering a button
 * that throws is worse than not offering one.
 */
const passkeys = typeof window !== 'undefined' && 'PublicKeyCredential' in window

async function signIn(e: SubmitEvent) {
  e.preventDefault()
  if (authDisabled()) return void goto(landing)
  busy = 'password'
  error = null
  const res = await auth.signIn.email({ email, password })
  busy = null
  // a pending second factor is a success as far as the password goes, so it is answered before the
  // error branch rather than inside it — see `twoFactorPending`
  if (twoFactorPending(res)) return void goto(`/two-factor?next=${encodeURIComponent(next)}`)
  if (res.error) {
    error = res.error.message ?? m.auth_invalid_credentials()
    return
  }
  await goto(landing)
}

async function sendMagicLink() {
  if (!email) {
    error = m.auth_email_required()
    document.getElementById('email')?.focus()
    return
  }
  busy = 'magic'
  error = null
  const res = await auth.signIn.magicLink({ email, callbackURL: landing })
  busy = null
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  magicSent = true
}

async function signInWithPasskey() {
  busy = 'passkey'
  error = null
  const res = await auth.signIn.passkey()
  busy = null
  if (res?.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  await goto(landing)
}
</script>

<svelte:head><title>{m.auth_sign_in()} · Kern</title></svelte:head>

<h1>{m.auth_sign_in()}</h1>
<p class="sub">{m.auth_welcome_back()}</p>

<div class="stack">
  {#if magicSent}
    <AuthAlert tone="success">{m.auth_magic_link_sent({ email })}</AuthAlert>
  {/if}
  {#if error}
    <AuthAlert tone="danger">{error}</AuthAlert>
  {/if}

  <form class="stack" onsubmit={signIn}>
    <Field label={m.auth_email()} id="email">
      <Input id="email" type="email" bind:value={email} autocomplete="email" required placeholder="you@example.com" />
    </Field>

    <PasswordField id="password" label={m.auth_password()} bind:value={password} autocomplete="current-password">
      {#snippet aside()}
        <a class="link" href="/forgot">{m.auth_forgot_password()}</a>
      {/snippet}
    </PasswordField>

    <Button type="submit" loading={busy === 'password'} disabled={busy !== null} block size="lg">
      {m.auth_sign_in()}
    </Button>
  </form>

  <div class="or">
    <Separator />
    <span>{m.auth_or()}</span>
    <Separator />
  </div>

  <div class="alts">
    {#if passkeys}
      <Button
        variant="white"
        icon="key-round"
        block
        size="lg"
        loading={busy === 'passkey'}
        disabled={busy !== null}
        onclick={signInWithPasskey}
      >
        {m.auth_passkey()}
      </Button>
    {/if}
    <Button
      variant="white"
      icon="mail"
      block
      size="lg"
      loading={busy === 'magic'}
      disabled={busy !== null}
      onclick={sendMagicLink}
    >
      {m.auth_magic_link()}
    </Button>
    {#each providers as provider (provider)}
      <ProviderButton
        {provider}
        disabled={busy !== null}
        onclick={() => auth.signIn.social({ provider, callbackURL: landing })}
      />
    {/each}
  </div>
</div>

<p class="foot">
  {m.auth_no_account()}
  <a class="link" href="/sign-up{next === '/' ? '' : `?next=${encodeURIComponent(next)}`}">{m.auth_sign_up()}</a>
</p>

<style>
  h1 { margin: 0; font-size: 25px; font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; color: var(--kern-ink-900); }
  .sub { margin: 6px 0 24px; font-size: 13.5px; color: var(--kern-ink-500); }
  .stack { display: grid; gap: 14px; }
  .or { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
  .or :global(.ksep) { flex: 1; }
  .or span { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--kern-ink-350); }
  .alts { display: grid; gap: 8px; }
  .foot { margin: 24px 0 0; text-align: center; font-size: 13px; color: var(--kern-ink-500); }
  .link { color: var(--kern-accent-text); }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }
</style>
