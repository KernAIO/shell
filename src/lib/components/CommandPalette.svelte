<script lang="ts">
import { Command, type CommandItem } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { getApi } from '$lib/api/client'
import { commandsFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import { theme } from '$lib/state/theme.svelte'
import * as m from '$msg'

interface Props {
  open: boolean
  workspaceSlug: string
  workspaceId: string
}
let { open = $bindable(false), workspaceSlug, workspaceId }: Props = $props()

const api = getApi()
let query = $state('')

// search the workspace once the query looks deliberate, so typing a destination stays instant
const search = createQuery(() => ({
  queryKey: keys.search(workspaceId, query),
  queryFn: () => api.search({ workspaceId, q: query, limit: 8 }),
  enabled: open && query.trim().length >= 2,
  staleTime: 15_000,
}))

const go = (path: string) => {
  open = false
  query = ''
  void goto(`/${workspaceSlug}${path}`)
}

const navigation: CommandItem[] = $derived([
  {
    id: 'nav-home',
    label: m.nav_home(),
    icon: 'home',
    group: m.palette_group_navigation(),
    onSelect: () => go(''),
  },
  {
    id: 'nav-inbox',
    label: m.nav_inbox(),
    icon: 'inbox',
    group: m.palette_group_navigation(),
    keywords: ['notifications'],
    onSelect: () => go('/inbox'),
  },
  {
    id: 'nav-members',
    label: m.members_title(),
    icon: 'users',
    group: m.palette_group_navigation(),
    onSelect: () => go('/settings/members'),
  },
  {
    id: 'nav-settings',
    label: m.nav_settings(),
    icon: 'settings',
    group: m.palette_group_navigation(),
    onSelect: () => go('/settings'),
  },
])

const workspaceItems: CommandItem[] = $derived(
  session.workspaces
    .filter((w) => w.slug !== workspaceSlug)
    .map((w) => ({
      id: `ws-${w.id}`,
      label: w.name,
      icon: 'layout-grid',
      group: m.palette_group_workspaces(),
      badge: w.unread || undefined,
      onSelect: () => {
        open = false
        void goto(`/${w.slug}`)
      },
    })),
)

const commands: CommandItem[] = $derived([
  {
    id: 'cmd-theme',
    label: m.palette_switch_theme(),
    icon: theme.resolved === 'dark' ? 'sun' : 'moon',
    group: m.palette_group_commands(),
    onSelect: () => {
      theme.set(theme.resolved === 'dark' ? 'light' : 'dark')
      open = false
    },
  },
  ...commandsFor({ enabled: new Set(), can: (p) => session.can(p) }).map((c) => ({
    id: c.id,
    label: c.label,
    icon: c.icon,
    group: m.palette_group_commands(),
    onSelect: () => {
      open = false
    },
  })),
])

const results: CommandItem[] = $derived(
  (search.data?.hits ?? []).map((hit) => ({
    id: `hit-${hit.object.module}-${hit.object.id}`,
    label: hit.title,
    description: hit.snippet ?? undefined,
    icon: hit.icon ?? 'file',
    group: m.palette_group_search(),
    onSelect: () => go(hit.url),
  })),
)

const items = $derived([...navigation, ...workspaceItems, ...commands, ...results])
</script>

<Command
  bind:open
  bind:search={query}
  {items}
  placeholder={m.palette_placeholder()}
  emptyText={m.palette_empty()}
  loading={search.isFetching}
/>
