<script lang="ts">
import { Button, EmptyState, Icon, Select, Skeleton } from '@kernhq/ui'
import { createMutation, createQuery } from '@tanstack/svelte-query'
import { untrack } from 'svelte'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { authDisabled } from '$lib/auth/client'
import BrandMark from '$lib/components/auth/BrandMark.svelte'
import { capabilitiesOf, type ModuleStateEntry } from '$lib/modules/capabilities'
import * as m from '$msg'

/**
 * `/authorize?id=…` — the OAuth consent screen an AI client (Claude, Cursor) sends its user to.
 *
 * Outside `(app)` on purpose: it is opened in a fresh tab by a third-party application, with no
 * workspace slug in the URL and no shell around it. The request id is the only thing that says what
 * is being approved, and it belongs to whoever opened it — core answers `authorize.get` only for
 * its owner.
 */
const api = getApi()

const requestId = $derived(page.url.searchParams.get('id') ?? '')

const info = createQuery(() => ({
  queryKey: ['core', 'mcp', 'authorize', requestId],
  queryFn: () => api.mcp.authorize.get({ id: requestId }),
  enabled: Boolean(requestId),
  // An expired or unknown id is an answer, not a network hiccup worth retrying.
  retry: false,
}))

const workspaces = createQuery(() => ({
  queryKey: ['core', 'workspace'],
  queryFn: () => api.workspaces.list(),
}))

/**
 * Which of the member's workspaces have MCP switched on. One query rather than one per workspace,
 * because the number of workspaces is data — a hook count cannot follow it.
 */
const eligibility = createQuery(() => ({
  queryKey: ['core', 'mcp', 'eligible-workspaces'],
  queryFn: async () => {
    const all = workspaces.data ?? []
    const flags = await Promise.all(
      all.map(async (w) => {
        const entries = (await api.workspaces.modules.list({ workspaceId: w.id })) as ModuleStateEntry[]
        return capabilitiesOf(entries).has('core.mcp')
      }),
    )
    return all.filter((_, i) => flags[i])
  },
  enabled: workspaces.isSuccess,
}))

let chosen = $state('')

// Default to the first eligible workspace once the list arrives; keep whatever the person picked.
// `chosen` is read through untrack so resetting it does not re-trigger the effect that reset it.
$effect(() => {
  const ids = eligibility.data?.map((w) => String(w.id)) ?? []
  if (!ids.length) return
  if (!untrack(() => ids.includes(chosen))) chosen = ids[0] ?? ''
})

// A signed-out visitor is sent to sign in and brought straight back here. In mock mode there is no
// auth server, so the app behaves as if the demo user is signed in.
$effect(() => {
  if (authDisabled()) return
  if ((info.error as { code?: string } | null)?.code !== 'UNAUTHORIZED') return
  const next = encodeURIComponent(page.url.pathname + page.url.search)
  window.location.href = `/sign-in?next=${next}`
})

const decide = createMutation(() => ({
  mutationFn: async (approve: boolean) =>
    approve
      ? api.mcp.authorize.approve({ id: requestId, workspaceId: chosen })
      : api.mcp.authorize.deny({ id: requestId }),
  onSuccess: (res) => {
    window.location.href = res.redirectUrl
  },
}))

/**
 * The scopes grouped by module — "tracker · read & write" rather than a wall of raw scope strings.
 * Module ids are shown as they are: they are technical names both halves of the protocol use.
 */
function scopesByModule(scopes: string[]) {
  const groups = new Map<string, Set<string>>()
  for (const scope of scopes) {
    const [moduleId, level] = scope.split(':')
    if (!moduleId || !level) continue
    const levels = groups.get(moduleId) ?? new Set<string>()
    levels.add(level)
    groups.set(moduleId, levels)
  }
  return [...groups.entries()].map(([moduleId, levels]) => ({
    moduleId,
    write: levels.has('write'),
  }))
}

const pending = $derived(decide.isPending)
</script>

<svelte:head><title>{m.mcp_consent_tab_title()}</title></svelte:head>

<div class="wrap">
  <header><BrandMark /></header>

  <main class="card">
    {#if info.isPending || workspaces.isPending}
      <div class="head">
        <Skeleton class="h-[52px] w-[52px] rounded-[14px]" />
        <div class="grid flex-1 gap-2">
          <Skeleton class="h-[22px] w-3/5 rounded-[6px]" />
          <Skeleton class="h-[14px] w-2/5 rounded-[6px]" />
        </div>
      </div>
      <Skeleton class="h-[92px] w-full rounded-[10px]" />
      <Skeleton class="h-[38px] w-full rounded-[10px]" />
      <div class="actions">
        <Skeleton class="h-[36px] w-[110px] rounded-[9px]" />
        <Skeleton class="h-[36px] w-[80px] rounded-[9px]" />
      </div>
    {:else if info.isError || !requestId}
      <EmptyState
        icon="triangle-alert"
        title={m.mcp_error_title()}
        description={m.mcp_error_body()}
      >
        {#snippet actions()}
          <Button variant="secondary" href="/">{m.mcp_back_home()}</Button>
        {/snippet}
      </EmptyState>
    {:else if info.data}
      {@const request = info.data}
      <div class="head">
        <div class="logo" aria-hidden="true">
          {#if request.logoUri}
            <img src={request.logoUri} alt="" class="h-full w-full rounded-[inherit] object-cover" />
          {:else}
            <Icon name="bot" size={24} />
          {/if}
        </div>
        <div class="min-w-0">
          <h1 class="text-[17px] leading-snug font-semibold tracking-[-0.015em] text-[var(--kern-ink-900)]">
            {m.mcp_consent_heading({ name: request.clientName })}
          </h1>
          {#if request.clientUri}
            <p class="mt-0.5 truncate text-[12.5px] text-[var(--kern-ink-450)]" dir="ltr">
              {request.clientUri}
            </p>
          {/if}
        </div>
      </div>

      {#if request.returning}
        <p class="returning">
          <Icon name="circle-check" size={13} strokeWidth={1.8} />
          {m.mcp_consent_returning()}
        </p>
      {/if}

      <section class="scopes" aria-label={m.mcp_consent_access_title()}>
        <h2 class="label">{m.mcp_consent_access_title()}</h2>
        <ul>
          {#each scopesByModule(request.scopes) as group (group.moduleId)}
            <li>
              <span class="module font-[var(--kern-font-mono)]" dir="ltr">{group.moduleId}</span>
              <span class="level">
                {group.write ? m.mcp_access_read_write() : m.mcp_access_read()}
              </span>
            </li>
          {/each}
        </ul>
      </section>

      {#if eligibility.isPending}
        <Skeleton class="h-[38px] w-full rounded-[10px]" />
      {:else if eligibility.data && eligibility.data.length > 0 && chosen}
        <div class="ws">
          <label class="label" for="ws-picker">{m.mcp_consent_workspace()}</label>
          <Select
            id="ws-picker"
            value={chosen}
            options={eligibility.data.map((w) => ({ value: w.id, label: w.name }))}
            onValueChange={(v) => (chosen = v)}
            disabled={pending}
            width="100%"
          />
          <p class="hint">{m.mcp_consent_workspace_hint()}</p>
        </div>
      {:else}
        <EmptyState
          bare
          compact
          icon="lock"
          title={m.mcp_consent_no_workspace_title()}
          description={m.mcp_consent_no_workspace_body()}
        />
      {/if}

      {#if decide.isError}
        <p class="error" role="alert">
          {decide.error instanceof Error ? decide.error.message : m.error_generic()}
        </p>
      {/if}

      <div class="actions">
        <Button
          variant="primary"
          onclick={() => decide.mutate(true)}
          loading={pending}
          disabled={!chosen || pending}
        >
          {m.mcp_allow()}
        </Button>
        <Button variant="ghost" onclick={() => decide.mutate(false)} disabled={pending}>
          {m.mcp_deny()}
        </Button>
      </div>
    {/if}
  </main>

</div>

<style>
  .wrap {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 28px;
    padding: 48px 20px;
    background: var(--kern-surface);
  }
  .card {
    width: 100%;
    max-width: 440px;
    display: grid;
    gap: 18px;
    padding: 26px;
    background: var(--kern-surface-raised);
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-xl);
  }
  .head {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .logo {
    flex: none;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: 14px;
    background: var(--kern-accent-tint);
    color: var(--kern-accent-deep);
  }
  .returning {
    margin: -6px 0 0;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: var(--kern-success);
  }
  .label {
    margin: 0;
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--kern-ink-400);
  }
  .scopes ul {
    list-style: none;
    margin: 8px 0 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .scopes li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid var(--kern-border-hairline);
    border-radius: 9px;
    background: var(--kern-surface-chip);
  }
  .module {
    font-size: 12.5px;
    color: var(--kern-ink-700);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  /* the mono token has no Arabic glyphs; under RTL it resolves to the sans stack, so no override */
  .level {
    flex: none;
    font-size: 12.5px;
    color: var(--kern-ink-550);
  }
  .ws {
    display: grid;
    gap: 7px;
  }
  .hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
    color: var(--kern-ink-450);
  }
  .error {
    margin: 0;
    padding: 9px 12px;
    border-radius: 9px;
    background: var(--kern-danger-tint);
    color: var(--kern-danger);
    font-size: 12.5px;
  }
  .actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
  }
</style>
