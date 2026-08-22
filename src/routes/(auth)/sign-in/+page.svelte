<script lang="ts">
import { Button, Card, Field, Input, Separator, toast } from '@kernalo/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth, authDisabled, socialProviders } from '$lib/auth/client'
import * as m from '$msg'

let email = $state('')
let password = $state('')
let busy = $state(false)
let magicSent = $state(false)
let error = $state<string | null>(null)

const next = $derived(page.url.searchParams.get('next') ?? '/')
const providers = socialProviders()

async function signIn(e: SubmitEvent) {
  e.preventDefault()
  if (authDisabled()) return void goto(next)
  busy = true
  error = null
  const res = await auth.signIn.email({ email, password })
  busy = false
  if (res.error) {
    // a second factor is not a failure: continue the flow instead of showing an error
    if ((res.data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect)
      return void goto('/two-factor')
    error = res.error.message ?? m.auth_invalid_credentials()
    return
  }
  await goto(next)
}

async function sendMagicLink() {
  if (!email) {
    error = m.auth_invalid_credentials()
    return
  }
  busy = true
  const res = await auth.signIn.magicLink({ email, callbackURL: next })
  busy = false
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  magicSent = true
  toast.success(m.auth_magic_link_sent({ email }))
}

async function social(provider: 'google' | 'github' | 'microsoft') {
  await auth.signIn.social({ provider, callbackURL: next })
}
</script>

<svelte:head><title>{m.auth_sign_in()} · Kern</title></svelte:head>

<Card class="p-6">
  <h1 class="text-[17px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">{m.auth_sign_in()}</h1>
  <p class="mt-1 text-[13px] text-[var(--kern-ink-500)]">{m.auth_welcome_back()}</p>

  {#if magicSent}
    <p class="mt-5 rounded-[10px] bg-[var(--kern-success-tint)] px-3 py-2.5 text-[13px] text-[var(--kern-success)]">
      {m.auth_magic_link_sent({ email })}
    </p>
  {/if}

  <form class="mt-5 grid gap-3.5" onsubmit={signIn}>
    <Field label={m.auth_email()} id="email">
      <Input id="email" type="email" bind:value={email} autocomplete="email" required placeholder="you@example.com" />
    </Field>
    <Field label={m.auth_password()} id="password">
      <Input id="password" type="password" bind:value={password} autocomplete="current-password" required />
    </Field>

    {#if error}
      <p role="alert" class="text-[12.5px] text-[var(--kern-danger)]">{error}</p>
    {/if}

    <Button type="submit" loading={busy} class="mt-1 w-full">{m.auth_sign_in()}</Button>
  </form>

  <div class="mt-3 flex items-center justify-between text-[12.5px]">
    <button type="button" class="text-[var(--kern-accent)] hover:underline" onclick={sendMagicLink}>
      {m.auth_magic_link()}
    </button>
    <a href="/forgot" class="text-[var(--kern-ink-500)] hover:text-[var(--kern-ink-900)]">
      {m.auth_forgot_password()}
    </a>
  </div>

  {#if providers.length}
    <div class="my-5 flex items-center gap-3">
      <Separator class="flex-1" />
      <span class="text-[11.5px] uppercase tracking-wide text-[var(--kern-ink-400)]">{m.auth_or()}</span>
      <Separator class="flex-1" />
    </div>
    <div class="grid gap-2">
      {#each providers as provider (provider)}
        <Button variant="secondary" class="w-full" onclick={() => social(provider)}>
          {m.auth_continue_with({ provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
        </Button>
      {/each}
    </div>
  {/if}
</Card>

<p class="mt-4 text-center text-[13px] text-[var(--kern-ink-500)]">
  {m.auth_no_account()}
  <a href="/sign-up" class="text-[var(--kern-accent)] hover:underline">{m.auth_sign_up()}</a>
</p>
