<script lang="ts">
import { Avatar, Button, Icon, Skeleton, toast } from '@kernhq/ui'
import { createMutation, createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { reasonOf } from '$lib/api/errors'
import { auth, authDisabled } from '$lib/auth/client'
import BrandMark from '$lib/components/auth/BrandMark.svelte'
import PrefsControls from '$lib/components/auth/PrefsControls.svelte'
import * as m from '$msg'

/**
 * `/invite/:token` — the page every invitation email in the product points at.
 *
 * Outside `(app)` on purpose, and for a reason that is easy to get wrong: the person opening this
 * link very often has no account yet, and always has no workspace. `(app)/[ws]` would read the
 * first segment as a workspace slug, fail to find one called "invite", and quietly forward them to
 * somebody else's workspace or to onboarding — which is exactly what happened for as long as this
 * route did not exist. Adding a top-level directory here means adding its name to `RESERVED_SLUGS`
 * in core; `invite` has been on that list from the beginning.
 *
 * Nothing is merged into the message bundles the way `/request/:token` does, because this screen
 * mounts no module component: every string on it is the shell's own, and importing a module client
 * to reach `loadModuleMessages` would drag a module into a page strangers load.
 */
const api = getApi()

const token = $derived(page.params.token ?? '')
/** Where sign-in and sign-up bring them back to. Already encoded — it is the URL they are on. */
const here = $derived(page.url.pathname)
const signInHref = $derived(`/sign-in?next=${encodeURIComponent(here)}`)
const signUpHref = $derived(`/sign-up?next=${encodeURIComponent(here)}`)

/**
 * The invitation, read without a session.
 *
 * `workspaces.invitations.preview` is the one core procedure on this path that takes no principal,
 * which is what lets a stranger see who invited them and where *before* being asked to create an
 * account. An unknown or malformed token is an answer, not a hiccup, so it is not retried.
 */
const invitation = createQuery(() => ({
  queryKey: ['core', 'invitation', token],
  queryFn: () => api.workspaces.invitations.preview({ token }),
  enabled: Boolean(token),
  retry: false,
}))

/**
 * Who is signed in — asked of the auth server first, and of core only once it says somebody is.
 *
 * `createCoreClient`'s `onUnauthorized` sends the browser to `/sign-in` the moment any core call
 * answers 401, so asking core "who am I?" on a page a signed-out person is *meant* to read would
 * replace the invitation with a sign-in form before they ever saw it. Better Auth answers "nobody"
 * with a 200 and no user, which is a question this page can afford to ask.
 *
 * In mock mode there is no auth server at all, so the mock's own `users.me` is the whole answer —
 * including its refusal, which is what makes the signed-out half of this screen reachable in
 * `dev:mock` rather than only in production.
 */
const account = createQuery(() => ({
  queryKey: ['core', 'invitation-account'],
  queryFn: async () => {
    if (!authDisabled() && !(await auth.getSession()).data?.user) return null
    try {
      const me = await api.users.me()
      return { email: me.user.email, workspaceIds: me.workspaces.map((w) => String(w.id)) }
    } catch (err) {
      if ((err as { code?: string } | null)?.code === 'UNAUTHORIZED') return null
      throw err
    }
  },
  retry: false,
}))

const loading = $derived(invitation.isPending || account.isPending)
const workspace = $derived(invitation.data?.workspace ?? null)
const signedIn = $derived(Boolean(account.data))
const alreadyMember = $derived(
  Boolean(workspace && account.data?.workspaceIds.includes(String(workspace.id))),
)
/**
 * The address the invitation was sent to is not the one signed in.
 *
 * Checked here as well as by core, because the answer is worth giving *before* the button is
 * pressed: an invitation forwarded to a colleague, or opened on a shared machine, is a mistake to
 * explain rather than a request to refuse. Core is still the authority — its refusal lands in
 * `refusal` below and says the same thing.
 */
const wrongAccount = $derived(
  Boolean(
    invitation.data &&
      account.data &&
      account.data.email.toLowerCase() !== invitation.data.email.toLowerCase(),
  ),
)

let joining = $state(false)

/**
 * `disabled` reaches the button on the next render, and two quick clicks are one render apart —
 * so the guard is a plain flag set in the same tick as the click. A double-click on this button
 * would otherwise file two acceptances.
 */
const join = createMutation(() => ({
  mutationFn: () => api.workspaces.invitations.accept({ token }),
  onSuccess: async (joined) => {
    toast.success(m.invite_joined({ workspace: joined.name }))
    await goto(`/${joined.slug}`, { replaceState: true })
  },
  onSettled: () => {
    joining = false
  },
}))

function accept() {
  if (joining) return
  joining = true
  join.mutate()
}

/** Sign out, then come back here as somebody else. */
async function useAnotherAccount() {
  if (!authDisabled()) await auth.signOut()
  window.location.href = signInHref
}

type Panel = {
  icon: string
  tone: 'danger' | 'accent' | 'success'
  title: string
  body: string
  /** the one thing left to do, when there is one */
  action?: 'open' | 'switch'
}

/**
 * What core refused, in words rather than in its own English sentence.
 *
 * The reason code is the only part of a failure a client can translate — the message is a sentence
 * the server wrote, and rendering it shows English to a Persian reader at the exact moment they
 * need the explanation. `KernError.forbidden` puts its argument in `details` rather than in
 * `reason`, so the email mismatch is read from `permission`; every other refusal here carries a
 * proper reason.
 */
const refusal = $derived.by((): Panel | null => {
  const err = join.error
  if (!err) return null
  const data = (err as { data?: { permission?: string } } | null)?.data
  const reason = reasonOf(err)
  if (reason === 'core.invitation.expired')
    return { icon: 'clock', tone: 'danger', title: m.invite_expired_title(), body: m.invite_ask_for_new() }
  if (reason === 'core.invitation.invalid')
    return {
      icon: 'circle-x',
      tone: 'danger',
      title: m.invite_invalid_title(),
      body: m.invite_ask_for_new(),
    }
  if (reason === 'core.workspace.archived')
    return {
      icon: 'archive',
      tone: 'danger',
      title: m.invite_archived_title({ workspace: workspace?.name ?? '' }),
      body: m.invite_archived_body(),
    }
  if (reason === 'billing.seats.limit_reached')
    return {
      icon: 'users',
      tone: 'danger',
      title: m.billing_limit_seats(),
      body: m.billing_limit_seats_hint(),
    }
  if (data?.permission === 'core.invitation.email_mismatch')
    return {
      icon: 'mail',
      tone: 'danger',
      title: m.invite_wrong_account_title(),
      body: m.invite_wrong_account({
        current: account.data?.email ?? '',
        email: invitation.data?.email ?? '',
      }),
      action: 'switch',
    }
  return {
    icon: 'triangle-alert',
    tone: 'danger',
    title: m.invite_load_failed(),
    body: err instanceof Error ? err.message : m.error_generic(),
  }
})

/**
 * The one thing this screen is showing, resolved once so the markup does not re-ask.
 *
 * Order matters: a refusal the server has already given outranks anything derived from the
 * preview, and "you are already in there" outranks "this link is spent" — core's preview reports
 * an accepted invitation and a withdrawn one identically (`expired`), so somebody who simply
 * clicked the same link twice would otherwise be told their invitation had run out while they were
 * already a member.
 */
const panel = $derived.by((): Panel | null => {
  if (refusal) return refusal
  if (invitation.isError) {
    const code = (invitation.error as { code?: string } | null)?.code
    return code === 'NOT_FOUND'
      ? {
          icon: 'circle-help',
          tone: 'danger',
          title: m.invite_not_found_title(),
          body: m.invite_not_found_body(),
        }
      : {
          icon: 'triangle-alert',
          tone: 'danger',
          title: m.invite_load_failed(),
          body: m.error_generic(),
        }
  }
  if (account.isError)
    return {
      icon: 'triangle-alert',
      tone: 'danger',
      title: m.invite_load_failed(),
      body: m.error_generic(),
    }
  if (!invitation.data) return null
  if (alreadyMember)
    return {
      icon: 'circle-check',
      tone: 'success',
      title: m.invite_already_member_title({ workspace: invitation.data.workspace.name }),
      body: m.invite_already_member_body(),
      action: 'open',
    }
  if (invitation.data.expired)
    return {
      icon: 'clock',
      tone: 'danger',
      title: m.invite_invalid_title(),
      body: m.invite_invalid_body(),
    }
  if (wrongAccount)
    return {
      icon: 'mail',
      tone: 'danger',
      title: m.invite_wrong_account_title(),
      body: m.invite_wrong_account({
        current: account.data?.email ?? '',
        email: invitation.data.email,
      }),
      action: 'switch',
    }
  return null
})
</script>

<svelte:head><title>{m.invite_heading()} · Kern</title></svelte:head>

<div class="page">
  <div class="sheet">
    <header>
      <BrandMark size="lg" />
      {#if loading}
        <h1>{m.invite_heading()}</h1>
      {/if}
    </header>

    {#if loading}
      <div class="lines" aria-busy="true">
        <Skeleton width="60%" height="15px" />
        <Skeleton width="85%" height="13px" />
      </div>
    {:else if panel}
      <div class="panel">
        <span class="seal t-{panel.tone}" aria-hidden="true">
          <Icon name={panel.icon} size={20} strokeWidth={1.6} />
        </span>
        <h1>{panel.title}</h1>
        <p class="body">{panel.body}</p>
        {#if panel.action === 'open' && workspace}
          <Button href="/{workspace.slug}" icon="arrow-right">
            {m.invite_open_workspace({ workspace: workspace.name })}
          </Button>
        {:else if panel.action === 'switch'}
          <Button variant="white" onclick={useAnotherAccount}>{m.invite_use_another_account()}</Button>
        {:else}
          <Button variant="white" href="/">{m.go_home()}</Button>
        {/if}
      </div>
    {:else if invitation.data}
      {@const invite = invitation.data}
      <div class="invite">
        <!-- The workspace mark sits beside its name, not above it: stacked, it reads as a second
             logo under the instance's own and the two squares fight. -->
        <div class="who">
          <Avatar
            id={invite.workspace.id}
            name={invite.workspace.name}
            src={invite.workspace.logoUrl}
            size={40}
          />
          <h1>{m.invite_title({ workspace: invite.workspace.name })}</h1>
        </div>
        <p class="body">
          {m.invite_body({
            inviter: invite.inviter,
            email: invite.email,
            workspace: invite.workspace.name,
          })}
        </p>
      </div>

      {#if signedIn}
        <!-- `loading` is what draws the spinner and says `aria-busy`; the guard against a second
             click is `joining`, set in the same tick, because `disabled` only lands next render. -->
        <Button size="lg" block onclick={accept} loading={join.isPending}>
          {m.invite_accept()}
        </Button>
        <p class="foot">
          {m.workspaces_signed_in_as({ email: account.data?.email ?? '' })}
          <span aria-hidden="true">·</span>
          <button type="button" class="link" onclick={useAnotherAccount}>
            {m.invite_use_another_account()}
          </button>
        </p>
      {:else}
        <p class="body hint">{m.invite_sign_in_first()}</p>
        <div class="acts">
          <Button size="lg" block href={signInHref}>{m.auth_sign_in()}</Button>
          <Button size="lg" block variant="white" href={signUpHref}>{m.auth_sign_up()}</Button>
        </div>
      {/if}
    {/if}
  </div>

  <PrefsControls />
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 20px;
    min-height: 100dvh;
    padding: 40px 20px 24px;
    background: var(--kern-canvas);
  }
  .sheet {
    width: 100%;
    max-width: 420px;
    padding: 28px;
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    border-radius: 14px;
    display: grid;
    gap: 16px;
  }

  header { display: grid; gap: 12px; justify-items: start; }

  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    line-height: 1.25;
    letter-spacing: -0.02em;
    color: var(--kern-ink-900);
    text-wrap: balance;
  }
  .body {
    margin: 0;
    font-size: 13.5px;
    line-height: 1.55;
    color: var(--kern-ink-450);
    text-wrap: pretty;
  }
  .hint { color: var(--kern-ink-500); }

  .lines { display: grid; gap: 10px; }

  /* the live invitation: mark, heading and the sentence that says who sent it */
  .invite { display: grid; gap: 12px; justify-items: start; }
  .who { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .who h1 { min-width: 0; }

  /* every refusal, whatever it is: one seal, one heading, one sentence, one way forward */
  .panel { display: grid; justify-items: center; gap: 12px; padding: 6px 0 2px; text-align: center; }
  .seal {
    display: inline-grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border-radius: var(--kern-r-2xl);
  }
  .t-danger { background: var(--kern-danger-tint); color: var(--kern-danger); }
  .t-success { background: var(--kern-success-tint); color: var(--kern-success-ink); }
  .t-accent { background: var(--kern-accent-tint); color: var(--kern-accent-deep); }

  .acts { display: grid; gap: 8px; }

  .foot {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 6px;
    margin: 0;
    font-size: 12.5px;
    color: var(--kern-ink-450);
  }
  .link { color: var(--kern-accent-text); font-size: 12.5px; }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }
  .link:focus-visible { outline: 2px solid var(--kern-accent); outline-offset: 2px; border-radius: 4px; }
</style>
