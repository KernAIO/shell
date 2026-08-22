<script lang="ts">
import { Button, Card, Field, Input } from '@kernalo/ui'
import { auth } from '$lib/auth/client'
import * as m from '$msg'

let email = $state('')
let busy = $state(false)
let sent = $state(false)

async function submit(e: SubmitEvent) {
  e.preventDefault()
  busy = true
  await auth.requestPasswordReset({ email, redirectTo: '/reset' })
  busy = false
  // the same confirmation shows whether or not the address exists, so the form cannot be used
  // to discover which emails have accounts
  sent = true
}
</script>

<svelte:head><title>{m.auth_forgot_password()} · Kern</title></svelte:head>

<Card class="p-6">
  <h1 class="text-[17px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">{m.auth_forgot_password()}</h1>

  {#if sent}
    <p class="mt-4 rounded-[10px] bg-[var(--kern-success-tint)] px-3 py-2.5 text-[13px] text-[var(--kern-success)]">
      {m.auth_reset_sent({ email })}
    </p>
  {:else}
    <form class="mt-5 grid gap-3.5" onsubmit={submit}>
      <Field label={m.auth_email()} id="email">
        <Input id="email" type="email" bind:value={email} autocomplete="email" required />
      </Field>
      <Button type="submit" loading={busy} class="w-full">{m.auth_send_reset_link()}</Button>
    </form>
  {/if}

  <p class="mt-4 text-center text-[13px]">
    <a href="/sign-in" class="text-[var(--kern-ink-500)] hover:text-[var(--kern-ink-900)]">{m.back()}</a>
  </p>
</Card>
