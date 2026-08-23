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
} from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { authDisabled, signOut } from '$lib/auth/client'
import CommandPalette from '$lib/components/CommandPalette.svelte'
import InstallPrompt from '$lib/components/InstallPrompt.svelte'
import OfflineBanner from '$lib/components/OfflineBanner.svelte'
import { navigationFor, slotsFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { realtime } from '$lib/realtime.svelte'
import { session } from '$lib/state/session.svelte'
import { theme } from '$lib/state/theme.svelte'
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
  realtime.connect(queryClient, () => null)
  for (const w of me.data.workspaces) realtime.watchWorkspace(w.id)
  return () => realtime.disconnect()
})

const enabledModules = $derived(
  new Set((modules.data ?? []).filter((entry) => entry.state.enabled).map((entry) => entry.manifest.id)),
)
const moduleNav = $derived(navigationFor({ enabled: enabledModules, can: (p) => session.can(p) }))

/**
 * Which section the rail is on, so the sidebar can show that section's own navigation.
 *
 * Derived from the path rather than held as state: the rail, the palette, a link and the back
 * button all arrive the same way, and none of them has to tell the sidebar anything.
 */
const section = $derived.by(() => {
  const rest = page.url.pathname.slice(wsHref().length)
  if (rest === '' || rest === '/') return 'home'
  if (rest.startsWith('/inbox')) return 'inbox'
  return 'module'
})
const inboxFilter = $derived(page.url.searchParams.get('filter'))
const inboxScope = $derived(page.url.searchParams.get('scope'))

/** What "my work" means, in the tracker's own presets, so these are real queries and not labels. */
const MY_WORK = [
  { preset: 'assigned', icon: 'circle-user', label: () => m.tracker_preset_assigned() },
  { preset: 'created', icon: 'square-pen', label: () => m.tracker_preset_created() },
  { preset: 'subscribed', icon: 'eye', label: () => m.tracker_preset_subscribed() },
] as const

/**
 * What the active module puts in the sidebar.
 *
 * The sidebar belongs to whichever module you are in: the tracker leaves it as navigation, chat
 * fills it with conversations. A module that contributes nothing here simply gets the default.
 */
const sidebarWidgets = $derived(
  slotsFor('sidebar.widget', {
    enabled: enabledModules,
    can: (p) => session.can(p),
    pathname: page.url.pathname,
  }),
)

const badgeFor = (id: string) => realtime.badges[id]?.unread ?? workspaceById(id)?.unread ?? 0
const workspaceById = (id: string) => me.data?.workspaces.find((w) => w.id === id)

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
    }
  }}
/>

{#if !workspace}
  <div class="grid min-h-dvh place-items-center"><Spinner /></div>
{:else}
  <AppShell bind:sidebarOpen>
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
          badge={badgeFor(workspace.id) || null}
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
                hint: badgeFor(w.id) ? String(badgeFor(w.id)) : undefined,
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
          {#if !sidebarWidgets.length}
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
          These two columns used to say the same thing — My work, Inbox, Issues and Chat appeared as
          icons in the rail and again as rows here, on every section, so the sidebar spent its width
          repeating the switcher instead of showing what you had switched to.

          Every section fills it with its own: the modules through `sidebar.widget`, and the two the
          shell owns below. They read the query string rather than a page's state, which is why the
          shell can drive a page it does not own — and why a filtered inbox can be linked to.
        -->
        {#if section === 'home'}
          <SidebarGroup title={m.nav_home()}>
            <SidebarItem
              label={m.nav_inbox()}
              icon="inbox"
              href={wsHref('/inbox')}
              badge={badgeFor(workspace.id) || null}
              glow={badgeFor(workspace.id) > 0}
            />
            {#each MY_WORK as item (item.preset)}
              <SidebarItem
                label={item.label()}
                icon={item.icon}
                href={wsHref(`/tracker?preset=${item.preset}`)}
                active={page.url.searchParams.get('preset') === item.preset}
              />
            {/each}
          </SidebarGroup>
        {/if}

        {#if section === 'inbox'}
          <SidebarGroup title={m.nav_inbox()}>
            <SidebarItem
              label={m.inbox_tab_unread()}
              icon="inbox"
              href={wsHref('/inbox')}
              active={inboxFilter !== 'all'}
              badge={badgeFor(workspace.id) || null}
              glow={badgeFor(workspace.id) > 0}
            />
            <SidebarItem
              label={m.inbox_tab_all()}
              icon="list"
              href={wsHref('/inbox?filter=all')}
              active={inboxFilter === 'all'}
            />
          </SidebarGroup>
          <SidebarGroup title={m.inbox_scope()}>
            <SidebarItem
              label={workspace.name}
              icon="building"
              href={wsHref(inboxFilter === 'all' ? '/inbox?filter=all' : '/inbox')}
              active={inboxScope !== 'all'}
            />
            <SidebarItem
              label={m.inbox_all_workspaces()}
              icon="globe"
              href={wsHref(`/inbox?scope=all${inboxFilter === 'all' ? '&filter=all' : ''}`)}
              active={inboxScope === 'all'}
            />
          </SidebarGroup>
        {/if}

        {#each sidebarWidgets as widget (widget.id)}
          {#await widget.component() then mod}
            {@const Widget = mod.default}
            <Widget {...widget.props ?? {}} />
          {/await}
        {/each}

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
