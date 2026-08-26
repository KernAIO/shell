<script lang="ts">
import { SidebarGroup, SidebarItem } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { capabilitiesOf, settingsLinksFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The sidebar for the settings section.
 *
 * It is the sidebar rather than a column inside the page, so settings has the same anatomy as every
 * other section: the rail switches sections, the sidebar holds the one you are in (DESIGN.md §2.3),
 * and the workspace switcher and your own menu stay where they are everywhere else.
 */
interface Props {
  slug: string
  workspaceId: string
}
let { slug, workspaceId }: Props = $props()

const api = getApi()

const href = (path: string) => `/${slug}/settings${path}`
const isActive = (path: string) => page.url.pathname === href(path)

interface NavLink {
  path: string
  label: string
  icon: string
  permission?: string
}

// Workspace settings are only offered when the member can actually act on them; a member who cannot
// manage roles simply does not see the entry rather than meeting a locked page.
const workspaceLinks = $derived(
  (
    [
      { path: '', label: m.settings_general(), icon: 'building', permission: 'core.workspace.manage' },
      { path: '/members', label: m.settings_members(), icon: 'users', permission: 'core.members.view' },
      { path: '/roles', label: m.settings_roles(), icon: 'shield-check', permission: 'core.roles.manage' },
      { path: '/groups', label: m.settings_groups(), icon: 'user-plus', permission: 'core.members.manage' },
      {
        path: '/dashboard',
        label: m.settings_dashboard(),
        icon: 'layout-grid',
        permission: 'core.workspace.manage',
      },
      { path: '/modules', label: m.settings_modules(), icon: 'puzzle', permission: 'core.modules.manage' },
      {
        path: '/integrations',
        label: m.settings_integrations(),
        icon: 'plug',
        permission: 'core.integrations.manage',
      },
      {
        path: '/mcp',
        label: m.mcp_settings_title(),
        icon: 'bot',
        permission: 'core.integrations.manage',
      },
      { path: '/audit', label: m.settings_audit(), icon: 'scroll-text', permission: 'core.audit.view' },
    ] satisfies NavLink[]
  ).filter((l) => !l.permission || session.can(l.permission)),
)

/**
 * Settings contributed by the modules this workspace has on. The href is conventional, so a module
 * declaring a page is enough — see `settingsLinksFor`.
 */
// Same query key as the app shell's, so this shares its result rather than fetching again.
const modulesQuery = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
}))

const moduleLinks = $derived(
  settingsLinksFor({
    enabled: new Set((modulesQuery.data ?? []).filter((e) => e.state.enabled).map((e) => e.manifest.id)),
    capabilities: capabilitiesOf(modulesQuery.data ?? []),
    can: (permission: string) => session.can(permission),
  }).map((link) => ({
    // A page whose id is its module's id is that module's main settings page and lives at
    // `/settings/<moduleId>`; anything else is `/settings/<moduleId>/<pageId>`. Without this, mail —
    // one module, one page, both called "mail" — linked to `/settings/mail/mail` and 404'd, and
    // nothing caught it because the nav entry rendered perfectly.
    path: link.id === link.moduleId ? `/${link.moduleId}` : `/${link.moduleId}/${link.id}`,
    label: link.label,
    icon: link.icon ?? 'puzzle',
  })),
)

const accountLinks: NavLink[] = $derived([
  { path: '/profile', label: m.settings_profile(), icon: 'user' },
  { path: '/security', label: m.settings_security(), icon: 'key-round' },
  { path: '/notifications', label: m.settings_notifications(), icon: 'bell' },
  { path: '/appearance', label: m.settings_appearance(), icon: 'palette' },
])
</script>

{#snippet group(title: string, links: NavLink[])}
  <SidebarGroup {title}>
    {#each links as link (link.path)}
      <SidebarItem
        label={link.label}
        icon={link.icon}
        href={href(link.path)}
        active={isActive(link.path)}
      />
    {/each}
  </SidebarGroup>
{/snippet}

<!--
  Your own settings first. They are the ones that are always yours: workspace and module entries
  appear only with the permission to act on them, so a member without them used to open Settings and
  find their own profile below two groups they could not use — or below nothing at all.
-->
{@render group(m.settings_account_section(), accountLinks)}
{#if workspaceLinks.length}
  {@render group(m.settings_workspace_section(), workspaceLinks)}
{/if}
{#if moduleLinks.length}
  {@render group(m.settings_modules_section(), moduleLinks)}
{/if}
