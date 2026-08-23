<script lang="ts">
import { Button, DropdownMenu, IconButton, type MenuItem } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import * as m from '$msg'
import { canTracker } from '../permissions'

/**
 * The tracker's control strip.
 *
 * A module that owns the sidebar owns the row above it: the shell's ⌘K box steps aside so this can
 * sit where a "New issue" button belongs, rather than being stacked under a second search field.
 * Split out of `TrackerSidebar` so the shell can place the two independently.
 */
interface Props {
  workspaceSlug: string
}
let { workspaceSlug }: Props = $props()

const inTracker = $derived(page.url.pathname === `/${workspaceSlug}/tracker`)
const canCreate = $derived(canTracker('create'))
const canManageProjects = $derived(canTracker('projectManage'))

/**
 * Opening a dialog is a parameter on the page you are on, not a jump to a blank one: raising an
 * issue from a filtered list keeps that list underneath.
 */
function ask(flag: string) {
  const url = inTracker ? new URL(page.url) : new URL(`/${workspaceSlug}/tracker`, page.url)
  url.searchParams.set(flag, '1')
  void goto(url, { keepFocus: true, noScroll: true })
}

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
          href: `/${workspaceSlug}/settings/tracker/import`,
        },
      ]
    : []),
])
</script>

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

<style>
  .controls {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .controls :global(.cta) {
    flex: 1;
  }
</style>
