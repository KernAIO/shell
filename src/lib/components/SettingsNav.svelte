<script lang="ts">
import { SidebarGroup, SidebarItem } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { capabilitiesOf, settingsLinksFor } from '$lib/modules/registry'
import { getLocale } from '$lib/paraglide/runtime'
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

interface ModuleLink extends NavLink {
  moduleId: string
  readonly moduleLabel: string
}

const moduleLinks = $derived(
  settingsLinksFor({
    enabled: new Set((modulesQuery.data ?? []).filter((e) => e.state.enabled).map((e) => e.manifest.id)),
    capabilities: capabilitiesOf(modulesQuery.data ?? []),
    can: (permission: string) => session.can(permission),
  }).map(
    (link): ModuleLink => ({
      // A page whose id is its module's id is that module's main settings page and lives at
      // `/settings/<moduleId>`; anything else is `/settings/<moduleId>/<pageId>`. Without this, mail —
      // one module, one page, both called "mail" — linked to `/settings/mail/mail` and 404'd, and
      // nothing caught it because the nav entry rendered perfectly.
      path: link.id === link.moduleId ? `/${link.moduleId}` : `/${link.moduleId}/${link.id}`,
      label: link.label,
      icon: link.icon ?? 'puzzle',
      moduleId: link.moduleId,
      // Forwarded as a getter, never copied. `moduleLabel` is the module's own nav label —
      // `t('<module>.nav')` — and `t()` reads a `$state` locale, so the string is only right at the
      // moment it is read. Writing `moduleLabel: link.moduleLabel` here would resolve it now and
      // pin the heading to whichever locale this derived last ran in.
      get moduleLabel() {
        return link.moduleLabel
      },
    }),
  ),
)

interface ModuleGroup {
  moduleId: string
  readonly moduleLabel: string
  links: ModuleLink[]
}

/**
 * The module pages, cut into one group per module.
 *
 * They used to be one flat group called "Modules": with People, Issues and Inventory on, that is
 * seventeen rows reading "Offices", "Projects", "Types", "Categories", "General"… with nothing
 * saying which module any of them configures — and two modules contributing a page called "General"
 * is already the case, so the list was ambiguous rather than merely long.
 *
 * **The heading is the module's own nav label, not its manifest name.** A manifest name is a plain
 * English literal (`name: 'Inventory'`); a nav label is `t('nav')`. Heading these groups with the
 * manifest name gave a Persian reader «حساب شما / فضای کاری / Inventory / Issues / People», three
 * Latin words in an otherwise Persian column, beside a rail that had translated the very same
 * modules. `moduleDisplayName` picks the label and keeps the manifest name only as a fallback for a
 * module with no navigation — which, of the modules that contribute settings, is Mail and Billing,
 * and both of those have exactly one page and land in the unheaded bucket below. So the fallback is
 * unreachable today, and it is there for the third-party module that is not.
 *
 * Building the groups from the links rather than from the module list is what makes a module with
 * no settings pages contribute no heading: it is never a key in the map. Insertion order inside a
 * group is `settingsLinksFor`'s order, which is the `order` each module declared — a module decides
 * how its own pages read, and this only decides where they sit.
 *
 * A module with exactly one page gets a row and no heading of its own, collected at the end under
 * one shared heading. A heading is heavier than the single row it would introduce and would usually
 * restate it ("Billing" over "Billing"); the row alone loses nothing, because for these modules the
 * page label is already the more specific of the two.
 *
 * **That count is of the pages this reader can see, after permission and capability filtering — not
 * of the pages the module declares — and that is deliberate.** HR declares nine and shows one to
 * somebody holding only `hr.period.manage`; for that reader "Periods" goes in the shared bucket
 * without a «کارکنان» heading over it. The heading exists to disambiguate a list, and one row is
 * not a list. The cost is that two colleagues on one instance see the sidebar grouped differently,
 * which is already true of every row in it.
 */
const moduleGroups = $derived.by(() => {
  const by = new Map<string, ModuleGroup>()
  for (const link of moduleLinks) {
    let group = by.get(link.moduleId)
    if (!group) {
      group = {
        moduleId: link.moduleId,
        // Same reason as above: read where it is rendered, not here.
        get moduleLabel() {
          return link.moduleLabel
        },
        links: [],
      }
      by.set(link.moduleId, group)
    }
    group.links.push(link)
  }
  // Alphabetical by label, through the reader's collation — so the order follows the words actually
  // on screen and changes with the language, as it should. Registration order is the bottom of
  // `registry.ts` and means nothing to anybody reading the sidebar; nav order cannot order this list
  // at all, because Mail and Billing contribute settings and no navigation. Alphabetical is also the
  // rule the widget picker already groups modules by, and it is the only one where a module added
  // later lands somewhere a reader can predict.
  const collator = new Intl.Collator(getLocale())
  const all = [...by.values()]
  return {
    named: all
      .filter((g) => g.links.length > 1)
      .sort((a, b) => collator.compare(a.moduleLabel, b.moduleLabel)),
    lone: all
      .filter((g) => g.links.length === 1)
      .flatMap((g) => g.links)
      .sort((a, b) => collator.compare(a.label, b.label)),
  }
})

const accountLinks: NavLink[] = $derived([
  { path: '/profile', label: m.settings_profile(), icon: 'user' },
  { path: '/security', label: m.settings_security(), icon: 'key-round' },
  { path: '/notifications', label: m.settings_notifications(), icon: 'bell' },
  { path: '/appearance', label: m.settings_appearance(), icon: 'palette' },
])

/**
 * How many rows the sidebar is drawing. Read by the effect below, which has to run again each time
 * more of them arrive — the module rows land with `modulesQuery`, a tick or two after the account
 * and workspace groups have already painted.
 */
const rowCount = $derived(accountLinks.length + workspaceLinks.length + moduleLinks.length)

let root = $state<HTMLElement>()
let revealed = false

/**
 * Bring the page you are on into view, once, as soon as its row exists.
 *
 * The list is taller than the column, and grouping pushed the module rows about 90px further down —
 * so arriving at `/settings/hr/periods` from a link, a bookmark or a reload showed the top of the
 * list with the one row that says where you are somewhere below the fold. Grouping made an existing
 * problem worse rather than causing it.
 *
 * `block: 'nearest'` is what keeps this cheap and quiet: a row already on screen is left exactly
 * where it is, so this never fights the browser's own scroll restoration and never yanks the column
 * on a page whose row was visible anyway. It runs at most once per mount, guarded by a plain flag
 * rather than by the effect's dependencies, because scrolling the sidebar on *every* navigation is
 * a different and unwelcome behaviour — clicking a row somebody can already see must not move the
 * list under their pointer.
 */
$effect(() => {
  if (revealed || !root || rowCount === 0) return
  const active = root.querySelector('[aria-current="page"]')
  if (!active) return
  revealed = true
  active.scrollIntoView({ block: 'nearest' })
})

const uid = $props.id()
</script>

<!--
  `SidebarGroup` draws a heading and exposes none: its title is a `<span>` inside the collapse
  button, so the grouping was visual only — a screen reader got one flat run of links, exactly what
  it got before the groups existed. The wrapper is what makes the grouping real for everyone: an
  `<h2>` to navigate by, and a region named by it so the rows announce which module they configure.
  Both come from the one `title` string, so there is no second copy to fall out of step.
-->
{#snippet group(key: string, title: string, links: NavLink[])}
  <section class="group" aria-labelledby="{uid}-{key}">
    <h2 class="kern-sr-only" id="{uid}-{key}">{title}</h2>
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
  </section>
{/snippet}

<div bind:this={root}>
  <!--
    Your own settings first. They are the ones that are always yours: workspace and module entries
    appear only with the permission to act on them, so a member without them used to open Settings
    and find their own profile below two groups they could not use — or below nothing at all.
  -->
  {@render group('account', m.settings_account_section(), accountLinks)}
  {#if workspaceLinks.length}
    {@render group('workspace', m.settings_workspace_section(), workspaceLinks)}
  {/if}
  {#each moduleGroups.named as mod (mod.moduleId)}
    {@render group(mod.moduleId, mod.moduleLabel, mod.links)}
  {/each}
  <!--
    Last, because it is the catch-all: every module with a single place to configure, under one
    heading that can honestly cover more than one of them. It cannot be called "Modules" — the
    Workspace group above already has a row by that name, the switchboard at `/settings/modules`,
    and one word naming two different things on one screen is worse than either name alone.
  -->
  {#if moduleGroups.lone.length}
    {@render group('other', m.settings_other_section(), moduleGroups.lone)}
  {/if}
</div>

<style>
  /*
   * A module name is a module author's string, and a third-party one can be long. `SidebarGroup`'s
   * title row is a flex whose label sits in a button, and neither declares `min-width: 0` — so the
   * flex `auto` minimum holds the name at its full width, pushes the rule and the caret out of the
   * 268px column, and the sidebar scrolls sideways. Reaching into another component's class names
   * is not something to enjoy; the durable fix belongs in `@kernhq/ui`, and the column is ours to
   * keep intact until it lands.
   */
  .group :global(.ksg-title > .tb) {
    /*
     * 24px rather than 0 — it is the flex minimum, so the name still truncates, and it is also the
     * floor `ux.spec.ts` holds every target to. The title button draws only its text: 72x15px for
     * "Workspace", 19x17px for «افراد». WCAG 2.5.8 lets a small target pass when nothing else is
     * within 24px of it, and until this change nothing was — the sidebar never scrolled, so a group
     * heading only ever sat among the 34px rows it belongs to. Scrolling the active row into view
     * moves the headings above it out of the column's clip, where they overlap the tab strip's own
     * controls, and the audit reported ten of them at once. Two facts, both true: the button is
     * genuinely under-sized, and the crowding it was measured against is a phantom. Sizing it
     * settles the first, which settles the second for free.
     */
    min-width: 24px;
    min-height: 24px;
  }
  .group :global(.kern-section-label) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  /*
   * The caret is 16x16 and under the same floor, and once the row is allowed to shrink it is a flex
   * item like any other — measured, it went from 16px to 12px under a 43-character module name.
   * `flex: none` keeps the shrinking on the name, which is the only thing here that can afford to
   * lose width; the size makes it a target you can actually hit. The glyph stays 11px and stays
   * centred, so the row looks the same — the rule beside it gives up the 8px.
   */
  .group :global(.ksg-title > .caret-btn) {
    flex: none;
    width: 24px;
    height: 24px;
  }
</style>
