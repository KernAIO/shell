<script lang="ts">
import { Button, Field, Input, Separator } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth, authDisabled, landingFor, legalLinks, socialProviders } from '$lib/auth/client'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import PasswordField from '$lib/components/auth/PasswordField.svelte'
import ProviderButton from '$lib/components/auth/ProviderButton.svelte'
import * as m from '$msg'

let name = $state('')
let email = $state('')
let password = $state('')
let confirm = $state('')
let busy = $state(false)
let error = $state<string | null>(null)

const next = $derived(page.url.searchParams.get('next') ?? '/')
const landing = $derived(landingFor(next))
const providers = socialProviders()

/**
 * The documents this instance asks people to agree to, if its operator has published any.
 *
 * The sentence above the button has always claimed consent; until now there was nothing to read and
 * nothing to click, which is a consent notice in appearance only. Whichever of the two the operator
 * configured is linked, and an instance that configured neither keeps the sentence alone rather than
 * growing a dead link.
 */
const legal = legalLinks()

// only complain once there is something to compare — not while the second box is still being typed
const mismatch = $derived(confirm.length > 0 && password !== confirm ? m.auth_password_mismatch() : null)

async function submit(e: SubmitEvent) {
  e.preventDefault()
  if (password !== confirm) {
    error = m.auth_password_mismatch()
    return
  }
  if (authDisabled()) return void goto(landing)
  busy = true
  error = null
  const res = await auth.signUp.email({ name, email, password })
  busy = false
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  await goto(landing)
}
</script>

<svelte:head><title>{m.auth_sign_up()} · Kern</title></svelte:head>

<h1>{m.auth_sign_up()}</h1>
<p class="sub">{m.auth_create_account_subtitle()}</p>

<div class="stack">
  {#if error}
    <AuthAlert tone="danger">{error}</AuthAlert>
  {/if}

  <form class="stack" onsubmit={submit}>
    <Field label={m.auth_name()} id="name">
      <Input id="name" bind:value={name} autocomplete="name" required placeholder="Ada Lovelace" />
    </Field>
    <Field label={m.auth_email()} id="email">
      <Input id="email" type="email" bind:value={email} autocomplete="email" required placeholder="you@example.com" />
    </Field>

    <PasswordField id="password" label={m.auth_password()} bind:value={password} autocomplete="new-password" meter />
    <PasswordField
      id="confirm"
      label={m.auth_confirm_password()}
      bind:value={confirm}
      autocomplete="new-password"
      error={mismatch}
    />

    <Button type="submit" loading={busy} disabled={mismatch !== null} block size="lg">{m.auth_sign_up()}</Button>
  </form>

  <!--
    The links stay `display: inline` inside this paragraph on purpose: that is what makes them a
    link in prose rather than a 12px tap target, for WCAG 2.5.8 and for `ux-audit.ts`, which reads
    the rule the same way. `·` is decorative and hidden from screen readers, which hear two links.
  -->
  <p class="terms">
    {m.auth_terms_note()}
    {#if legal.terms}
      <a class="legal" href={legal.terms} target="_blank" rel="noopener noreferrer">{m.auth_terms_of_service()}</a>
    {/if}
    {#if legal.terms && legal.privacy}<span aria-hidden="true">·</span>{/if}
    {#if legal.privacy}
      <a class="legal" href={legal.privacy} target="_blank" rel="noopener noreferrer">{m.auth_privacy_policy()}</a>
    {/if}
  </p>

  {#if providers.length}
    <div class="or">
      <Separator />
      <span>{m.auth_or()}</span>
      <Separator />
    </div>
    <div class="alts">
      {#each providers as provider (provider)}
        <ProviderButton
          {provider}
          disabled={busy}
          onclick={() => auth.signIn.social({ provider, callbackURL: landing })}
        />
      {/each}
    </div>
  {/if}
</div>

<p class="foot">
  {m.auth_have_account()}
  <a class="link" href="/sign-in{next === '/' ? '' : `?next=${encodeURIComponent(next)}`}">{m.auth_sign_in()}</a>
</p>

<style>
  h1 { margin: 0; font-size: 25px; font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; color: var(--kern-ink-900); }
  .sub { margin: 6px 0 24px; font-size: 13.5px; color: var(--kern-ink-500); }
  .stack { display: grid; gap: 14px; }
  .terms { margin: 0; font-size: 12px; line-height: 1.55; color: var(--kern-ink-400); text-wrap: pretty; }
  /* Underlined rather than coloured alone: this paragraph is the palest text on the screen, and a
     reader who cannot separate the accent from the muted ink still has to be able to find the two
     documents they are being asked to agree to. */
  .terms .legal { color: var(--kern-accent-text); text-decoration: underline; text-underline-offset: 2px; }
  .terms .legal:hover { color: var(--kern-accent-deep); }
  .or { display: flex; align-items: center; gap: 12px; margin: 4px 0; }
  .or :global(.ksep) { flex: 1; }
  .or span { font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--kern-ink-350); }
  .alts { display: grid; gap: 8px; }
  .foot { margin: 24px 0 0; text-align: center; font-size: 13px; color: var(--kern-ink-500); }
  .link { color: var(--kern-accent-text); }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }
</style>
