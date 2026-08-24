<script lang="ts">
import { Button, Field, Icon, Input } from '@kernhq/ui'
import { auth } from '$lib/auth/client'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import * as m from '$msg'

let email = $state('')
let busy = $state(false)
let sent = $state(false)
let error = $state<string | null>(null)

async function submit(e: SubmitEvent) {
  e.preventDefault()
  busy = true
  error = null
  const res = await auth.requestPasswordReset({ email, redirectTo: '/reset' })
  busy = false
  // Better Auth answers an unknown address with success, so the page cannot be used to discover
  // which emails have accounts. An error here is a real failure — no mailer, or reset disabled.
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  sent = true
}
</script>

<svelte:head><title>{m.auth_forgot_password()} · Kern</title></svelte:head>

{#if sent}
  <div class="done">
    <span class="seal"><Icon name="mail" size={20} strokeWidth={1.6} /></span>
    <h1>{m.auth_reset_sent_title()}</h1>
    <p class="sub">{m.auth_reset_sent({ email })}</p>
    <p class="note">{m.auth_reset_sent_note()}</p>
    <div class="acts">
      <Button href="/sign-in" variant="white" size="lg">{m.auth_back_to_sign_in()}</Button>
      <Button variant="ghost" size="lg" onclick={() => (sent = false)}>{m.auth_reset_try_again()}</Button>
    </div>
  </div>
{:else}
  <h1>{m.auth_forgot_password_title()}</h1>
  <p class="sub">{m.auth_forgot_hint()}</p>

  <div class="stack">
    {#if error}<AuthAlert tone="danger">{error}</AuthAlert>{/if}

    <form class="stack" onsubmit={submit}>
      <Field label={m.auth_email()} id="email">
        <Input id="email" type="email" bind:value={email} autocomplete="email" required placeholder="you@example.com" />
      </Field>
      <Button type="submit" loading={busy} block size="lg">{m.auth_send_reset_link()}</Button>
    </form>
  </div>

  <p class="foot"><a class="link" href="/sign-in">{m.auth_back_to_sign_in()}</a></p>
{/if}

<style>
  h1 { margin: 0; font-size: 25px; font-weight: 600; line-height: 1.1; letter-spacing: -0.025em; color: var(--kern-ink-900); }
  .sub { margin: 8px 0 24px; font-size: 13.5px; line-height: 1.55; color: var(--kern-ink-500); text-wrap: pretty; }
  .stack { display: grid; gap: 14px; }
  .foot { margin: 24px 0 0; text-align: center; font-size: 13px; }
  .link { color: var(--kern-accent-text); }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }

  .done { text-align: center; }
  .seal {
    display: inline-grid; place-items: center; width: 46px; height: 46px; margin-bottom: 18px;
    border-radius: var(--kern-r-2xl); background: var(--kern-success-tint); color: var(--kern-success);
  }
  .done .sub { margin-bottom: 0; }
  .note { margin: 10px 0 0; font-size: 12.5px; line-height: 1.55; color: var(--kern-ink-400); text-wrap: pretty; }
  .acts { display: grid; gap: 8px; margin-top: 22px; }
</style>
