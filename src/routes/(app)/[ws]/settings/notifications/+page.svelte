<script lang="ts">
import { Button, Checkbox, Select, Skeleton, toast } from '@kernalo/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsRow from '$lib/components/settings/SettingsRow.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { pushSubscription } from '$lib/push.svelte'
import { keys } from '$lib/query'
import * as m from '$msg'

/**
 * Which notifications reach you, and how. Types are contributed by modules, so the table grows as a
 * workspace turns modules on rather than being a fixed list.
 */
const api = getApi()
const queryClient = useQueryClient()

const types = createQuery(() => ({
  queryKey: keys.notificationTypes(),
  queryFn: () => api.notifications.types(),
}))
const settings = createQuery(() => ({
  queryKey: keys.notificationSettings(),
  queryFn: () => api.notifications.settings(),
}))

type Channel = 'inapp' | 'push' | 'email'
let overrides = $state<Record<string, Partial<Record<Channel, boolean>>>>({})
let digest = $state<string | null>(null)

const prefFor = (type: string, channel: Channel) => {
  const override = overrides[type]?.[channel]
  if (override !== undefined) return override
  const stored = settings.data?.preferences.find((p) => p.type === type)
  if (stored) return stored[channel]
  return types.data?.find((t) => t.type === type)?.defaults[channel] ?? false
}

const setPref = (type: string, channel: Channel, value: boolean) => {
  overrides = { ...overrides, [type]: { ...overrides[type], [channel]: value } }
}

const currentDigest = $derived(digest ?? settings.data?.emailDigest ?? 'daily')
const dirty = $derived(Object.keys(overrides).length > 0 || digest !== null)

const save = createMutation(() => ({
  mutationFn: () =>
    api.notifications.updateSettings({
      emailDigest: currentDigest as 'off' | 'hourly' | 'daily',
      quietHours: settings.data?.quietHours ?? null,
      preferences: (types.data ?? []).map((t) => ({
        type: t.type,
        workspaceId: null,
        inapp: prefFor(t.type, 'inapp'),
        push: prefFor(t.type, 'push'),
        email: prefFor(t.type, 'email'),
      })),
    }),
  onSuccess: () => {
    toast.success(m.notif_saved())
    overrides = {}
    digest = null
    void queryClient.invalidateQueries({ queryKey: keys.notificationSettings() })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

// the push state lives in the browser, not the API, so read it when the page opens
$effect(() => {
  void pushSubscription.refresh()
})

const digestOptions = [
  { value: 'off', label: m.notif_digest_off() },
  { value: 'hourly', label: m.notif_digest_hourly() },
  { value: 'daily', label: m.notif_digest_daily() },
]

// group by module so a long list stays readable
const grouped = $derived.by(() => {
  const out = new Map<string, NonNullable<typeof types.data>>()
  for (const t of types.data ?? []) {
    const list = out.get(t.module) ?? []
    list.push(t)
    out.set(t.module, list)
  }
  return [...out.entries()]
})
</script>

<svelte:head><title>{m.settings_notifications()} · {m.settings_title()}</title></svelte:head>

<SettingsPage title={m.notif_settings_title()} description={m.notif_settings_hint()}>
  {#if types.isPending || settings.isPending}
    <Skeleton class="h-[320px] w-full rounded-[10px]" />
  {:else}
    <SettingsSection flush>
      <div
        class="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center gap-2 border-b border-[var(--kern-border)] px-[18px] py-2.5"
      >
        <span class="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--kern-ink-350)]">
          {m.notif_col_type()}
        </span>
        {#each [m.notif_col_inapp(), m.notif_col_push(), m.notif_col_email()] as label (label)}
          <span
            class="text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--kern-ink-350)]"
          >
            {label}
          </span>
        {/each}
      </div>

      {#each grouped as [moduleId, list] (moduleId)}
        <div
          class="border-b border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-[18px] py-1.5 font-[var(--kern-font-mono)] text-[10.5px] uppercase tracking-[0.16em] text-[var(--kern-ink-400)]"
        >
          {moduleId}
        </div>
        {#each list as t (t.type)}
          <div
            class="grid grid-cols-[minmax(0,1fr)_64px_64px_64px] items-center gap-2 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-0 hover:bg-[var(--kern-surface-hover)]"
          >
            <div class="min-w-0">
              <div class="truncate text-[13px] text-[var(--kern-ink-800)]">{t.label}</div>
              {#if t.description}
                <div class="truncate text-[12px] text-[var(--kern-ink-450)]">{t.description}</div>
              {/if}
            </div>
            {#each ['inapp', 'push', 'email'] as const as channel (channel)}
              <div class="flex justify-center">
                <Checkbox
                  checked={prefFor(t.type, channel)}
                  onCheckedChange={(v) => setPref(t.type, channel, v)}
                  ariaLabel={`${t.label} · ${channel}`}
                />
              </div>
            {/each}
          </div>
        {/each}
      {/each}

      {#snippet footer()}
        <Button size="sm" onclick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>

    <SettingsSection title={m.notif_delivery()} description={m.notif_delivery_hint()}>
      <SettingsRow label={m.notif_digest()} for="digest" first>
        <Select
          id="digest"
          value={currentDigest}
          options={digestOptions}
          width="160px"
          onValueChange={(v) => (digest = v)}
        />
      </SettingsRow>

      <SettingsRow label={m.notif_col_push()} hint={pushSubscription.hint}>
        <Button
          size="sm"
          variant={pushSubscription.enabled ? 'secondary' : 'primary'}
          disabled={!pushSubscription.supported || pushSubscription.busy}
          onclick={() => pushSubscription.toggle()}
        >
          {pushSubscription.enabled ? m.notif_push_disable() : m.notif_push_enable()}
        </Button>
      </SettingsRow>

      {#snippet footer()}
        <Button size="sm" onclick={() => save.mutate()} disabled={!dirty} loading={save.isPending}>
          {m.save()}
        </Button>
      {/snippet}
    </SettingsSection>
  {/if}
</SettingsPage>
