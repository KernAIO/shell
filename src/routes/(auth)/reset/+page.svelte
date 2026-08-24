<script lang="ts">
import { Button, Icon, toast } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth } from '$lib/auth/client'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import PasswordField from '$lib/components/auth/PasswordField.svelte'
import * as m from '$msg'

/**
 * The far end of the email from /forgot.
 *
 * Better Auth checks the token before it sends anyone here: a good link arrives as `?token=…`, a
 * stale or already-used one as `?error=INVALID_TOKEN`. So the page knows which of the two it is
 * before a single character is typed, and says so rather than letting someone choose a password
 * and then throwing it away.
 */
const token = $derived(page.url.searchParams.get('token'))
const linkBroken = $derived(!token || page.url.searchParams.has('error'))

let password = $state('')
let confirm = $state('')
let busy = $state(false)
let error = $state<string | null>(null)

const mismatch = $derived(confirm.length > 0 && password !== confirm ? m.auth_password_mismatch() : null)

async function submit(e: SubmitEvent) {
  e.preventDefault()
  if (!token) return
  if (password !== confirm) {
    error = m.auth_password_mismatch()
    return
  }
  busy = true
  error = null
  const res = await auth.resetPassword({ newPassword: password, token })
  busy = false
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  toast.success(m.auth_reset_done())
  await goto('/sign-in')
}
</script>

<svelte:head><title>{m.auth_reset_password()} · Kern</title></svelte:head>

{#if linkBroken}
  <div class="done">
    <span class="seal danger"><Icon name="triangle-alert" size={20} strokeWidth={1.6} /></span>
    <h1>{m.auth_reset_link_dead_title()}</h1>
    <p class="sub">{m.auth_reset_link_dead()}</p>
    <div class="acts">
      <Button href="/forgot" size="lg">{m.auth_send_reset_link()}</Button>
      <Button href="/sign-in" variant="ghost" size="lg">{m.auth_back_to_sign_in()}</Button>
    </div>
  </div>
{:else}
  <h1>{m.auth_reset_password()}</h1>
  <p class="sub">{m.auth_reset_hint()}</p>

  <div class="stack">
    {#if error}<AuthAlert tone="danger">{error}</AuthAlert>{/if}

    <form class="stack" onsubmit={submit}>
      <PasswordField
        id="password"
        label={m.auth_new_password()}
        bind:value={password}
        autocomplete="new-password"
        meter
        autofocus
      />
      <PasswordField
        id="confirm"
        label={m.auth_confirm_password()}
        bind:value={confirm}
        autocomplete="new-password"
        error={mismatch}
      />
      <Button type="submit" loading={busy} disabled={mismatch !== null} block size="lg">
        {m.auth_reset_password()}
      </Button>
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
    border-radius: var(--kern-r-2xl); background: var(--kern-danger-tint); color: var(--kern-danger);
  }
  .done .sub { margin-bottom: 0; }
  .acts { display: grid; gap: 8px; margin-top: 22px; }
</style>
