<script lang="ts">
import { Badge, Button, EmptyState, Icon, Input, SegmentedControl, Select, Skeleton, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { relativeTime } from '$lib/format'
import { timezoneOptions } from '$lib/i18n/timezone-options'
import { timezoneList } from '$lib/i18n/timezones.svelte'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * What this instance runs, and what the newest release would change.
 *
 * Kern is released as one platform: an upgrade moves every service image and every module together,
 * so there is nothing to install per module and no button here that changes the instance. What an
 * admin gets instead is the part that is genuinely hard to find out — that a release happened, what
 * it does to the modules they use, whether anything stops them taking it — and the exact command to
 * run.
 *
 * The decision is set here; the upgrade itself always runs on the host. On `auto`, a timer there
 * asks this instance whether it may proceed and obeys the answer, so what this screen promises and
 * what happens at 03:00 are the same computation.
 */
const api = getApi()
const queryClient = useQueryClient()

const status = createQuery(() => ({
  queryKey: keys.adminUpdates(),
  queryFn: () => api.admin.updates.get(),
}))

const check = createMutation(() => ({
  mutationFn: () => api.admin.updates.check(),
  onSuccess: (next) => {
    queryClient.setQueryData(keys.adminUpdates(), next)
    toast.success(
      next.updateAvailable
        ? m.admin_updates_found({ version: next.latest?.version ?? '' })
        : m.admin_updates_current(),
    )
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

type Policy = NonNullable<typeof status.data>['policy']

const setPolicy = createMutation(() => ({
  mutationFn: (patch: Partial<Policy>) => api.admin.updates.setPolicy(patch),
  onSuccess: (next) => {
    queryClient.setQueryData(keys.adminUpdates(), next)
    toast.success(m.admin_updates_policy_saved())
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const modes = $derived([
  { value: 'off', label: m.admin_updates_mode_off() },
  { value: 'notify', label: m.admin_updates_mode_notify() },
  { value: 'auto', label: m.admin_updates_mode_auto() },
])

/**
 * The zones this browser knows, with the viewer's own first — an admin setting an overnight window
 * means overnight where they are, and picking that out of six hundred alphabetical entries is a
 * chore nobody should have to do to schedule an upgrade.
 */
const timezones = $derived.by(() => {
  const here = Intl.DateTimeFormat().resolvedOptions().timeZone
  return timezoneOptions(timezoneList([here, 'UTC']), m.profile_timezone_yours())
})

const data = $derived(status.data)
const policy = $derived(data?.policy)
const changed = $derived((data?.moduleChanges ?? []).filter((c) => c.kind !== 'unchanged'))
const unchanged = $derived((data?.moduleChanges ?? []).filter((c) => c.kind === 'unchanged').length)

let copied = $state(false)
async function copyCommand(command: string) {
  try {
    await navigator.clipboard.writeText(command)
    copied = true
    setTimeout(() => {
      copied = false
    }, 2000)
  } catch {
    toast.error(m.error_generic())
  }
}
</script>


<SettingsPage title={m.admin_updates_title()} description={m.admin_updates_hint()} section={m.nav_admin()}>
  {#snippet children()}
    {#if status.isLoading}
      <Skeleton class="h-[120px] w-full rounded-[10px]" />
      <Skeleton class="h-[220px] w-full rounded-[10px]" />
    {:else if status.isError}
      <EmptyState
        icon="triangle-alert"
        title={m.admin_updates_unavailable()}
        description={status.error instanceof Error ? status.error.message : m.error_generic()}
      >
        {#snippet actions()}
          <Button variant="secondary" onclick={() => status.refetch()}>{m.retry()}</Button>
        {/snippet}
      </EmptyState>
    {:else if data}
      <SettingsSection title={m.admin_updates_running()}>
        {#snippet children()}
          <div class="grid gap-3">
            <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span class="font-[var(--kern-font-mono)] text-[22px] text-[var(--kern-ink-900)]">
                {data.current.version}
              </span>
              {#if data.updateAvailable && data.latest}
                <Icon name="arrow-right" size={15} class="shrink-0 text-[var(--kern-ink-400)] rtl:rotate-180" />
                <span class="font-[var(--kern-font-mono)] text-[22px] text-[var(--kern-accent-deep)]">
                  {data.latest.version}
                </span>
                <Badge variant="chip" tone="accent">{m.admin_updates_available()}</Badge>
              {:else}
                <Badge variant="chip" tone="success">{m.admin_updates_up_to_date()}</Badge>
              {/if}
            </div>

            <p class="text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">
              {#if data.checkedAt}
                {m.admin_updates_checked({ when: relativeTime(data.checkedAt) })}
              {:else}
                {m.admin_updates_never_checked()}
              {/if}
            </p>

            {#if data.lastError}
              <p
                class="rounded-[8px] border border-[var(--kern-warning-tint)] bg-[var(--kern-warning-tint)] px-3 py-2 text-[12.5px] text-[var(--kern-ink-700)]"
              >
                {m.admin_updates_check_failed({ reason: data.lastError })}
              </p>
            {/if}

            <div class="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                disabled={policy?.mode === 'off' || check.isPending}
                onclick={() => check.mutate()}
              >
                {check.isPending ? m.admin_updates_checking() : m.admin_updates_check_now()}
              </Button>
              {#if data.latest?.notesUrl}
                <Button variant="ghost" href={data.latest.notesUrl} target="_blank" rel="noreferrer">
                  {m.admin_updates_release_notes()}
                </Button>
              {/if}
            </div>
          </div>
        {/snippet}
      </SettingsSection>

      {#if data.updateAvailable && data.latest}
        {#if data.blockers.length}
          <SettingsSection tone="danger" title={m.admin_updates_blocked()} description={m.admin_updates_blocked_hint()}>
            {#snippet children()}
              <ul class="grid gap-2">
                {#each data.blockers as blocker (blocker.code)}
                  <li class="flex items-start gap-2.5 text-[13px] text-[var(--kern-ink-700)]">
                    <Icon name="triangle-alert" size={15} class="mt-0.5 shrink-0 text-[var(--kern-danger)]" />
                    <span>{blocker.message}</span>
                  </li>
                {/each}
              </ul>
            {/snippet}
          </SettingsSection>
        {:else if data.command}
          <SettingsSection title={m.admin_updates_how()} description={m.admin_updates_how_hint()}>
            {#snippet children()}
              <div class="grid gap-2.5">
                <div
                  class="flex items-center gap-3 overflow-x-auto rounded-[8px] border border-[var(--kern-border)] bg-[var(--kern-surface)] px-3 py-2.5"
                >
                  <code class="flex-1 whitespace-pre font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-900)]" dir="ltr">
                    {data.command}
                  </code>
                  <Button variant="ghost" onclick={() => copyCommand(data.command ?? '')}>
                    {copied ? m.copied() : m.copy()}
                  </Button>
                </div>
                <p class="text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">
                  {m.admin_updates_backup_note()}
                </p>
              </div>
            {/snippet}
          </SettingsSection>
        {/if}

        <SettingsSection title={m.admin_updates_changes()} description={m.admin_updates_changes_hint()}>
          {#snippet children()}
            {#if changed.length === 0}
              <p class="text-[13px] text-[var(--kern-ink-500)]">{m.admin_updates_no_module_changes()}</p>
            {:else}
              <ul class="grid gap-1.5">
                {#each changed as change (change.moduleId)}
                  <li
                    class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-[8px] px-2 py-1.5 hover:bg-[var(--kern-surface-hover)]"
                  >
                    <span class="min-w-[120px] flex-1 text-[13px] text-[var(--kern-ink-900)]">
                      {change.moduleId}
                    </span>
                    <span class="font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-450)]" dir="ltr">
                      {change.from ?? '—'}
                    </span>
                    <Icon name="arrow-right" size={13} class="shrink-0 text-[var(--kern-ink-400)] rtl:rotate-180" />
                    <span class="font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-900)]" dir="ltr">
                      {change.to ?? '—'}
                    </span>
                    <Badge variant="chip" tone={change.kind === 'added' ? 'success' : change.kind === 'removed' ? 'danger' : 'info'}>
                      {change.kind === 'added'
                        ? m.admin_updates_module_added()
                        : change.kind === 'removed'
                          ? m.admin_updates_module_removed()
                          : m.admin_updates_module_changed()}
                    </Badge>
                  </li>
                {/each}
              </ul>
            {/if}
            {#if unchanged}
              <p class="mt-3 text-[12.5px] text-[var(--kern-ink-450)]">
                {m.admin_updates_unchanged({ count: unchanged })}
              </p>
            {/if}
          {/snippet}
        </SettingsSection>
      {/if}

      <SettingsSection title={m.admin_updates_modules()} description={m.admin_updates_modules_hint()}>
        {#snippet children()}
          <ul class="grid gap-1.5">
            {#each data.current.modules as mod (mod.id)}
              <li class="flex items-center justify-between gap-3 rounded-[8px] px-2 py-1.5">
                <span class="truncate text-[13px] text-[var(--kern-ink-900)]">{mod.id}</span>
                <span class="font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-450)]" dir="ltr">
                  {mod.version}
                </span>
              </li>
            {/each}
          </ul>
        {/snippet}
      </SettingsSection>

      <SettingsSection title={m.admin_updates_channel()} description={m.admin_updates_channel_hint()}>
        {#snippet children()}
          {#if policy}
            <div class="grid gap-4">
              <SegmentedControl
                items={modes}
                value={policy.mode}
                label={m.admin_updates_mode_label()}
                onValueChange={(mode) => setPolicy.mutate({ mode: mode as Policy['mode'] })}
              />
              <p class="text-[12.5px] leading-relaxed text-[var(--kern-ink-500)]">
                {policy.mode === 'off'
                  ? m.admin_updates_mode_off_hint()
                  : policy.mode === 'notify'
                    ? m.admin_updates_mode_notify_hint()
                    : m.admin_updates_mode_auto_hint()}
              </p>

              {#if policy.mode === 'auto'}
                <div class="grid gap-1 border-t border-[var(--kern-border)] pt-3">
                  <SettingsRow label={m.admin_updates_window()} hint={m.admin_updates_window_hint()} first>
                    {#snippet children()}
                      <div class="flex items-center gap-2">
                        <Input
                          type="time"
                          value={policy.window.start}
                          class="w-[136px]"
                          onchange={(e: Event) =>
                            setPolicy.mutate({
                              window: { ...policy.window, start: (e.target as HTMLInputElement).value },
                            })}
                        />
                        <span class="text-[13px] text-[var(--kern-ink-450)]">{m.admin_updates_window_to()}</span>
                        <Input
                          type="time"
                          value={policy.window.end}
                          class="w-[136px]"
                          onchange={(e: Event) =>
                            setPolicy.mutate({
                              window: { ...policy.window, end: (e.target as HTMLInputElement).value },
                            })}
                        />
                      </div>
                    {/snippet}
                  </SettingsRow>

                  <SettingsRow label={m.admin_updates_timezone()} hint={m.admin_updates_timezone_hint()}>
                    {#snippet children()}
                      <Select
                        value={policy.timezone}
                        options={timezones}
                        width="220px"
                        onValueChange={(timezone) => setPolicy.mutate({ timezone })}
                      />
                    {/snippet}
                  </SettingsRow>

                  <SettingsRow label={m.admin_updates_settle()} hint={m.admin_updates_settle_hint()}>
                    {#snippet children()}
                      <Select
                        value={String(policy.minReleaseAgeHours)}
                        width="180px"
                        options={[
                          { value: '0', label: m.admin_updates_settle_none() },
                          { value: '24', label: m.admin_updates_settle_day() },
                          { value: '72', label: m.admin_updates_settle_days({ count: '3' }) },
                          { value: '168', label: m.admin_updates_settle_days({ count: '7' }) },
                        ]}
                        onValueChange={(v) => setPolicy.mutate({ minReleaseAgeHours: Number(v) })}
                      />
                    {/snippet}
                  </SettingsRow>
                </div>

                {#if data.plan}
                  <p
                    class="rounded-[8px] bg-[var(--kern-surface-chip)] px-3 py-2 text-[12.5px] leading-relaxed text-[var(--kern-ink-600)]"
                  >
                    <Icon
                      name={data.plan.shouldUpgrade ? 'check' : 'clock'}
                      size={14}
                      class="me-1.5 inline align-[-2px] text-[var(--kern-ink-450)]"
                    />
                    {data.plan.reason}
                  </p>
                {/if}

                <p class="text-[12.5px] leading-relaxed text-[var(--kern-ink-450)]">
                  {m.admin_updates_auto_requires_host()}
                </p>
              {/if}

              {#if data.lastAttempt}
                <div
                  class="rounded-[8px] border px-3 py-2.5 text-[12.5px] leading-relaxed {data.lastAttempt.ok
                    ? 'border-[var(--kern-border)] text-[var(--kern-ink-600)]'
                    : 'border-[var(--kern-danger-tint)] text-[var(--kern-ink-700)]'}"
                >
                  {#if data.lastAttempt.ok}
                    {m.admin_updates_last_ok({
                      version: data.lastAttempt.version,
                      when: relativeTime(data.lastAttempt.at),
                    })}
                  {:else}
                    {m.admin_updates_last_failed({
                      version: data.lastAttempt.version,
                      when: relativeTime(data.lastAttempt.at),
                      reason: data.lastAttempt.error ?? '',
                    })}
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        {/snippet}
      </SettingsSection>
    {/if}
  {/snippet}
</SettingsPage>
