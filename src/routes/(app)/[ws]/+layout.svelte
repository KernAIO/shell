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
import { navigationFor } from '$lib/modules/registry'
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
    icon: 'sun-moon',
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
          <SearchBox
            placeholder={m.search_placeholder()}
            readonly
            onclick={() => (paletteOpen = true)}
            kbd={['⌘', 'K']}
          />
        {/snippet}

        <SidebarGroup title={m.nav_workspace()}>
          <SidebarItem
            label={m.nav_home()}
            icon="home"
            href={wsHref()}
            active={page.url.pathname === wsHref()}
          />
          <SidebarItem
            label={m.nav_inbox()}
            icon="inbox"
            href={wsHref('/inbox')}
            active={isActive(wsHref('/inbox'))}
            badge={badgeFor(workspace.id) || null}
            glow={badgeFor(workspace.id) > 0}
          />
        </SidebarGroup>

        {#if moduleNav.length}
          <SidebarGroup title={m.nav_modules()}>
            {#each moduleNav as item (item.id)}
              <SidebarItem
                label={item.label}
                icon={item.icon}
                href={wsHref(item.href)}
                active={isActive(wsHref(item.href))}
              />
            {/each}
          </SidebarGroup>
        {/if}

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
