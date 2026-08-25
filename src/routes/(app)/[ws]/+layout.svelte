<script lang="ts">
import {
  AppShell,
  Avatar,
  BottomTabItem,
  DropdownMenu,
  IconButton,
  type MenuItem,
  Rail,
  RailItem,
  RailLogo,
  SearchBox,
  Sidebar,
  SidebarGroup,
  SidebarItem,
  SidebarSwitcher,
  Spinner,
  StatusDot,
  setNavigation,
} from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { untrack } from 'svelte'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { authDisabled, signOut } from '$lib/auth/client'
import CommandPalette from '$lib/components/CommandPalette.svelte'
import InstallPrompt from '$lib/components/InstallPrompt.svelte'
import OfflineBanner from '$lib/components/OfflineBanner.svelte'
import WorkspaceTabs from '$lib/components/WorkspaceTabs.svelte'
import { formatCount } from '$lib/format'
import ModuleSidebar from '$lib/modules/ModuleSidebar.svelte'
import { capabilitiesOf, navigationFor, segmentOf, sidebarsFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { realtime, realtimeUrl } from '$lib/realtime.svelte'
import { prefs } from '$lib/state/prefs.svelte'
import { session } from '$lib/state/session.svelte'
import { relativeHref } from '$lib/state/tabs'
import { tabs } from '$lib/state/tabs.svelte'
import { theme } from '$lib/state/theme.svelte'
import { metaFor } from '$lib/tabs-nav'
import * as m from '$msg'

let { children } = $props()

const api = getApi()
const queryClient = useQueryClient()
let sidebarOpen = $state(false)
let paletteOpen = $state(false)

const slug = $derived(page.params.ws!)

const me = createQuery(() => ({ queryKey: keys.me(), queryFn: () => api.users.me() }))
const workspace = $derived(me.data?.workspaces.find((w) => w.slug === slug))

const permissions = createQuery(() => ({
  queryKey: keys.permissions(workspace?.id ?? ''),
  queryFn: () => api.workspaces.myPermissions({ workspaceId: workspace!.id }),
  enabled: Boolean(workspace),
}))

const modules = createQuery(() => ({
  queryKey: keys.modules(workspace?.id ?? ''),
  queryFn: () => api.workspaces.modules.list({ workspaceId: workspace!.id }),
  enabled: Boolean(workspace),
}))

// keep the shared session state in step with the queries so components deep in the tree can read it
$effect(() => {
  if (me.data) session.setSession(me.data.user, me.data.workspaces)
})
$effect(() => {
  if (permissions.data) session.setPermissions(permissions.data.role, permissions.data.permissions)
})

// an unknown slug means the workspace was left, renamed or never existed
$effect(() => {
  if (me.isSuccess && !workspace) {
    const fallback = me.data.workspaces[0]
    void goto(fallback ? `/${fallback.slug}` : '/onboarding', { replaceState: true })
  }
})

$effect(() => {
  if (workspace) localStorage.setItem('kern.workspace', workspace.slug)
})

// one socket for every workspace the user belongs to: notifications from a workspace you are not
// looking at still light up its badge in the rail
$effect(() => {
  if (!me.data || authDisabled()) return
  /**
   * Keep the framework's view of the router current.
   *
   * Module screens cannot import `$app/navigation` or `$app/state` — a module package is compiled on
   * its own, where those aliases do not exist — so the shell publishes the location here and modules
   * read it. Forget this and a module's sidebar stops highlighting the page you are on, silently.
   */
  $effect(() => {
    setNavigation({
      pathname: page.url.pathname,
      params: page.params as Record<string, string>,
      search: page.url.searchParams,
      go: (href: string) => void goto(href),
    })
  })

  const url = realtimeUrl()
  if (url) realtime.connect({ url, queryClient, getToken: () => null })
  for (const w of me.data.workspaces) realtime.watchWorkspace(w.id)
  return () => realtime.disconnect()
})

const enabledModules = $derived(
  new Set((modules.data ?? []).filter((entry) => entry.state.enabled).map((entry) => entry.manifest.id)),
)
/**
 * Sub-features this workspace has on, inside the modules it has on. A module is all-or-nothing; a
 * capability is the switch below it, and the shell filters on both so a workspace that does not use
 * a feature never meets it — not greyed out, not there.
 */
const enabledCapabilities = $derived(capabilitiesOf(modules.data ?? []))
const navContext = $derived({
  enabled: enabledModules,
  capabilities: enabledCapabilities,
  can: (p: string) => session.can(p),
})
const moduleNav = $derived(navigationFor(navContext))

const segment = $derived(segmentOf(page.url.pathname, slug))
/**
 * The sidebar belongs to the module whose section you are in (DESIGN.md 2.3). The shell asks which
 * modules claim this path segment and hands them the column — including the home sidebar, where
 * core contributes the inbox row and the tracker contributes its presets.
 */
const sidebars = $derived(sidebarsFor({ ...navContext, segment }))
const sidebarControls = $derived(sidebars.filter((entry) => entry.controls))

const badgeFor = (id: string) => realtime.badges[id]?.unread ?? workspaceById(id)?.unread ?? 0
const workspaceById = (id: string) => me.data?.workspaces.find((w) => w.id === id)

/** The same count a badge shows: in the interface's digits, capped, and absent when it is zero. */
const countBadge = (id: string) => {
  const n = badgeFor(id)
  return n ? formatCount(n) : null
}

/**
 * The tab strip, when this device wants one.
 *
 * The strip is fed by navigation rather than driving it: every navigation — a sidebar click, the
 * palette, the back button — reports where it landed, and the tab you are on follows. That keeps the
 * shell working identically with the strip turned off, which is the point of it being a preference.
 *
 * While it is off nothing is synced, so turning it back on adopts wherever you are into the strip
 * you last had, instead of resurrecting a stale one.
 */
const tabHref = $derived(workspace ? relativeHref(page.url.pathname, page.url.search, slug) : '')

$effect(() => {
  if (!workspace || !prefs.tabBar) return
  const at = slug
  const href = tabHref
  const nav = moduleNav
  // the store reads the state it is about to write; the dependencies are the four values above
  untrack(() => tabs.attach(at, href, (h) => metaFor(h, nav)))
})

/**
 * Tab keys avoid ⌘T/⌘W/⌘1: the browser takes those before a page ever sees them, and a shortcut that
 * works in one browser and closes the window in another is worse than none. ⌥ is ours.
 * `code` rather than `key`, because ⌥T on a Mac keyboard types "†".
 */
function tabKeys(e: KeyboardEvent) {
  if (!prefs.tabBar || !e.altKey || e.ctrlKey || e.metaKey) return
  const digit = /^Digit([1-9])$/.exec(e.code)
  if (digit) {
    e.preventDefault()
    const n = Number(digit[1])
    tabs.selectIndex(n === 9 ? -1 : n - 1)
    return
  }
  switch (e.code) {
    case 'KeyT':
      e.preventDefault()
      if (e.shiftKey) tabs.reopen()
      else tabs.open('', { label: m.nav_home(), icon: 'home' })
      return
    case 'KeyW':
      e.preventDefault()
      if (tabs.activeId) tabs.close(tabs.activeId)
      return
    case 'BracketRight':
      e.preventDefault()
      tabs.step(1)
      return
    case 'BracketLeft':
      e.preventDefault()
      tabs.step(-1)
      return
  }
}

const isActive = (href: string) => page.url.pathname === href || page.url.pathname.startsWith(`${href}/`)
const wsHref = (path = '') => `/${slug}${path}`

const userMenu: MenuItem[] = $derived([
  {
    id: 'profile',
    label: m.settings_profile(),
    icon: 'user',
    onSelect: () => goto(wsHref('/settings/profile')),
  },
  {
    id: 'appearance',
    label: m.settings_appearance(),
    icon: 'palette',
    onSelect: () => goto(wsHref('/settings/appearance')),
  },
  {
    id: 'theme',
    label: m.theme(),
    icon: theme.resolved === 'dark' ? 'moon' : 'sun',
    onSelect: () => theme.set(theme.resolved === 'dark' ? 'light' : 'dark'),
  },
  { type: 'separator' as const },
  ...(session.user?.instanceAdmin
    ? [
        {
          id: 'admin',
          label: m.nav_admin(),
          icon: 'shield',
          onSelect: () => goto(wsHref('/admin')),
        } as MenuItem,
      ]
    : []),
  { id: 'signout', label: m.auth_sign_out(), icon: 'log-out', danger: true, onSelect: () => signOut() },
])
</script>

<svelte:window
  onkeydown={(e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault()
      paletteOpen = !paletteOpen
      return
    }
    tabKeys(e)
  }}
/>

{#if !workspace}
  <div class="grid min-h-dvh place-items-center"><Spinner /></div>
{:else}
  {#snippet tabStrip()}
    <WorkspaceTabs
      {slug}
      nav={moduleNav}
      unread={badgeFor(workspace.id)}
      onsearch={() => (paletteOpen = true)}
    />
  {/snippet}

  <!-- passed rather than declared inline: an empty `topBar` snippet would still reserve its 38px -->
  <AppShell bind:sidebarOpen topBar={prefs.tabBar ? tabStrip : undefined}>
    {#snippet rail()}
      <Rail>
        {#snippet top()}
          <RailLogo href={wsHref()} label={workspace.name} />
        {/snippet}

        <RailItem
          label={m.nav_home()}
          icon="home"
          href={wsHref()}
          active={page.url.pathname === wsHref()}
        />
        <RailItem
          label={m.nav_inbox()}
          icon="inbox"
          href={wsHref('/inbox')}
          active={isActive(wsHref('/inbox'))}
          badge={countBadge(workspace.id)}
        />
        {#each moduleNav as item (item.id)}
          <RailItem
            label={item.label}
            icon={item.icon}
            href={wsHref(item.href)}
            active={isActive(wsHref(item.href))}
          />
        {/each}

        {#snippet bottom()}
          <RailItem
            label={m.nav_settings()}
            icon="settings"
            href={wsHref('/settings')}
            active={isActive(wsHref('/settings'))}
          />
        {/snippet}
      </Rail>
    {/snippet}

    {#snippet sidebar()}
      <Sidebar>
        {#snippet header()}
          <DropdownMenu
            items={[
              ...(me.data?.workspaces ?? []).map((w) => ({
                id: w.id,
                label: w.name,
                icon: w.slug === slug ? 'check' : undefined,
                hint: countBadge(w.id) ?? undefined,
                onSelect: () => goto(`/${w.slug}`),
              })),
              { type: 'separator' as const },
              { id: 'new', label: m.create_workspace(), icon: 'plus', onSelect: () => goto('/onboarding') },
            ]}
          >
            {#snippet trigger(props)}
              <SidebarSwitcher
                {...props}
                name={workspace.name}
                subline={m.workspace_members_count({ count: workspace.memberCount ?? 0 })}
                logoUrl={workspace.logoUrl}
                id={workspace.id}
              />
            {/snippet}
          </DropdownMenu>
        {/snippet}

        {#snippet controls()}
          <!--
            DESIGN.md 2.3: the control strip belongs to the section you are in — the tracker gets a
            "New issue" button beside ⌘K, chat gets "Search this space". A module that fills the
            sidebar therefore fills this row too, and the shell steps aside rather than stacking a
            second search box above the module's own.
          -->
          {#if sidebarControls.length}
            <ModuleSidebar
              entries={sidebarControls}
              which="controls"
              workspaceId={workspace.id}
              workspaceSlug={slug}
              pathname={page.url.pathname}
              {segment}
            />
          {:else}
            <SearchBox
              placeholder={m.search_placeholder()}
              readonly
              onclick={() => (paletteOpen = true)}
              kbd={['⌘', 'K']}
            />
          {/if}
        {/snippet}

        <!--
          DESIGN.md 2.2/2.3: the rail switches sections, the sidebar holds the section you are in.
          None of it is the shell's any more — the inbox row and the inbox's filters belong to core,
          the "my work" presets to the tracker, the conversation list to chat. The shell only asks
          who claims this path segment. That is what stops a workspace with the tracker switched off
          being shown three rows that link into it, which is what used to happen.
        -->
        <ModuleSidebar
          entries={sidebars}
          which="component"
          workspaceId={workspace.id}
          workspaceSlug={slug}
          pathname={page.url.pathname}
          {segment}
        />

        {#snippet footer()}
          <DropdownMenu items={userMenu} align="start" side="top">
            {#snippet trigger(props)}
              <button
                {...props}
                class="flex w-full items-center gap-2.5 rounded-[9px] px-2 py-1.5 text-start transition-colors hover:bg-[var(--kern-surface-hover)]"
              >
                <Avatar name={session.user?.name ?? ''} src={session.user?.avatarUrl} id={session.user?.id} size={26} />
                <span class="min-w-0 flex-1 truncate text-[13px] text-[var(--kern-ink-700)]">
                  {session.user?.name}
                </span>
                <StatusDot status={realtime.status === 'open' ? 'online' : 'offline'} />
              </button>
            {/snippet}
          </DropdownMenu>
        {/snippet}
      </Sidebar>
    {/snippet}

    {#snippet bottomBar()}
      <BottomTabItem label={m.nav_home()} icon="home" href={wsHref()} active={page.url.pathname === wsHref()} />
      <BottomTabItem
        label={m.nav_inbox()}
        icon="inbox"
        href={wsHref('/inbox')}
        active={isActive(wsHref('/inbox'))}
        dot={badgeFor(workspace.id) > 0}
      />
      {#each moduleNav.slice(0, 2) as item (item.id)}
        <BottomTabItem
          label={item.label}
          icon={item.icon ?? 'circle'}
          href={wsHref(item.href)}
          active={isActive(wsHref(item.href))}
        />
      {/each}
      <BottomTabItem label={m.nav_more()} icon="menu" onclick={() => (sidebarOpen = true)} />
    {/snippet}

    <OfflineBanner />
    {@render children()}
  </AppShell>

  <CommandPalette bind:open={paletteOpen} workspaceSlug={slug} workspaceId={workspace.id} />
  <InstallPrompt />
{/if}
