<script lang="ts">
import { Avatar, Icon, SectionLabel } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { settingsLinksFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

let { children } = $props()

const api = getApi()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const href = (p: string) => `/${slug}/settings${p}`
const isActive = (p: string) => page.url.pathname === href(p)

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
  queryKey: keys.modules(workspace?.id ?? ''),
  queryFn: () => api.workspaces.modules.list({ workspaceId: workspace!.id }),
  enabled: Boolean(workspace),
}))

const moduleLinks = $derived(
  settingsLinksFor({
    enabled: new Set((modulesQuery.data ?? []).filter((e) => e.state.enabled).map((e) => e.manifest.id)),
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

const accountLinks: NavLink[] = [
  { path: '/profile', label: m.settings_profile(), icon: 'user' },
  { path: '/security', label: m.settings_security(), icon: 'key-round' },
  { path: '/notifications', label: m.settings_notifications(), icon: 'bell' },
  { path: '/appearance', label: m.settings_appearance(), icon: 'palette' },
]
</script>

<!--
  `grid-rows-[minmax(0,1fr)]`, not an implicit `auto` row: an auto row is sized by its tallest item,
  so the column with the most content set the row height and both columns stretched past the shell.
  The scroll container then ended below the fold — you could scroll it to its end and still not
  reach the last thing on the page. Each column scrolls itself instead.
-->
{#snippet navGroup(label: string, links: NavLink[])}
  <SectionLabel {label} />
  <ul class="mb-4 mt-1 grid gap-0.5">
    {#each links as link (link.path)}
      <li>
        <a
          href={href(link.path)}
          aria-current={isActive(link.path) ? 'page' : undefined}
          class="flex h-[34px] items-center gap-2.5 rounded-[9px] px-2.5 text-[13px] transition-colors {isActive(
            link.path,
          )
            ? 'bg-[var(--kern-ink-900)] font-medium text-[var(--kern-ink-inverse)]'
            : 'text-[var(--kern-ink-700)] hover:bg-[var(--kern-surface-hover)]'}"
        >
          <Icon name={link.icon} size={15} class="shrink-0 opacity-90" />
          <span class="truncate">{link.label}</span>
        </a>
      </li>
    {/each}
  </ul>
{/snippet}

<div
  class="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] md:grid-cols-[248px_minmax(0,1fr)]"
>
  <nav
    class="min-h-0 overflow-y-auto border-b border-[var(--kern-border)] px-3 py-4 md:border-b-0 md:border-e"
    aria-label={m.settings_title()}
  >
    <div class="mb-4 flex items-center gap-2.5 px-1.5">
      <Avatar name={workspace?.name ?? ''} src={workspace?.logoUrl} id={workspace?.id} size={26} />
      <div class="min-w-0">
        <div class="truncate text-[13px] font-medium text-[var(--kern-ink-900)]">{workspace?.name}</div>
        <div class="truncate font-[var(--kern-font-mono)] text-[11px] text-[var(--kern-ink-400)]">
          {m.settings_title().toLowerCase()}
        </div>
      </div>
    </div>

    <!--
      Your own settings first. They are the ones that are always yours: workspace and module
      entries appear only with the permission to act on them, so a member without them used to
      open Settings and find their own profile below two groups they could not use — or below
      nothing at all, with the page starting on an empty space.
    -->
    {@render navGroup(m.settings_account_section(), accountLinks)}
    {#if workspaceLinks.length}
      {@render navGroup(m.settings_workspace_section(), workspaceLinks)}
    {/if}
    {#if moduleLinks.length}
      {@render navGroup(m.settings_modules_section(), moduleLinks)}
    {/if}
  </nav>

  <div class="min-h-0 overflow-y-auto px-6 py-6 pb-16">{@render children()}</div>
</div>
