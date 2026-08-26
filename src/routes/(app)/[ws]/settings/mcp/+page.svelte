<script lang="ts">
import {
  Button,
  Dialog,
  EmptyState,
  Field,
  Icon,
  Input,
  SegmentedControl,
  Select,
  Skeleton,
  Switch,
  Tabs,
  toast,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { env } from '$env/dynamic/public'
import { getApi } from '$lib/api/client'
import CapabilityAudiencePicker from '$lib/components/settings/CapabilityAudiencePicker.svelte'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { formatDate, relativeTime } from '$lib/format'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * MCP & AI access — the admin surface for the instance's Model Context Protocol endpoint.
 *
 * Three decisions live here, each one data rather than code: whether the workspace offers MCP at
 * all (a capability of the `core` module, switched through the same settings mechanism as every
 * other capability), which URL an AI client points at, and which apps currently hold a connection.
 * Revoking one member's token revokes the whole client+user connection — that is what the server
 * does, so the interface says "revoke access", not "delete token".
 */
const api = getApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws!)
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(session.can('core.integrations.manage'))

const modules = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const coreEntry = $derived((modules.data ?? []).find((e) => e.manifest.id === 'core'))
const mcpEnabled = $derived(coreEntry?.state.capabilities?.includes('mcp') ?? false)
const apiKeysEnabled = $derived(coreEntry?.state.capabilities?.includes('api_keys') ?? false)

/**
 * What the switchboard has stored for core. Both reserved keys are sent whole — spread first, or
 * the day core grows a second capability (or a second audience) this screen silently switches it
 * off for everyone but the one entry it meant to touch.
 */
const storedCapabilities = $derived(
  ((coreEntry?.state.settings as Record<string, unknown> | undefined)?.$capabilities ?? {}) as Record<
    string,
    boolean
  >,
)
const storedAudience = $derived(
  ((coreEntry?.state.settings as Record<string, unknown> | undefined)?.$capabilityAudience ?? {}) as Record<
    string,
    string[] | null
  >,
)

const setCapability = createMutation(() => ({
  mutationFn: ({ capabilityId, on }: { capabilityId: string; on: boolean }) =>
    api.workspaces.modules.updateSettings({
      workspaceId,
      moduleId: 'core',
      settings: { $capabilities: { ...storedCapabilities, [capabilityId]: on } },
    }),
  onSuccess: (_res, { capabilityId, on }) => {
    toast.success(
      capabilityId === 'mcp'
        ? on
          ? m.mcp_switched_on_toast()
          : m.mcp_switched_off_toast()
        : on
          ? m.api_keys_switched_on_toast()
          : m.api_keys_switched_off_toast(),
    )
    // Navigation, consent and this page all derive from the resolved set, so re-read everything.
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const setAudience = createMutation(() => ({
  mutationFn: ({ capabilityId, groups }: { capabilityId: string; groups: string[] | null }) =>
    api.workspaces.modules.updateSettings({
      workspaceId,
      moduleId: 'core',
      settings: { $capabilityAudience: { ...storedAudience, [capabilityId]: groups } },
    }),
  onSuccess: () => {
    toast.success(m.audience_saved_toast())
    void queryClient.invalidateQueries({ queryKey: ['core'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

const groups = createQuery(() => ({
  queryKey: ['core', 'groups', workspaceId],
  queryFn: () => api.workspaces.groups.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

// Same-origin by default (the dev proxy and Caddy both route it); PUBLIC_API_URL wins when set.
const serverUrl = $derived.by(() => {
  const base = env.PUBLIC_API_URL || window.location.origin
  return `${new URL(base).origin}/mcp`
})

/** One id per copy target, so copying the CLI command does not also flip the URL button's icon. */
let copiedKey = $state<string | null>(null)
async function copyText(key: string, text: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedKey = key
    setTimeout(() => {
      if (copiedKey === key) copiedKey = null
    }, 2000)
  } catch {
    toast.error(m.error_generic())
  }
}
const copyUrl = () => copyText('url', serverUrl)
const copied = $derived(copiedKey === 'url')

/**
 * One-click install links, built from this workspace's own server URL. Cursor and VS Code both
 * read a small JSON config out of the link — a `url` field is enough for either to run its own
 * OAuth discovery against this server, so no client secret or pre-registration is needed.
 * `clientName` only has to be stable and URL-safe; the slug already is.
 */
const clientName = $derived(`kern-${slug}`)
const cursorInstallUrl = $derived.by(() => {
  const config = btoa(JSON.stringify({ url: serverUrl }))
  return `cursor://anysphere.cursor-deeplink/mcp/install?name=${encodeURIComponent(clientName)}&config=${config}`
})
const vscodeConfig = $derived(encodeURIComponent(JSON.stringify({ type: 'http', url: serverUrl })))
const vscodeInstallUrl = $derived(
  `vscode:mcp/install?name=${encodeURIComponent(clientName)}&config=${vscodeConfig}`,
)
const vscodeInsidersInstallUrl = $derived(
  `vscode-insiders:mcp/install?name=${encodeURIComponent(clientName)}&config=${vscodeConfig}`,
)
/** `claude mcp add` speaks HTTP + OAuth natively — no flags beyond a name and this server's URL. */
const claudeCodeCommand = $derived(`claude mcp add --transport http ${clientName} ${serverUrl}`)
/**
 * Codex reads its servers from a TOML file rather than taking a URL on its own `mcp add` command,
 * so a config block is the reliable instruction — `codex mcp login` is what actually runs the OAuth
 * flow, whether the entry was typed by hand or pasted from here.
 */
const codexConfig = $derived(`[mcp_servers.${clientName}]\nurl = "${serverUrl}"\nauth = "oauth"`)
const codexLoginCommand = $derived(`codex mcp login ${clientName}`)
/** The shape most clients that aren't listed by name still read: an `mcpServers` map keyed by name. */
const otherConfig = $derived(
  JSON.stringify({ mcpServers: { [clientName]: { type: 'http', url: serverUrl } } }, null, 2),
)

type ConnectTab = { value: string; label: string; icon: string }
const connectTabs = $derived.by<ConnectTab[]>(() => [
  { value: 'cursor', label: m.mcp_connect_cursor(), icon: 'code' },
  { value: 'vscode', label: m.mcp_connect_vscode(), icon: 'square-code' },
  { value: 'claude-code', label: m.mcp_connect_claude_code(), icon: 'command' },
  { value: 'claude', label: m.mcp_connect_claude(), icon: 'bot' },
  { value: 'chatgpt', label: m.mcp_connect_chatgpt(), icon: 'message-circle' },
  { value: 'codex', label: m.mcp_connect_codex(), icon: 'command' },
  { value: 'other', label: m.mcp_connect_other(), icon: 'puzzle' },
])
let activeConnectTab = $state('cursor')

const clients = createQuery(() => ({
  queryKey: ['core', 'mcp', 'client', workspaceId],
  queryFn: () => api.mcp.clients.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const tokens = createQuery(() => ({
  queryKey: ['core', 'mcp', 'token', workspaceId],
  queryFn: () => api.mcp.tokens.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

type McpClient = NonNullable<typeof clients.data>[number]
type McpToken = NonNullable<typeof tokens.data>[number]

/** Each app's active connections, grouped by client, keyed the way the rows are keyed. */
function tokensOf(clientId: string): McpToken[] {
  return (tokens.data ?? []).filter((t) => t.clientId === clientId)
}

let pendingRevoke = $state<McpToken | null>(null)

const revoke = createMutation(() => ({
  mutationFn: (id: string) => api.mcp.tokens.revoke({ id }),
  onSuccess: () => {
    toast.success(m.mcp_revoked_toast())
    pendingRevoke = null
    void queryClient.invalidateQueries({ queryKey: ['core', 'mcp'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

/**
 * Personal API keys — a member's own credential for the raw REST API. `list` is always "mine";
 * `listAll` below is the admin's view of everyone's. Scope choices mirror the ones the backend
 * actually enforces: a request-method gate on `read`, nothing narrower.
 */
const myKeys = createQuery(() => ({
  queryKey: ['core', 'apiKeys', 'mine', workspaceId],
  queryFn: () => api.apiKeys.list({ workspaceId }),
  enabled: Boolean(workspaceId) && apiKeysEnabled,
}))

type ApiKeyRow = NonNullable<typeof myKeys.data>[number]

let showCreateKey = $state(false)
let newKeyName = $state('')
let newKeyScope = $state<'read' | 'read_write'>('read')
let newKeyExpiry = $state('30')
/** Shown once, right after creation — the only time the plaintext key is ever available. */
let revealedKey = $state<{ key: string; name: string } | null>(null)

const createKey = createMutation(() => ({
  mutationFn: () =>
    api.apiKeys.create({
      workspaceId,
      name: newKeyName.trim(),
      scope: newKeyScope,
      expiresInDays: newKeyExpiry === 'never' ? null : Number(newKeyExpiry),
    }),
  onSuccess: (created) => {
    showCreateKey = false
    revealedKey = { key: created.key, name: created.name }
    newKeyName = ''
    newKeyScope = 'read'
    newKeyExpiry = '30'
    void queryClient.invalidateQueries({ queryKey: ['core', 'apiKeys'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

let keyCopied = $state(false)
async function copyRevealedKey() {
  if (!revealedKey) return
  try {
    await navigator.clipboard.writeText(revealedKey.key)
    keyCopied = true
    setTimeout(() => {
      keyCopied = false
    }, 2000)
  } catch {
    toast.error(m.error_generic())
  }
}

let pendingRevokeKey = $state<{ id: string; name: string } | null>(null)

const revokeKey = createMutation(() => ({
  mutationFn: (id: string) => api.apiKeys.revoke({ id }),
  onSuccess: () => {
    toast.success(m.api_keys_revoked_toast())
    pendingRevokeKey = null
    void queryClient.invalidateQueries({ queryKey: ['core', 'apiKeys'] })
  },
  onError: (err) => toast.error(err instanceof Error ? err.message : m.error_generic()),
}))

/** Every key in the workspace, whoever holds it — an integration manager's oversight, not self-service. */
const allKeys = createQuery(() => ({
  queryKey: ['core', 'apiKeys', 'all', workspaceId],
  queryFn: () => api.apiKeys.listAll({ workspaceId }),
  enabled: Boolean(workspaceId) && apiKeysEnabled && canManage,
}))
</script>

<SettingsPage title={m.mcp_settings_title()} description={m.mcp_settings_desc()}>
  {#if modules.isPending}
    <Skeleton class="h-[120px] w-full rounded-[10px]" />
    <Skeleton class="h-[180px] w-full rounded-[10px]" />
  {:else}
    {#if !canManage}
      <p
        class="rounded-[9px] bg-[var(--kern-info-tint)] px-3 py-2.5 text-[12.5px] text-[var(--kern-info)]"
      >
        {m.mcp_read_only()}
      </p>
    {/if}

    <SettingsSection title={m.mcp_enable_title()} description={m.mcp_enable_hint()}>
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] {mcpEnabled
              ? 'bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]'
              : 'bg-[var(--kern-surface-chip)] text-[var(--kern-ink-450)]'}"
          >
            <Icon name="sparkles" size={16} />
          </div>
          <span class="text-[13.5px] font-medium text-[var(--kern-ink-900)]">
            {m.mcp_enable_label()}
          </span>
        </div>
        <!-- Re-created with the value, as on the modules page, so a failed save snaps back. -->
        {#key mcpEnabled}
          <Switch
            checked={mcpEnabled}
            disabled={!canManage || setCapability.isPending}
            onCheckedChange={(on) => setCapability.mutate({ capabilityId: 'mcp', on })}
            ariaLabel={m.mcp_enable_label()}
          />
        {/key}
      </div>

      {#if mcpEnabled && canManage}
        <div class="mt-4 border-t border-[var(--kern-border-hairline)] pt-4">
          <CapabilityAudiencePicker
            groups={groups.data ?? []}
            value={storedAudience.mcp ?? null}
            disabled={setAudience.isPending}
            onChange={(g) => setAudience.mutate({ capabilityId: 'mcp', groups: g })}
          />
        </div>
      {/if}
    </SettingsSection>

    <SettingsSection title={m.mcp_server_url_title()} description={m.mcp_server_url_hint()}>
      <div class="flex items-center justify-between gap-3">
        <code
          class="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-700)] text-ellipsis whitespace-nowrap"
          dir="ltr"
        >
          {serverUrl}
        </code>
        <Button variant="secondary" size="sm" onclick={copyUrl} icon={copied ? 'circle-check' : 'copy'}>
          {copied ? m.copied() : m.mcp_copy_url()}
        </Button>
      </div>
    </SettingsSection>

    {#if !mcpEnabled}
      <EmptyState
        icon="lock"
        title={m.mcp_apps_off_title()}
        description={m.mcp_apps_off_body()}
      />
    {:else}
      <SettingsSection title={m.mcp_connect_title()} description={m.mcp_connect_desc()}>
        <Tabs items={connectTabs} bind:value={activeConnectTab} variant="pill" label={m.mcp_connect_title()}>
          {#snippet children(value)}
            <div class="grid gap-2.5 pt-3">
              {#if value === 'cursor'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_cursor_hint()}</p>
                <div>
                  <Button
                    variant="secondary"
                    size="sm"
                    href={cursorInstallUrl}
                    data-sveltekit-reload
                    icon="download"
                  >
                    {m.mcp_connect_add_button({ client: m.mcp_connect_cursor() })}
                  </Button>
                </div>
              {:else if value === 'vscode'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_vscode_hint()}</p>
                <div class="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    href={vscodeInstallUrl}
                    data-sveltekit-reload
                    icon="download"
                  >
                    {m.mcp_connect_add_button({ client: m.mcp_connect_vscode() })}
                  </Button>
                  <Button variant="ghost" size="sm" href={vscodeInsidersInstallUrl} data-sveltekit-reload>
                    {m.mcp_connect_vscode_insiders()}
                  </Button>
                </div>
              {:else if value === 'claude-code'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_claude_code_hint()}</p>
                <div class="flex items-center justify-between gap-3">
                  <code
                    class="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-700)] text-ellipsis whitespace-nowrap"
                    dir="ltr"
                  >
                    {claudeCodeCommand}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => copyText('claude-code', claudeCodeCommand)}
                    icon={copiedKey === 'claude-code' ? 'circle-check' : 'copy'}
                  >
                    {copiedKey === 'claude-code' ? m.copied() : m.mcp_connect_copy_command()}
                  </Button>
                </div>
              {:else if value === 'claude'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_claude_hint()}</p>
              {:else if value === 'chatgpt'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_chatgpt_hint()}</p>
              {:else if value === 'codex'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_codex_hint()}</p>
                <div class="flex items-start justify-between gap-3">
                  <pre
                    class="min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-700)]"
                    dir="ltr"><code>{codexConfig}</code></pre>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => copyText('codex-config', codexConfig)}
                    icon={copiedKey === 'codex-config' ? 'circle-check' : 'copy'}
                  >
                    {copiedKey === 'codex-config' ? m.copied() : m.mcp_connect_copy_config()}
                  </Button>
                </div>
                <div class="flex items-center justify-between gap-3">
                  <code
                    class="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-700)] text-ellipsis whitespace-nowrap"
                    dir="ltr"
                  >
                    {codexLoginCommand}
                  </code>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => copyText('codex-login', codexLoginCommand)}
                    icon={copiedKey === 'codex-login' ? 'circle-check' : 'copy'}
                  >
                    {copiedKey === 'codex-login' ? m.copied() : m.mcp_connect_copy_command()}
                  </Button>
                </div>
              {:else if value === 'other'}
                <p class="text-[12px] text-[var(--kern-ink-500)]">{m.mcp_connect_other_hint()}</p>
                <div class="flex items-start justify-between gap-3">
                  <pre
                    class="min-w-0 flex-1 overflow-x-auto rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12px] text-[var(--kern-ink-700)]"
                    dir="ltr"><code>{otherConfig}</code></pre>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => copyText('other-config', otherConfig)}
                    icon={copiedKey === 'other-config' ? 'circle-check' : 'copy'}
                  >
                    {copiedKey === 'other-config' ? m.copied() : m.mcp_connect_copy_config()}
                  </Button>
                </div>
              {/if}
            </div>
          {/snippet}
        </Tabs>
      </SettingsSection>

      <section class="grid gap-2.5">
        <h2 class="text-[13px] font-medium tracking-[-0.01em] text-[var(--kern-ink-700)]">
          {m.mcp_apps_title()}
        </h2>
        <p class="-mt-1.5 text-[12.5px] text-[var(--kern-ink-500)]">{m.mcp_apps_desc()}</p>

        {#if clients.isPending || tokens.isPending}
          <Skeleton class="h-[140px] w-full rounded-[10px]" />
        {:else if (clients.data?.length ?? 0) === 0}
          <EmptyState icon="bot" title={m.mcp_apps_empty_title()} description={m.mcp_apps_empty_desc()} />
        {:else}
          {#each clients.data ?? [] as client (client.clientId)}
            {@const appTokens = tokensOf(client.clientId)}
            <article class="rounded-[10px] border border-[var(--kern-border)] bg-[var(--kern-surface-raised)]">
              <header class="flex items-start gap-3.5 px-[18px] pt-4 pb-3">
                <div
                  class="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]"
                >
                  {#if client.logoUri}
                    <img src={client.logoUri} alt="" class="h-full w-full object-cover" />
                  {:else}
                    <Icon name="bot" size={16} />
                  {/if}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <h3 class="truncate text-[14px] font-medium text-[var(--kern-ink-900)]">
                      {client.name}
                    </h3>
                    {#if client.firstParty}
                      <span
                        class="rounded-[6px] bg-[var(--kern-info-tint)] px-2 py-[2px] text-[11.5px] text-[var(--kern-info)]"
                      >
                        {m.mcp_first_party()}
                      </span>
                    {/if}
                  </div>
                  <p class="mt-0.5 text-[12.5px] text-[var(--kern-ink-500)]">
                    {m.mcp_client_connections({ count: String(appTokens.length) })}
                    ·
                    {client.lastUsedAt
                      ? m.mcp_last_activity({ time: relativeTime(client.lastUsedAt) })
                      : m.mcp_never_used()}
                  </p>
                </div>
              </header>

              {#if appTokens.length}
                <ul class="border-t border-[var(--kern-border-hairline)]">
                  {#each appTokens as token (token.id)}
                    <li
                      class="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--kern-border-hairline)] px-[18px] py-2.5 last:border-b-0"
                    >
                      <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--kern-ink-900)]">
                        {token.userName}
                      </span>
                      <span class="text-[12px] text-[var(--kern-ink-450)]">
                        {token.lastUsedAt
                          ? m.mcp_token_last_used({ time: relativeTime(token.lastUsedAt) })
                          : m.mcp_never_used()}
                        · {m.mcp_token_expires({ date: formatDate(token.expiresAt) })}
                      </span>
                      <Button
                        variant="secondary"
                        size="sm"
                        onclick={() => (pendingRevoke = token)}
                        disabled={!canManage}
                      >
                        {m.mcp_revoke()}
                      </Button>
                    </li>
                  {/each}
                </ul>
              {:else}
                <p class="border-t border-[var(--kern-border-hairline)] px-[18px] py-3 text-[12.5px] text-[var(--kern-ink-450)]">
                  {m.mcp_client_no_tokens()}
                </p>
              {/if}
            </article>
          {/each}
        {/if}
      </section>
    {/if}

    <SettingsSection title={m.api_keys_enable_title()} description={m.api_keys_enable_hint()}>
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <div
            class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] {apiKeysEnabled
              ? 'bg-[var(--kern-accent-tint)] text-[var(--kern-accent-deep)]'
              : 'bg-[var(--kern-surface-chip)] text-[var(--kern-ink-450)]'}"
          >
            <Icon name="key-round" size={16} />
          </div>
          <span class="text-[13.5px] font-medium text-[var(--kern-ink-900)]">
            {m.api_keys_enable_label()}
          </span>
        </div>
        {#key apiKeysEnabled}
          <Switch
            checked={apiKeysEnabled}
            disabled={!canManage || setCapability.isPending}
            onCheckedChange={(on) => setCapability.mutate({ capabilityId: 'api_keys', on })}
            ariaLabel={m.api_keys_enable_label()}
          />
        {/key}
      </div>

      {#if apiKeysEnabled && canManage}
        <div class="mt-4 border-t border-[var(--kern-border-hairline)] pt-4">
          <CapabilityAudiencePicker
            groups={groups.data ?? []}
            value={storedAudience.api_keys ?? null}
            disabled={setAudience.isPending}
            onChange={(g) => setAudience.mutate({ capabilityId: 'api_keys', groups: g })}
          />
        </div>
      {/if}
    </SettingsSection>

    {#if apiKeysEnabled}
      <SettingsSection title={m.api_keys_title()} description={m.api_keys_desc()}>
        {#snippet action()}
          <Button variant="secondary" size="sm" icon="plus" onclick={() => (showCreateKey = true)}>
            {m.api_keys_new()}
          </Button>
        {/snippet}

        {#if myKeys.isPending}
          <Skeleton class="h-[80px] w-full rounded-[10px]" />
        {:else if (myKeys.data?.length ?? 0) === 0}
          <EmptyState bare compact icon="key-round" title={m.api_keys_empty_title()} description={m.api_keys_empty_desc()} />
        {:else}
          <ul class="grid gap-2">
            {#each myKeys.data ?? [] as apiKeyRow (apiKeyRow.id)}
              <li
                class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[9px] border border-[var(--kern-border-hairline)] px-3 py-2.5"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="truncate text-[13px] font-medium text-[var(--kern-ink-900)]">{apiKeyRow.name}</span>
                    <span
                      class="rounded-[6px] bg-[var(--kern-surface-chip)] px-2 py-[2px] text-[11.5px] text-[var(--kern-ink-550)]"
                    >
                      {apiKeyRow.scope === 'read_write' ? m.api_keys_scope_read_write() : m.api_keys_scope_read()}
                    </span>
                  </div>
                  <p class="mt-0.5 text-[12px] text-[var(--kern-ink-450)]">
                    {apiKeyRow.start ? m.api_keys_starts_with({ start: apiKeyRow.start }) : ''}
                    · {apiKeyRow.lastUsedAt
                      ? m.mcp_token_last_used({ time: relativeTime(apiKeyRow.lastUsedAt) })
                      : m.mcp_never_used()}
                    · {apiKeyRow.expiresAt
                      ? m.mcp_token_expires({ date: formatDate(apiKeyRow.expiresAt) })
                      : m.api_keys_never_expires()}
                  </p>
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() => (pendingRevokeKey = { id: apiKeyRow.id, name: apiKeyRow.name })}
                >
                  {m.mcp_revoke()}
                </Button>
              </li>
            {/each}
          </ul>
        {/if}
      </SettingsSection>

      {#if canManage}
        <SettingsSection title={m.api_keys_all_title()} description={m.api_keys_all_desc()}>
          {#if allKeys.isPending}
            <Skeleton class="h-[80px] w-full rounded-[10px]" />
          {:else if (allKeys.data?.length ?? 0) === 0}
            <EmptyState bare compact icon="key-round" title={m.api_keys_empty_title()} description={m.api_keys_all_empty_desc()} />
          {:else}
            <ul class="grid gap-2">
              {#each allKeys.data ?? [] as apiKeyRow (apiKeyRow.id)}
                <li
                  class="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[9px] border border-[var(--kern-border-hairline)] px-3 py-2.5"
                >
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2">
                      <span class="truncate text-[13px] font-medium text-[var(--kern-ink-900)]">{apiKeyRow.name}</span>
                      <span
                        class="rounded-[6px] bg-[var(--kern-surface-chip)] px-2 py-[2px] text-[11.5px] text-[var(--kern-ink-550)]"
                      >
                        {apiKeyRow.scope === 'read_write' ? m.api_keys_scope_read_write() : m.api_keys_scope_read()}
                      </span>
                    </div>
                    <p class="mt-0.5 text-[12px] text-[var(--kern-ink-450)]">
                      {m.api_keys_owned_by({ name: apiKeyRow.userName })}
                      · {apiKeyRow.expiresAt
                        ? m.mcp_token_expires({ date: formatDate(apiKeyRow.expiresAt) })
                        : m.api_keys_never_expires()}
                    </p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onclick={() => (pendingRevokeKey = { id: apiKeyRow.id, name: apiKeyRow.name })}
                  >
                    {m.mcp_revoke()}
                  </Button>
                </li>
              {/each}
            </ul>
          {/if}
        </SettingsSection>
      {/if}
    {/if}
  {/if}
</SettingsPage>

<Dialog
  open={pendingRevoke !== null}
  onOpenChange={(open) => {
    if (!open) pendingRevoke = null
  }}
  title={pendingRevoke ? m.mcp_revoke_title({ name: pendingRevoke.userName }) : ''}
  size="sm"
>
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">
    {m.mcp_revoke_body({
      client: pendingRevoke?.clientName ?? '',
      name: pendingRevoke?.userName ?? '',
    })}
  </p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (pendingRevoke = null)}>{m.cancel()}</Button>
    <Button variant="danger" loading={revoke.isPending} onclick={() => pendingRevoke && revoke.mutate(pendingRevoke.id)}>
      {m.mcp_revoke_confirm()}
    </Button>
  {/snippet}
</Dialog>

<Dialog
  open={showCreateKey}
  onOpenChange={(open) => (showCreateKey = open)}
  title={m.api_keys_new()}
  size="sm"
>
  <div class="grid gap-3.5">
    <Field label={m.api_keys_name_label()}>
      {#snippet children(id)}
        <Input {id} bind:value={newKeyName} placeholder={m.api_keys_name_placeholder()} autofocus />
      {/snippet}
    </Field>
    <Field label={m.api_keys_scope_label()}>
      {#snippet children()}
        <SegmentedControl
          size="sm"
          items={[
            { value: 'read', label: m.api_keys_scope_read() },
            { value: 'read_write', label: m.api_keys_scope_read_write() },
          ]}
          value={newKeyScope}
          onValueChange={(v) => (newKeyScope = v as 'read' | 'read_write')}
        />
      {/snippet}
    </Field>
    <Field label={m.api_keys_expiry_label()}>
      {#snippet children(id)}
        <Select
          {id}
          value={newKeyExpiry}
          options={[
            { value: '7', label: m.api_keys_expiry_days({ count: '7' }) },
            { value: '30', label: m.api_keys_expiry_days({ count: '30' }) },
            { value: '90', label: m.api_keys_expiry_days({ count: '90' }) },
            { value: '365', label: m.api_keys_expiry_days({ count: '365' }) },
            { value: 'never', label: m.api_keys_expiry_never() },
          ]}
          onValueChange={(v) => (newKeyExpiry = v)}
          width="100%"
        />
      {/snippet}
    </Field>
  </div>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (showCreateKey = false)}>{m.cancel()}</Button>
    <Button loading={createKey.isPending} disabled={!newKeyName.trim()} onclick={() => createKey.mutate()}>
      {m.api_keys_create()}
    </Button>
  {/snippet}
</Dialog>

<Dialog
  open={revealedKey !== null}
  onOpenChange={(open) => {
    if (!open) revealedKey = null
  }}
  title={m.api_keys_created_title()}
  size="sm"
>
  <div class="grid gap-3">
    <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">{m.api_keys_created_body()}</p>
    <div class="flex items-center justify-between gap-3">
      <code
        class="min-w-0 flex-1 overflow-hidden rounded-[8px] border border-[var(--kern-border-hairline)] bg-[var(--kern-surface-chip)] px-3 py-2 font-[var(--kern-font-mono)] text-[12.5px] text-[var(--kern-ink-700)] text-ellipsis whitespace-nowrap"
        dir="ltr"
      >
        {revealedKey?.key ?? ''}
      </code>
      <Button
        variant="secondary"
        size="sm"
        onclick={copyRevealedKey}
        icon={keyCopied ? 'circle-check' : 'copy'}
      >
        {keyCopied ? m.copied() : m.mcp_copy_url()}
      </Button>
    </div>
  </div>

  {#snippet footer()}
    <Button onclick={() => (revealedKey = null)}>{m.api_keys_created_done()}</Button>
  {/snippet}
</Dialog>

<Dialog
  open={pendingRevokeKey !== null}
  onOpenChange={(open) => {
    if (!open) pendingRevokeKey = null
  }}
  title={pendingRevokeKey ? m.api_keys_revoke_title({ name: pendingRevokeKey.name }) : ''}
  size="sm"
>
  <p class="text-[13px] leading-relaxed text-[var(--kern-ink-600)]">
    {m.api_keys_revoke_body({ name: pendingRevokeKey?.name ?? '' })}
  </p>

  {#snippet footer()}
    <Button variant="ghost" onclick={() => (pendingRevokeKey = null)}>{m.cancel()}</Button>
    <Button
      variant="danger"
      loading={revokeKey.isPending}
      onclick={() => pendingRevokeKey && revokeKey.mutate(pendingRevokeKey.id)}
    >
      {m.mcp_revoke_confirm()}
    </Button>
  {/snippet}
</Dialog>
