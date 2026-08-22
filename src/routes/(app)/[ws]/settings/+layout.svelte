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
    path: `/${link.moduleId}/${link.id}`,
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

<div class="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[248px_minmax(0,1fr)]">
  <nav
    class="border-b border-[var(--kern-border)] px-3 py-4 md:border-b-0 md:border-e"
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

    {#if workspaceLinks.length}
      <SectionLabel label={m.settings_workspace_section()} />
      <ul class="mb-4 mt-1 grid gap-0.5">
        {#each workspaceLinks as link (link.path)}
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
    {/if}

    {#if moduleLinks.length}
      <SectionLabel label={m.settings_modules_section()} />
      <ul class="mb-4 mt-1 grid gap-0.5">
        {#each moduleLinks as link (link.path)}
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
    {/if}

    <SectionLabel label={m.settings_account_section()} />
    <ul class="mt-1 grid gap-0.5">
      {#each accountLinks as link (link.path)}
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
  </nav>

  <div class="min-h-0 overflow-y-auto px-6 py-6 pb-16">{@render children()}</div>
</div>
