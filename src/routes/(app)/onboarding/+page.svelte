<script lang="ts">
import { Button, Card, Checkbox, Field, Icon, Input, Spinner } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import { reasonOf } from '$lib/api/errors'
import { auth, authDisabled, signOut } from '$lib/auth/client'
import AuthAlert from '$lib/components/auth/AuthAlert.svelte'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * The first screen of a self-serve sign-up, and the first button anybody presses.
 *
 * Kern Cloud runs `KERN_SIGNUP=open`, so signing up signs you in and lands you here — and
 * `workspaces.create` in core refuses an address nobody has confirmed
 * (`core.workspace.email_unverified`, a `FORBIDDEN`). Until now the catch below printed
 * `err.message`, so the whole of that was the single untranslated word **"Forbidden"**, with no
 * address, no way to ask for the link again, and nothing said about an instance that cannot send
 * mail at all — which is every fresh self-host install, where the message was never going to arrive.
 *
 * So the screen branches on the *reason code* rather than on a sentence core wrote in English, and
 * it asks `users.me()` up front so it can say what is wrong before the button is pressed rather than
 * after. Three refusals can arrive from one press and each gets its own words: the address is
 * unconfirmed, this instance only lets administrators create workspaces, and the URL is taken.
 */
const api = getApi()

const me = createQuery(() => ({ queryKey: keys.me(), queryFn: () => api.users.me() }))

let name = $state('')
let slug = $state('')
let slugTouched = $state(false)
/**
 * Whether to ask every module to fill the new workspace with example content.
 *
 * On by default, and that is the finding rather than a preference: people who landed on an empty
 * workspace did not know what to do next, and people who were shown a filled one understood the
 * product in about a minute. Somebody who wants to start clean unticks one box; somebody who does
 * not know what the product looks like cannot tick a box they have no reason to.
 *
 * What it does is a *request*, not part of creating the workspace. Core publishes an event and each
 * module writes its own content in its own service, so the workspace opens immediately and fills in
 * over the next few seconds — which is why the copy says "add", not "adding".
 */
let seedDemo = $state(true)
let busy = $state(false)
let error = $state<string | null>(null)
let slugError = $state<string | null>(null)

/**
 * Whether core will refuse this person a workspace for an unconfirmed address.
 *
 * Seeded from `users.me()` so the screen is honest before anything is pressed, and flipped by the
 * refusal itself — a person can confirm the address in another tab, and the reverse race (the flag
 * clears server-side while this page is open) is what the "I have confirmed it" button re-reads.
 */
let refusedUnverified = $state(false)
const unverified = $derived(refusedUnverified || me.data?.user.emailVerified === false)
const email = $derived(me.data?.user.email ?? '')

/** Set once a resend has been asked for, so the screen says what it just did. */
let resendState = $state<'idle' | 'sending' | 'sent' | 'no-mail' | 'already' | 'failed'>('idle')
let rechecking = $state(false)
let stillUnverified = $state(false)

const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)

// the URL follows the name until someone edits it by hand
$effect(() => {
  if (!slugTouched) slug = slugify(name)
})

/*
 * Reached from the form's `submit` *and* from the button's own `onclick`, because `Button` renders
 * `type="button"` — so pressing it would otherwise do nothing while Enter in a field still worked.
 * `busy` is a plain flag checked in the same tick rather than a `disabled` attribute: the attribute
 * only reaches the button on the next render, and two quick clicks are one render apart.
 */
async function submit(e?: Event) {
  e?.preventDefault()
  if (busy) return
  busy = true
  error = null
  slugError = null
  try {
    const ws = await api.workspaces.create({ name, slug, seedDemo })
    localStorage.setItem('kern.workspace', ws.slug)
    await goto(`/${ws.slug}`)
  } catch (err) {
    /*
     * The reason code, never the message. `reasonOf` reads `data.reason` off the wire (and
     * `err.reason` for an in-process `KernError`), which is the only half of a refusal that can be
     * translated — the message is a sentence core wrote in English, and branching on it would mean
     * keeping a list of English sentences in step with a service this app does not ship with.
     */
    switch (reasonOf(err)) {
      case 'core.workspace.email_unverified':
        refusedUnverified = true
        break
      case 'core.workspace.create':
        error = m.onboarding_admins_only()
        break
      case 'core.workspace.slug_taken':
        slugError = m.onboarding_slug_taken()
        break
      default:
        error = err instanceof Error ? err.message : m.error_generic()
    }
  } finally {
    busy = false
  }
}

/**
 * Ask for the confirmation link again.
 *
 * Better Auth's `/send-verification-email` **awaits** the send when there is a session and does not
 * swallow the throw — unlike the send on sign-up, which goes through `runInBackgroundOrAwait` and
 * answers 200 whatever happens. That is what makes this the one place in the product that can tell
 * somebody the truth about an instance with no relay: core converts `MailNotConfiguredError` into a
 * 503 carrying `MAIL_NOT_CONFIGURED`, and it reaches us.
 */
async function resend() {
  if (resendState === 'sending') return
  resendState = 'sending'
  stillUnverified = false
  // Mock mode has no auth server at all; say it landed so the state is still reachable for a demo.
  if (authDisabled()) {
    resendState = 'sent'
    return
  }
  const res = await auth.sendVerificationEmail({ email, callbackURL: '/onboarding' })
  if (!res.error) {
    resendState = 'sent'
    return
  }
  const code = res.error.code
  if (code === 'MAIL_NOT_CONFIGURED') resendState = 'no-mail'
  else if (code === 'EMAIL_ALREADY_VERIFIED') resendState = 'already'
  else resendState = 'failed'
}

/** Re-read the session after somebody says they have opened the link. */
async function recheck() {
  if (rechecking) return
  rechecking = true
  stillUnverified = false
  try {
    const fresh = await me.refetch()
    if (fresh.data?.user.emailVerified) {
      refusedUnverified = false
      resendState = 'idle'
    } else {
      stillUnverified = true
    }
  } finally {
    rechecking = false
  }
}
</script>

<svelte:head><title>{m.onboarding_title()} · Kern</title></svelte:head>

<div class="grid min-h-dvh place-items-center bg-[var(--kern-canvas)] p-6">
  <Card class="w-full max-w-[440px] p-6">
    {#if me.isPending}
      <div class="grid place-items-center py-10"><Spinner /></div>
    {:else if unverified}
      <!--
        The blocking state gets the whole card rather than a banner over a form that cannot succeed.
        A form somebody can fill in and submit, that is guaranteed to be refused, is a worse screen
        than one that says plainly what has to happen first.
      -->
      <div
        class="grid h-9 w-9 place-items-center rounded-[10px] bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]"
      >
        <Icon name="mail" size={18} strokeWidth={1.7} />
      </div>
      <h1 class="mt-3.5 text-[19px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">
        {m.onboarding_verify_title()}
      </h1>
      <p class="mt-1.5 text-[13px] leading-relaxed text-[var(--kern-ink-500)]">
        {m.onboarding_verify_body()}
      </p>

      <!--
        The address, shown rather than described. Somebody who mistyped it at sign-up cannot find
        that out from "check your inbox", and it is the single most common reason the mail never
        arrives.

        Two details it is worth not getting wrong. It is **labelled** rather than boxed on its own:
        with a border and a chip ground it read as a disabled text input, which invites somebody to
        try to correct it there. And it carries `dir="ltr"`, because an address is Latin text inside
        a right-to-left paragraph — without it the bidi algorithm can move a trailing `.dev` or a
        leading digit to the wrong end and show the reader an address they never typed.
        `break-all` because an email address has no spaces to wrap at and the card is 440px.
      -->
      <div class="mt-3.5">
        <div class="text-[11.5px] uppercase tracking-[0.06em] text-[var(--kern-ink-400)]">
          {m.onboarding_verify_sent_to()}
        </div>
        <p
          dir="ltr"
          class="mt-1 break-all font-[var(--kern-font-mono)] text-[13px] text-[var(--kern-ink-900)] text-start"
        >
          {email}
        </p>
      </div>

      <div class="mt-4 grid gap-2.5">
        {#if resendState === 'sent'}
          <AuthAlert tone="success">{m.onboarding_verify_sent()}</AuthAlert>
        {:else if resendState === 'no-mail'}
          <!--
            The honest answer for a fresh self-host install with no relay. It is derived from an
            actual send that failed, not guessed from configuration this app cannot see.
          -->
          <AuthAlert tone="danger">{m.onboarding_verify_no_mail()}</AuthAlert>
        {:else if resendState === 'already'}
          <AuthAlert tone="info">{m.onboarding_verify_already()}</AuthAlert>
        {:else if resendState === 'failed'}
          <AuthAlert tone="danger">{m.error_generic()}</AuthAlert>
        {/if}
        {#if stillUnverified}
          <AuthAlert tone="info">{m.onboarding_verify_still()}</AuthAlert>
        {/if}

        <Button onclick={recheck} loading={rechecking} block>{m.onboarding_verify_recheck()}</Button>
        <Button variant="secondary" onclick={resend} loading={resendState === 'sending'} block>
          {m.onboarding_verify_resend()}
        </Button>
      </div>

      <p class="mt-5 text-center text-[12.5px] text-[var(--kern-ink-500)]">
        {m.onboarding_wrong_address()}
        <button type="button" class="link" onclick={() => signOut()}>{m.auth_sign_out()}</button>
      </p>
    {:else}
      <h1 class="text-[19px] font-semibold tracking-[-0.02em] text-[var(--kern-ink-900)]">
        {m.onboarding_title()}
      </h1>
      <p class="mt-1.5 text-[13px] leading-relaxed text-[var(--kern-ink-500)]">{m.onboarding_subtitle()}</p>

      <form class="mt-6 grid gap-4" onsubmit={submit}>
        <Field label={m.onboarding_ws_name()} id="ws-name">
          <Input id="ws-name" bind:value={name} required placeholder="Northstar" autofocus />
        </Field>
        <Field label={m.onboarding_ws_slug()} id="ws-slug" error={slugError}>
          <Input
            id="ws-slug"
            bind:value={slug}
            oninput={() => {
              slugTouched = true
              slugError = null
            }}
            required
            pattern="[a-z0-9][a-z0-9\-]*"
            class="font-[var(--kern-font-mono)]"
          />
        </Field>

        <Checkbox
          bind:checked={seedDemo}
          label={m.onboarding_seed_demo()}
          description={m.onboarding_seed_demo_hint()}
        />

        {#if error}<AuthAlert tone="danger">{error}</AuthAlert>{/if}

        <Button type="submit" onclick={submit} loading={busy} disabled={!name || !slug} class="mt-1 w-full">
          {m.onboarding_create()}
        </Button>
      </form>
    {/if}
  </Card>
</div>

<style>
  /*
   * A button that reads as a link in prose. It stays `display: inline` so it is a link in a
   * sentence rather than a 12px tap target — the same reading `ux-audit.ts` applies to the legal
   * links on the sign-up page, and the same reason.
   */
  .link {
    display: inline;
    padding: 0;
    border: 0;
    background: none;
    color: var(--kern-accent-text);
    text-decoration: underline;
    text-underline-offset: 2px;
    cursor: pointer;
    font: inherit;
  }
  .link:hover { color: var(--kern-accent-deep); }
</style>
