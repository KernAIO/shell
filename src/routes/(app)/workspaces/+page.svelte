<script lang="ts">
import type { core } from '@kernhq/contracts'
import { Avatar, Badge, Button, Icon, SearchBox, Skeleton } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import { authDisabled, signOut } from '$lib/auth/client'
import BrandMark from '$lib/components/auth/BrandMark.svelte'
import PrefsControls from '$lib/components/auth/PrefsControls.svelte'
import { formatCount } from '$lib/format'
import * as m from '$msg'

/**
 * "Which one?" — the question a person can answer the moment they sign in, and cannot answer
 * usefully at any other time.
 *
 * This page forwards rather than asks whenever there is nothing to choose between: no workspaces at
 * all goes to onboarding, exactly one goes straight in. So sign-in can always land here without
 * anyone with a single workspace ever seeing it.
 */
const LAST_WORKSPACE = 'kern.workspace'
/** Above this many, reading the list beats scanning it. */
const FILTER_FROM = 7

let user = $state<core.User | null>(null)
let workspaces = $state<core.WorkspaceSummary[]>([])
let loading = $state(true)
let error = $state<string | null>(null)
let query = $state('')

const remembered = typeof localStorage !== 'undefined' ? localStorage.getItem(LAST_WORKSPACE) : null
const shown = $derived(
  query.trim()
    ? workspaces.filter((w) => `${w.name} ${w.slug}`.toLowerCase().includes(query.trim().toLowerCase()))
    : workspaces,
)
const roleLabels: Record<string, string> = {
  owner: m.members_role_owner(),
  admin: m.members_role_admin(),
  member: m.members_role_member(),
  guest: m.members_role_guest(),
}

/** Size and role on one line. `memberCount` is optional in the contract, so it may simply not be there. */
const metaOf = (ws: core.WorkspaceSummary) =>
  [
    ws.memberCount === undefined ? null : m.workspace_members_count({ count: ws.memberCount }),
    roleLabels[ws.role] ?? ws.role,
  ]
    .filter(Boolean)
    .join(' · ')

async function load() {
  loading = true
  error = null
  try {
    const me = await getApi().users.me()
    if (me.workspaces.length === 0) return void goto('/onboarding', { replaceState: true })
    if (me.workspaces.length === 1) return void enter(me.workspaces[0]!, true)
    user = me.user
    workspaces = me.workspaces
  } catch (err) {
    // Nobody is signed in: that is not an error to read, it is a page to be on. The API client's
    // `onUnauthorized` is already navigating, so this only decides what the page paints meanwhile.
    if ((err as { code?: string })?.code === 'UNAUTHORIZED')
      return void goto('/sign-in', { replaceState: true })
    error = err instanceof Error ? err.message : m.error_generic()
  } finally {
    loading = false
  }
}

function enter(ws: core.WorkspaceSummary, replaceState = false) {
  localStorage.setItem(LAST_WORKSPACE, ws.slug)
  return goto(`/${ws.slug}`, { replaceState })
}

$effect(() => void load())
</script>

<svelte:head><title>{m.workspaces_choose_title()} · Kern</title></svelte:head>

<div class="page">
  <div class="sheet">
    <header>
      <BrandMark size="lg" />
      <h1>{m.workspaces_choose_title()}</h1>
      {#if user}
        <p class="who">
          <span>{m.workspaces_signed_in_as({ email: user.email })}</span>
          {#if !authDisabled()}
            <span aria-hidden="true">·</span>
            <button type="button" class="link" onclick={signOut}>{m.auth_sign_out()}</button>
          {/if}
        </p>
      {:else}
        <p class="who">{m.workspaces_choose_hint()}</p>
      {/if}
    </header>

    {#if loading}
      <ul class="list" aria-busy="true">
        {#each [0, 1, 2] as row (row)}
          <li class="card skeleton">
            <Skeleton width="34px" height="34px" radius="10px" />
            <div class="lines">
              <Skeleton width="45%" height="13px" />
              <Skeleton width="30%" height="11px" />
            </div>
          </li>
        {/each}
      </ul>
    {:else if error}
      <div class="fail">
        <span class="seal"><Icon name="triangle-alert" size={20} strokeWidth={1.6} /></span>
        <p class="failmsg">{error}</p>
        <Button variant="white" icon="refresh-cw" onclick={load}>{m.retry()}</Button>
      </div>
    {:else}
      {#if workspaces.length >= FILTER_FROM}
        <SearchBox bind:value={query} placeholder={m.workspaces_filter_placeholder()} />
      {/if}

      {#if shown.length === 0}
        <p class="none">{m.workspaces_filter_empty({ query })}</p>
      {:else}
        <ul class="list">
          {#each shown as ws (ws.id)}
            <li>
              <a class="card" href="/{ws.slug}" onclick={() => localStorage.setItem(LAST_WORKSPACE, ws.slug)}>
                <Avatar id={ws.id} name={ws.name} src={ws.logoUrl} color={ws.accentColor ?? undefined} size={34} />
                <span class="text">
                  <span class="name">
                    {ws.name}
                    {#if ws.slug === remembered}<span class="last">{m.workspaces_last_used()}</span>{/if}
                  </span>
                  <span class="meta">{metaOf(ws)}</span>
                </span>
                {#if ws.unread > 0}
                  <Badge variant={ws.mentions > 0 ? 'glow' : 'count'}>{formatCount(ws.unread)}</Badge>
                {/if}
                <Icon name="arrow-right" size={15} strokeWidth={1.7} class="go" />
              </a>
            </li>
          {/each}
        </ul>
      {/if}

      <a class="create" href="/onboarding">
        <span class="plus"><Icon name="plus" size={15} strokeWidth={1.8} /></span>
        {m.create_workspace()}
      </a>
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
    max-width: 460px;
    padding: 28px;
    background: var(--kern-surface);
    border: 1px solid var(--kern-border);
    border-radius: 14px;
    display: grid;
    gap: 16px;
  }

  header { display: grid; gap: 4px; justify-items: start; }
  header :global(.kbrand) { margin-bottom: 14px; }
  h1 { margin: 0; font-size: 22px; font-weight: 600; line-height: 1.2; letter-spacing: -0.02em; color: var(--kern-ink-900); }
  .who { display: flex; align-items: baseline; flex-wrap: wrap; gap: 6px; margin: 0; font-size: 13px; color: var(--kern-ink-450); }
  .who > span:first-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; }
  .link { color: var(--kern-accent-text); font-size: 13px; }
  .link:hover { color: var(--kern-accent-deep); text-decoration: underline; }

  /*
   * The list scrolls inside the sheet rather than pushing "Create workspace" and the language and
   * theme controls below the fold. `overflow-y: auto` makes this a clip box, which would slice the
   * 3px focus ring off a card, so the padding buys the ring room and the negative margin gives it
   * back — the margin box is unchanged, so nothing moves.
   */
  .list {
    list-style: none;
    display: grid;
    gap: 8px;
    max-height: min(50vh, 440px);
    overflow-y: auto;
    padding: 4px;
    margin: -4px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 13px;
    border: 1px solid var(--kern-border);
    border-radius: var(--kern-r-2xl);
    background: var(--kern-surface-raised);
    color: inherit;
    text-decoration: none;
    transition: border-color var(--kern-dur-fast), background-color var(--kern-dur-fast);
  }
  a.card:hover { border-color: var(--kern-border-hover); background: var(--kern-surface-card-hover); }
  a.card:focus-visible { outline: none; border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  .card.skeleton { pointer-events: none; }
  .lines { display: grid; gap: 7px; flex: 1; }
  .text { display: grid; gap: 2px; flex: 1; min-width: 0; }
  .name {
    display: flex; align-items: center; gap: 8px;
    font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: var(--kern-ink-900);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .last {
    flex: none; font-size: 10.5px; font-weight: 500; letter-spacing: 0.06em; text-transform: uppercase;
    color: var(--kern-ink-350);
  }
  .meta { font-size: 12px; color: var(--kern-ink-400); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  :global(.card .go) { color: var(--kern-ink-250); flex: none; }
  :global([dir='rtl'] .card .go) { transform: scaleX(-1); }

  .none { margin: 0; padding: 18px 4px; text-align: center; font-size: 13px; color: var(--kern-ink-400); }

  .create {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    height: 38px; border-radius: var(--kern-r-2xl);
    border: 1px dashed var(--kern-border-muted);
    color: var(--kern-ink-500); font-size: 13.5px; font-weight: 500; text-decoration: none;
    transition: border-color var(--kern-dur-fast), color var(--kern-dur-fast);
  }
  .create:hover { border-color: var(--kern-accent); color: var(--kern-accent-text); }
  .create:focus-visible { outline: none; border-color: var(--kern-accent); box-shadow: 0 0 0 3px var(--kern-ring); }
  .plus { display: inline-grid; place-items: center; }

  .fail { display: grid; justify-items: center; gap: 12px; padding: 22px 0; text-align: center; }
  .seal {
    display: inline-grid; place-items: center; width: 42px; height: 42px;
    border-radius: var(--kern-r-2xl); background: var(--kern-danger-tint); color: var(--kern-danger);
  }
  .failmsg { margin: 0; font-size: 13px; color: var(--kern-ink-450); text-wrap: pretty; }
</style>
