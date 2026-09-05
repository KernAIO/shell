<script lang="ts">
import {
  Button,
  Dialog,
  formatDate,
  formatDateTime,
  Icon,
  Input,
  Skeleton,
  Textarea,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { dataRights, dataRightsKeys, GRACE_PERIOD_DAYS } from '$lib/api/data-rights'
import { reasonOf } from '$lib/api/errors'
import { signOut } from '$lib/auth/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Closing your own account, and calling that off inside the window the terms describe.
 *
 * Core has had `POST /api/core/account/deletion` and its two companions since erasure was built,
 * and nothing in the product ever called them: `users.status` has had a `'deleted'` value since the
 * first migration that no screen could set. The terms and the privacy policy promise both the
 * closure and the 30-day undo.
 *
 * **Closing signs you out everywhere, and that is the server's doing, not this screen's.**
 * `scheduleAccountDeletion` suspends the user and deletes every row in `mod_core.sessions`, so the
 * session this page is running on stops existing the moment the request succeeds. Nothing in the
 * app can be shown afterwards — any further call is a 401 that bounces to sign-in — so the flow
 * ends on a card that says what happened and when the data goes, and the person leaves from there.
 *
 * **The undo is reachable, and it was not when this screen was written.**
 * `DELETE /api/core/account/deletion` went through the ordinary authenticated path, and a closed
 * account is `suspended` — which `principal.ts` answers `ANONYMOUS` for on every credential path
 * there is — so it returned 401 to the only person entitled to call it, for the whole of the grace
 * period. Core's `db7c6e3` narrowed that door rather than widening it: a closed account's own
 * Better Auth session is admitted (Better Auth knows nothing of `users.status`, so signing in again
 * still works) and no machine credential is. So the flow this screen describes — close, sign in
 * again before the date, press *Keep my account* — works end to end.
 *
 * **A closure can also be refused, which is why the dialogue has an error line rather than a toast.**
 * Two reasons come back and each gets its own sentence: `core.account.sole_owner` (you are the last
 * owner of a workspace other people are still in) and `core.account.last_instance_admin` (you are
 * the last administrator of the instance — closing would leave `KERN_ADMIN_EMAIL` at boot, or SQL,
 * as the only way back in). Both are facts about what has to happen first, not failures, so they
 * belong beside the control rather than in a toast that disappears.
 */
const queryClient = useQueryClient()

const pending = createQuery(() => ({
  queryKey: dataRightsKeys.accountDeletion(),
  queryFn: () => dataRights.accountDeletion.pending(),
}))

const scheduled = $derived(pending.data ?? null)
const email = $derived(session.user?.email ?? '')

let closeOpen = $state(false)
let confirmText = $state('')
let reason = $state('')
let working = $state(false)
let closedOn = $state<string | null>(null)
let dialogError = $state<string | null>(null)

/** Typing your own address, so the most irreversible control in the product cannot be pressed by reflex. */
const confirmed = $derived(confirmText.trim().toLowerCase() === email.toLowerCase() && email.length > 0)

const close = createMutation(() => ({
  mutationFn: () => dataRights.accountDeletion.schedule(reason.trim() || undefined),
  onSuccess: (record) => {
    closeOpen = false
    // Not a toast: the session is already gone server-side, so this is the last thing the app can
    // say to this person and it has to stay on screen until they read it.
    closedOn = record.purgeAfter
  },
  onError: (err) => {
    /*
     * Two refusals that are facts about what has to happen first rather than failures, and both are
     * shown in the reader's language rather than as the English sentence core wrote. Branching on
     * the reason code is the only half of a refusal that can be translated.
     */
    const reason = reasonOf(err)
    dialogError =
      reason === 'core.account.sole_owner'
        ? m.account_close_sole_owner()
        : reason === 'core.account.last_instance_admin'
          ? m.account_close_last_admin()
          : err instanceof Error
            ? err.message
            : m.error_generic()
  },
  onSettled: () => {
    working = false
  },
}))

function confirmClose() {
  if (working || !confirmed) return
  working = true
  dialogError = null
  close.mutate()
}

let keeping = $state(false)
const keep = createMutation(() => ({
  mutationFn: () => dataRights.accountDeletion.cancel(),
  onSuccess: () => {
    toast.success(m.account_keep_toast())
    void queryClient.invalidateQueries({ queryKey: dataRightsKeys.accountDeletion() })
  },
  onError: (err) => {
    toast.error(err instanceof Error ? err.message : m.error_generic())
  },
  onSettled: () => {
    keeping = false
  },
}))

function keepAccount() {
  if (keeping) return
  keeping = true
  keep.mutate()
}
</script>

<SettingsPage title={m.account_title()} description={m.account_hint()}>
  {#if closedOn}
    <!--
      The terminal state. The session behind this page no longer exists, so there is nothing else
      the app can offer and nothing here asks the server for anything.
    -->
    <SettingsSection title={m.account_closed_title()} tone="danger">
      <div class="grid gap-3 py-1">
        <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">
          {m.account_closed_body({ date: formatDateTime(closedOn) })}
        </p>
        <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">{m.account_closed_undo()}</p>
        <div><Button variant="secondary" size="sm" onclick={() => signOut()}>{m.auth_sign_out()}</Button></div>
      </div>
    </SettingsSection>
  {:else if pending.isPending}
    <Skeleton class="h-[140px] w-full rounded-[10px]" />
  {:else if scheduled}
    <SettingsSection title={m.account_scheduled_title()} tone="danger">
      <div class="grid gap-3 py-1">
        <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">
          {m.account_scheduled_body({ date: formatDateTime(scheduled.purgeAfter) })}
        </p>
        <div>
          <Button size="sm" onclick={keepAccount} loading={keeping}>{m.account_keep()}</Button>
        </div>
      </div>
    </SettingsSection>
  {:else}
    <SettingsSection title={m.account_export_pointer_title()} description={m.account_export_pointer_hint()}>
      <div class="flex items-start gap-2.5 py-1 text-[13px] leading-relaxed text-[var(--kern-ink-600)]">
        <Icon name="info" size={15} class="mt-0.5 shrink-0" />
        <span>{m.account_export_pointer_body()}</span>
      </div>
    </SettingsSection>

    <SettingsSection title={m.account_close_title()} tone="danger">
      <div class="grid gap-x-6 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div class="min-w-0">
          <p class="text-[12.5px] leading-relaxed text-[var(--kern-ink-600)]">
            {m.account_close_hint({ days: GRACE_PERIOD_DAYS })}
          </p>
        </div>
        <div class="sm:justify-self-end">
          <Button variant="danger" size="sm" onclick={() => (closeOpen = true)}>
            {m.account_close_title()}
          </Button>
        </div>
      </div>
    </SettingsSection>
  {/if}
</SettingsPage>

<Dialog bind:open={closeOpen} title={m.account_close_title()} size="sm">
  <div class="grid gap-3.5">
    <p class="text-[13px] leading-relaxed text-[var(--kern-ink-700)]">
      {m.account_close_confirm_body({ days: GRACE_PERIOD_DAYS })}
    </p>
    <label class="grid gap-1.5">
      <span class="text-[12.5px] text-[var(--kern-ink-600)]">{m.account_close_confirm_prompt()}</span>
      <Input bind:value={confirmText} autocomplete="off" />
    </label>
    <label class="grid gap-1.5">
      <span class="text-[12.5px] text-[var(--kern-ink-600)]">{m.data_delete_reason()}</span>
      <Textarea bind:value={reason} rows={2} />
    </label>
    {#if dialogError}
      <p role="alert" class="text-[12.5px] leading-relaxed text-[var(--kern-danger)]">{dialogError}</p>
    {/if}
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (closeOpen = false)}>{m.cancel()}</Button>
    <Button variant="danger" onclick={confirmClose} disabled={!confirmed} loading={working}>
      {m.account_close_confirm()}
    </Button>
  {/snippet}
</Dialog>
