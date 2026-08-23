<script lang="ts">
import { SECRET_PLACEHOLDER } from '@kernhq/module-mail/client'
import type { MailDelivery } from '@kernhq/module-mail/contract'
import { Badge, Button, Input, Select, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getMailApi } from '$lib/modules/mail/api'
import { canMail } from '$lib/modules/mail/permissions'
import { getLocale } from '$lib/paraglide/runtime'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Where this workspace's email comes from, and what it has sent.
 *
 * The module has been complete and unreachable: settings, a test send and a delivery log all had a
 * server and nothing that called them.
 *
 * Without a provider the workspace falls back to the instance's own configuration, which is why a
 * fresh self-hosted install already delivers invitations and password resets — so "use the instance
 * default" is a real choice rather than an unconfigured state.
 */
const api = getMailApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canMail('settingsManage'))
const canSeeLog = $derived(canMail('deliveriesView'))

type Provider = 'platform' | 'smtp' | 'mailgun' | 'ses' | 'postmark' | 'resend'

/**
 * What each provider needs. Carried over from the module package, which is where this screen used
 * to live before it could be rendered.
 */
const FIELDS: Record<Provider, Array<{ key: string; label: () => string; type?: string; hint?: string }>> = {
  platform: [],
  smtp: [
    { key: 'host', label: m.mail_field_host },
    { key: 'port', label: m.mail_field_port, type: 'number' },
    { key: 'user', label: m.mail_field_user },
    { key: 'pass', label: m.mail_field_password, type: 'password' },
    { key: 'from', label: m.mail_field_from, hint: 'Kern <no-reply@example.com>' },
  ],
  mailgun: [
    { key: 'apiKey', label: m.mail_field_api_key, type: 'password' },
    { key: 'domain', label: m.mail_field_domain },
    { key: 'region', label: m.mail_field_region, hint: 'us / eu' },
    { key: 'from', label: m.mail_field_from },
  ],
  ses: [
    { key: 'accessKeyId', label: m.mail_field_access_key },
    { key: 'secretAccessKey', label: m.mail_field_secret_key, type: 'password' },
    { key: 'region', label: m.mail_field_region, hint: 'eu-west-1' },
    { key: 'from', label: m.mail_field_from },
  ],
  postmark: [
    { key: 'serverToken', label: m.mail_field_server_token, type: 'password' },
    { key: 'from', label: m.mail_field_from },
  ],
  resend: [
    { key: 'apiKey', label: m.mail_field_api_key, type: 'password' },
    { key: 'from', label: m.mail_field_from },
  ],
}

const PROVIDER_LABELS: Record<Provider, () => string> = {
  platform: m.mail_provider_platform,
  smtp: m.mail_provider_smtp,
  mailgun: m.mail_provider_mailgun,
  ses: m.mail_provider_ses,
  postmark: m.mail_provider_postmark,
  resend: m.mail_provider_resend,
}

let provider = $state<Provider>('platform')
let values = $state<Record<string, string>>({})
/** Set once from the server, so re-renders do not fight what is being typed. */
let loaded = $state(false)
let recipient = $state('')
let statusFilter = $state('')

const settingsQuery = createQuery(() => ({
  queryKey: ['mail', 'settings', workspaceId],
  queryFn: () => api.settings.get({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

$effect(() => {
  const config = settingsQuery.data?.config
  if (loaded || settingsQuery.isPending) return
  if (config && typeof config.provider === 'string') {
    provider = config.provider as Provider
    values = Object.fromEntries(
      Object.entries(config)
        .filter(([k]) => k !== 'provider')
        .map(([k, v]) => [k, String(v ?? '')]),
    )
  }
  loaded = true
})

const fields = $derived(FIELDS[provider])

const save = createMutation(() => ({
  mutationFn: () =>
    api.settings.set({
      workspaceId,
      config:
        provider === 'platform'
          ? null
          : { provider, ...Object.fromEntries(fields.map((f) => [f.key, values[f.key] ?? ''])) },
    }),
  onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ['mail', 'settings', workspaceId] })
    toast.success(m.mail_saved())
  },
  onError: (error: Error) => toast.error(error.message),
}))

/**
 * A test send, which is the only way to find out whether the credentials work.
 *
 * The provider's refusal comes back as a result rather than an error, so it is shown as one — a
 * rejected recipient is an answer, not a failure of the request.
 */
const test = createMutation(() => ({
  mutationFn: () => api.settings.test({ workspaceId, to: recipient }),
  onSuccess: (result: { ok: boolean; error: string | null }) => {
    if (result.ok) toast.success(m.mail_test_sent({ to: recipient }))
    else toast.error(result.error ?? m.mail_test_refused())
  },
  onError: (error: Error) => toast.error(error.message),
}))

const deliveriesQuery = createQuery(() => ({
  queryKey: ['mail', 'deliveries', workspaceId, statusFilter],
  queryFn: () =>
    api.deliveries.list({
      workspaceId,
      ...(statusFilter ? { status: statusFilter as MailDelivery['status'] } : {}),
    }),
  enabled: Boolean(workspaceId) && canSeeLog,
}))
const deliveries = $derived(deliveriesQuery.data?.items ?? [])

const STATUS_LABELS: Record<string, () => string> = {
  queued: m.mail_status_queued,
  sent: m.mail_status_sent,
  failed: m.mail_status_failed,
  bounced: m.mail_status_bounced,
}
const statusLabel = (status: string) => STATUS_LABELS[status]?.() ?? status
/** Only a failure has a tone: colouring every row makes the one that needs attention disappear. */
const statusTone = (status: string) =>
  status === 'bounced' || status === 'failed' ? 'danger' : status === 'queued' ? 'grey' : 'success'

const when = $derived(new Intl.DateTimeFormat(getLocale(), { dateStyle: 'medium', timeStyle: 'short' }))
</script>

<SettingsPage title={m.mail_settings_title()} description={m.mail_settings_hint()}>
  <SettingsSection title={m.mail_provider_title()} description={m.mail_provider_hint()}>
    {#if settingsQuery.isPending}
      <div class="state"><Spinner /></div>
    {:else}
      <div class="grid">
        <label class="row" data-testid="mail-provider">
          <span class="lbl">{m.mail_provider_label()}</span>
          <Select
            value={provider}
            options={(Object.keys(PROVIDER_LABELS) as Provider[]).map((p) => ({
              value: p,
              label: PROVIDER_LABELS[p](),
            }))}
            disabled={!canManage}
            onValueChange={(v: string) => (provider = v as Provider)}
          />
        </label>

        {#each fields as field (field.key)}
          <label class="row">
            <span class="lbl">{field.label()}</span>
            <Input
              type={field.type ?? 'text'}
              value={values[field.key] ?? ''}
              placeholder={field.hint ?? ''}
              autocomplete="off"
              disabled={!canManage}
              data-testid="mail-{field.key}"
              oninput={(e: Event) =>
                (values = { ...values, [field.key]: (e.currentTarget as HTMLInputElement).value })}
            />
            {#if values[field.key] === SECRET_PLACEHOLDER}
              <!-- The server never returns a stored secret; sending the placeholder back keeps it.
                   Saying so is the difference between "already set" and "about to be blanked". -->
              <span class="hint">{m.mail_secret_kept()}</span>
            {/if}
          </label>
        {/each}
      </div>
    {/if}

    {#snippet footer()}
      <Button
        size="sm"
        disabled={!canManage}
        loading={save.isPending}
        onclick={() => save.mutate()}
        data-testid="mail-save"
      >
        {m.save()}
      </Button>
    {/snippet}
  </SettingsSection>

  <SettingsSection title={m.mail_test_title()} description={m.mail_test_hint()}>
    <div class="testrow">
      <Input
        type="email"
        bind:value={recipient}
        placeholder={session.user?.email ?? 'you@example.com'}
        disabled={!canManage}
        data-testid="mail-test-to"
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={!canManage || !recipient.trim()}
        loading={test.isPending}
        onclick={() => test.mutate()}
        data-testid="mail-test-send"
      >
        {m.mail_test_send()}
      </Button>
    </div>
  </SettingsSection>

  {#if canSeeLog}
    <SettingsSection title={m.mail_log_title()} description={m.mail_log_hint()}>
      <div class="filter" data-testid="mail-log-filter">
        <Select
          value={statusFilter}
          options={[
            { value: '', label: m.mail_log_all() },
            ...['sent', 'queued', 'failed', 'bounced'].map((s) => ({ value: s, label: statusLabel(s) })),
          ]}
          onValueChange={(v: string) => (statusFilter = v)}
        />
      </div>

      {#if deliveriesQuery.isPending}
        <div class="state"><Spinner /></div>
      {:else if !deliveries.length}
        <p class="empty">{m.mail_log_empty()}</p>
      {:else}
        <ul class="log" data-testid="mail-log">
          {#each deliveries as delivery (delivery.id)}
            <li>
              <div class="top">
                <Badge tone={statusTone(delivery.status)}>{statusLabel(delivery.status)}</Badge>
                <span class="subject">{delivery.subject}</span>
                <span class="when">{when.format(new Date(delivery.createdAt))}</span>
              </div>
              <div class="meta">
                <span>{delivery.to.join(', ')}</span>
                {#if delivery.template}<span>{delivery.template}</span>{/if}
              </div>
              {#if delivery.error}
                <!-- The provider's own words. A message that could not be delivered is only
                     actionable if you can read why the other end refused it. -->
                <p class="err">{delivery.error}</p>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </SettingsSection>
  {/if}
</SettingsPage>

<style>
.grid {
  display: grid;
  gap: 12px;
}
.row {
  display: grid;
  gap: 4px;
}
.lbl {
  font-size: 12px;
  font-weight: 500;
  color: var(--kern-ink-600);
}
.hint {
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
.testrow {
  display: grid;
  grid-template-columns: minmax(0, 260px) auto;
  align-items: center;
  gap: 8px;
}
.filter {
  max-width: 200px;
  margin-bottom: 10px;
}
.log {
  list-style: none;
  margin: 0;
  padding: 0;
}
.log li {
  padding: 8px 0;
  border-bottom: 1px solid var(--kern-border-hairline);
}
.log li:last-child {
  border-bottom: 0;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.subject {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.when {
  font-size: 12px;
  color: var(--kern-ink-400);
  white-space: nowrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.err {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--kern-danger);
  overflow-wrap: anywhere;
}
.empty {
  margin: 0;
  font-size: 13px;
  color: var(--kern-ink-400);
}
.state {
  display: grid;
  place-items: center;
  padding: 24px;
}
</style>
