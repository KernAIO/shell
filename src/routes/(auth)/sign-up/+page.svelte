<script lang="ts">
import { Button, Card, Field, Input, Separator } from '@kernaio/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { auth, authDisabled, socialProviders } from '$lib/auth/client'
import * as m from '$msg'

let name = $state('')
let email = $state('')
let password = $state('')
let confirm = $state('')
let busy = $state(false)
let error = $state<string | null>(null)

const next = $derived(page.url.searchParams.get('next') ?? '/')
const providers = socialProviders()

async function submit(e: SubmitEvent) {
  e.preventDefault()
  if (password !== confirm) {
    error = m.auth_password_mismatch()
    return
  }
  if (authDisabled()) return void goto(next)
  busy = true
  error = null
  const res = await auth.signUp.email({ name, email, password })
  busy = false
  if (res.error) {
    error = res.error.message ?? m.error_generic()
    return
  }
  await goto(next)
}
</script>

<svelte:head><title>{m.auth_sign_up()} · Kern</title></svelte:head>

<Card class="p-6">
  <h1 class="text-[17px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">{m.auth_sign_up()}</h1>
  <p class="mt-1 text-[13px] text-[var(--kern-ink-500)]">{m.auth_create_account_subtitle()}</p>

  <form class="mt-5 grid gap-3.5" onsubmit={submit}>
    <Field label={m.auth_name()} id="name">
      <Input id="name" bind:value={name} autocomplete="name" required />
    </Field>
    <Field label={m.auth_email()} id="email">
      <Input id="email" type="email" bind:value={email} autocomplete="email" required />
    </Field>
    <Field label={m.auth_password()} id="password">
      <Input id="password" type="password" bind:value={password} autocomplete="new-password" required minlength={8} />
    </Field>
    <Field label={m.auth_confirm_password()} id="confirm">
      <Input id="confirm" type="password" bind:value={confirm} autocomplete="new-password" required />
    </Field>

    {#if error}<p role="alert" class="text-[12.5px] text-[var(--kern-danger)]">{error}</p>{/if}

    <Button type="submit" loading={busy} class="mt-1 w-full">{m.auth_sign_up()}</Button>
  </form>

  <p class="mt-3 text-[12px] leading-relaxed text-[var(--kern-ink-400)]">{m.auth_terms_note()}</p>

  {#if providers.length}
    <div class="my-5 flex items-center gap-3">
      <Separator class="flex-1" />
      <span class="text-[11.5px] uppercase tracking-wide text-[var(--kern-ink-400)]">{m.auth_or()}</span>
      <Separator class="flex-1" />
    </div>
    <div class="grid gap-2">
      {#each providers as provider (provider)}
        <Button variant="secondary" class="w-full" onclick={() => auth.signIn.social({ provider, callbackURL: next })}>
          {m.auth_continue_with({ provider: provider.charAt(0).toUpperCase() + provider.slice(1) })}
        </Button>
      {/each}
    </div>
  {/if}
</Card>

<p class="mt-4 text-center text-[13px] text-[var(--kern-ink-500)]">
  {m.auth_have_account()}
  <a href="/sign-in" class="text-[var(--kern-accent)] hover:underline">{m.auth_sign_in()}</a>
</p>
