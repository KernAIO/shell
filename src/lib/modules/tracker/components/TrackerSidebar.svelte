<script lang="ts">
import { Button, DropdownMenu, IconButton, type MenuItem, SidebarGroup, SidebarItem } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import * as m from '$msg'
import { isTrackerTarget, type TrackerTarget, trackerHref } from '../nav'
import { canTracker } from '../permissions'
import SidebarProjects from './SidebarProjects.svelte'
import SidebarViews from './SidebarViews.svelte'

/**
 * The tracker, in the application sidebar (DESIGN.md 2.3).
 *
 * The rail switches modules and the sidebar holds the one you are in, so this is the tracker's own
 * navigation: what you make, what you look at, the queries somebody named, and the projects with
 * the ways each of them is planned. Every row is a link to a query the issues screen reads out of
 * the URL — no row puts the page into a state that cannot be linked to, shared or gone back from.
 *
 * The control strip is the module's rather than the shell's (the shell steps aside when a module
 * fills the sidebar), which is why "New issue" lives here, beside the menu of the other things a
 * tracker makes.
 */
const slug = $derived(page.params.ws ?? '')
const params = $derived(page.url.searchParams)
const inTracker = $derived(page.url.pathname === `/${slug}/tracker`)

const canCreate = $derived(canTracker('create'))
const canManageProjects = $derived(canTracker('projectManage'))

/**
 * Opening a dialog is a parameter on the page you are on, not a jump to a blank one: raising an
 * issue from a filtered list keeps that list underneath, the way the toolbar's own buttons do.
 */
function ask(flag: string) {
  const url = inTracker ? new URL(page.url) : new URL(`/${slug}/tracker`, page.url)
  url.searchParams.set(flag, '1')
  void goto(url, { keepFocus: true, noScroll: true })
}

/** What else a tracker makes, behind the primary action rather than beside it. */
const createMenu = $derived<MenuItem[]>([
  ...(canCreate
    ? [
        {
          type: 'item' as const,
          id: 'issue',
          label: m.tracker_new_issue(),
          icon: 'square-check-big',
          shortcut: ['c'],
          onSelect: () => ask('new'),
        },
      ]
    : []),
  ...(canManageProjects
    ? [
        {
          type: 'item' as const,
          id: 'project',
          label: m.tracker_project_new(),
          icon: 'folder',
          onSelect: () => ask('new_project'),
        },
        {
          type: 'item' as const,
          id: 'import',
          label: m.tracker_settings_import(),
          icon: 'upload',
          href: `/${slug}/settings/tracker/import`,
        },
      ]
    : []),
])

/** How the whole workspace's work is looked at, before any one project's. */
const rows: { id: string; label: () => string; icon: string; target: TrackerTarget }[] = [
  { id: 'mine', label: () => m.tracker_cmd_my_issues(), icon: 'circle-user', target: { preset: 'assigned' } },
  { id: 'all', label: () => m.tracker_all_issues(), icon: 'square-check-big', target: {} },
  {
    id: 'projects',
    label: () => m.tracker_all_projects(),
    icon: 'layout-grid',
    target: { group: 'project' },
  },
]
</script>

<div class="tsb">
  {#if canCreate || canManageProjects}
    <div class="controls">
      <Button
        icon="plus"
        rounded="xl"
        class="cta"
        onclick={() => ask(canCreate ? 'new' : 'new_project')}
        data-testid="sidebar-new-issue"
      >
        {canCreate ? m.tracker_new_issue() : m.tracker_project_new()}
      </Button>
      {#if createMenu.length > 1}
        <DropdownMenu items={createMenu} align="end">
          {#snippet trigger(props)}
            <IconButton
              {...props}
              icon="chevron-down"
              label={m.tracker_create_more()}
              size={34}
              radius={9}
              variant="outline"
              data-testid="sidebar-create-menu"
            />
          {/snippet}
        </DropdownMenu>
      {/if}
    </div>
  {/if}

  <SidebarGroup title={m.tracker_title()}>
    {#each rows as row (row.id)}
      <SidebarItem
        label={row.label()}
        icon={row.icon}
        href={trackerHref(slug, row.target)}
        active={inTracker && isTrackerTarget(params, row.target)}
        data-testid="tracker-nav-{row.id}"
      />
    {/each}
    <SidebarItem
      label={m.tracker_reports_title()}
      icon="chart-line"
      href="/{slug}/tracker/reports"
      active={page.url.pathname === `/${slug}/tracker/reports`}
    />
  </SidebarGroup>

  <SidebarViews onsave={() => ask('save')} />
  <SidebarProjects oncreate={() => ask('new_project')} />
</div>

<style>
.tsb {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
/* DESIGN.md 2.3 control strip: the primary action takes the row, the menu takes what is left. */
.controls {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 12px 4px;
  flex: none;
}
.controls :global(.cta) {
  flex: 1;
  min-width: 0;
  height: 34px;
}
</style>
