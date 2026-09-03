<script lang="ts">
import type { ClientContext, MenuItem, WidgetSettings, WidgetSize } from '@kernhq/ui'
import { Button, Dialog, DropdownMenu, EmptyState, Icon, Page, PageHeader, Skeleton, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { untrack } from 'svelte'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { toastMutationError } from '$lib/api/mutation-errors'
import NotificationBell from '$lib/components/NotificationBell.svelte'
import Dashboard, { type BoardItem } from '$lib/dashboard/Dashboard.svelte'
import { compact, SIZE_SPAN } from '$lib/dashboard/grid'
import { DEFAULT_PRESET_ID, expandPreset, PRESETS } from '$lib/dashboard/presets'
import WidgetPicker from '$lib/dashboard/WidgetPicker.svelte'
import WidgetSettingsSheet from '$lib/dashboard/WidgetSettingsSheet.svelte'
import { today } from '$lib/format'
import { capabilitiesOf, widgetsFor } from '$lib/modules/registry'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * The workspace home: a grid of widgets each module contributes.
 *
 * Three things decide what somebody sees, and the server resolves all three before this page runs —
 * the workspace policy, whether they have arranged anything of their own, and which preset applies.
 * The page only draws the answer and, when it is allowed to, lets somebody change it.
 */
const api = getApi()
const client = useQueryClient()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const workspaceId = $derived(workspace?.id ?? '')

/** Edit state lives in the URL, so it survives a reload and the back button leaves it. */
const editParam = $derived(page.url.searchParams.get('edit'))
const editingWorkspace = $derived(editParam === 'workspace')
const editing = $derived(editParam === '1' || editingWorkspace)

const modules = createQuery(() => ({
  queryKey: keys.modules(workspaceId),
  queryFn: () => api.workspaces.modules.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))

const view = createQuery(() => ({
  queryKey: keys.dashboard(workspaceId),
  queryFn: () => api.dashboard.get({ workspaceId, surface: 'home' }),
  enabled: Boolean(workspaceId),
}))

const settingsQuery = createQuery(() => ({
  queryKey: keys.dashboardSettings(workspaceId),
  queryFn: () => api.dashboard.settings.get({ workspaceId, surface: 'home' }),
  enabled: Boolean(workspaceId) && editingWorkspace,
}))

const enabled = $derived(
  new Set((modules.data ?? []).filter((e) => e.state.enabled).map((e) => e.manifest.id)),
)
/**
 * A widget behind a capability the workspace switched off leaves the picker *and* any layout that
 * already placed it — `known()` below is what the frame asks, so a card for a capability since
 * turned off offers to remove itself rather than drawing blank.
 */
const capabilities = $derived(capabilitiesOf(modules.data ?? []))

const ctx = $derived<ClientContext>({
  workspaceId: workspaceId || null,
  workspaceSlug: slug,
  userId: session.user?.id ?? null,
  permissions: new Set<string>(),
  capabilities,
  navigate: (href) => void goto(href),
  openPalette: () => {},
  toast: () => {},
  api,
})

const widgets = $derived(widgetsFor({ enabled, capabilities, can: (permission) => session.can(permission) }))
const known = $derived((id: string) => widgets.some((w) => w.id === id))

const canManage = $derived(session.can('core.workspace.manage'))
const locked = $derived(view.data?.policy === 'locked')
const canCustomise = $derived(Boolean(view.data?.canCustomise) || (locked && canManage))

// ------------------------------------------------------------------ the board

let items = $state<BoardItem[]>([])
let dirty = $state(false)
let seeded = $state('')

/**
 * Seed the board from whatever the server resolved.
 *
 * `dirty`, `items` and `editing` are all read through `untrack`: an effect that reads what it writes
 * re-runs itself, and this one re-seeding mid-edit would throw away the arrangement somebody was in
 * the middle of making. It keys off the fetched data only.
 */
$effect(() => {
  const data = editingWorkspace ? settingsQuery.data : view.data
  if (!data || !workspaceId) return
  const source = editingWorkspace
    ? (settingsQuery.data?.workspace?.items ?? null)
    : view.data?.source === 'preset'
      ? null
      : (view.data?.layout.items ?? null)
  const presetId = editingWorkspace
    ? (settingsQuery.data?.defaultPresetId ?? DEFAULT_PRESET_ID)
    : (view.data?.defaultPresetId ?? DEFAULT_PRESET_ID)
  const stamp = `${editingWorkspace}:${workspaceId}:${source ? 'stored' : `preset:${presetId}`}`

  untrack(() => {
    if (seeded === stamp && dirty) return
    seeded = stamp
    dirty = false
    items = source
      ? (source as BoardItem[]).map((it) => ({ ...it, settings: it.settings ?? {} }))
      : expandPreset(presetId, () => crypto.randomUUID(), known)
  })
})

function change(next: BoardItem[]) {
  items = next
  dirty = true
}

/**
 * What is actually drawn: the widgets this workspace still has, closed up.
 *
 * A saved layout can name a widget whose module has since been switched off. Dropping it is right —
 * every trace of a disabled module should go — but dropping it *in place* leaves a hole where the
 * card was, and a dashboard full of gaps looks broken rather than tidy. Compacting is what makes
 * turning a module off read as "that is gone" instead of "something is missing".
 *
 * The stored layout is left alone: turning the module back on restores the arrangement it had.
 */
const visible = $derived.by(() => {
  const kept = items.filter((item) => known(item.widget))
  if (kept.length === items.length) return items
  const packed = compact(kept)
  return packed.map((p) => ({ ...(kept.find((k) => k.i === p.i) as BoardItem), ...p }))
})

// ------------------------------------------------------------------ saving

const save = createMutation(() => ({
  mutationFn: (next: BoardItem[]) => {
    // A `$state` array is a deep proxy, and a proxy cannot be structuredClone'd.
    const payload = $state.snapshot(next) as BoardItem[]
    const body = {
      workspaceId,
      surface: 'home' as const,
      items: payload.map(({ i, widget, x, y, w, h, size, settings }) => ({
        i,
        widget,
        x,
        y,
        w,
        h,
        size,
        settings,
      })),
      presetId: null,
    }
    return editingWorkspace ? api.dashboard.settings.saveWorkspace(body) : api.dashboard.save(body)
  },
  onSuccess: () => {
    dirty = false
    toast.success(m.dash_saved())
    void client.invalidateQueries({ queryKey: ['core', 'dashboard'] })
    void goto(`/${slug}`)
  },
  onError: (e: unknown) => toastMutationError(e),
}))

const reset = createMutation(() => ({
  mutationFn: () => api.dashboard.reset({ workspaceId, surface: 'home' }),
  onSuccess: () => {
    dirty = false
    seeded = ''
    resetOpen = false
    void client.invalidateQueries({ queryKey: ['core', 'dashboard'] })
  },
  onError: (e: unknown) => toastMutationError(e),
}))

// ------------------------------------------------------------------ editing

let pickerOpen = $state(false)
let resetOpen = $state(false)
let configuring = $state<BoardItem | null>(null)

const presetName = (id: string) =>
  ({
    'my-work': m.dash_preset_my_work(),
    delivery: m.dash_preset_delivery(),
    communication: m.dash_preset_communication(),
    focus: m.dash_preset_focus(),
  })[id] ?? id

const presetMenu = $derived<MenuItem[]>(
  PRESETS.map((p) => ({
    label: presetName(p.id),
    onSelect: () => {
      items = expandPreset(p.id, () => crypto.randomUUID(), known)
      dirty = true
    },
  })),
)

function add(widgetId: string, size: WidgetSize) {
  const span = SIZE_SPAN[size]
  const entry = widgets.find((w) => w.id === widgetId)
  const settings: WidgetSettings = {}
  for (const field of entry?.settings ?? []) settings[field.key] = field.default
  change([...items, { i: crypto.randomUUID(), widget: widgetId, size, settings, x: 0, y: 999, ...span }])
  pickerOpen = false
}

/** Removing a widget is not destructive, so it is undone rather than confirmed. */
function remove(item: BoardItem) {
  const before = $state.snapshot(items) as BoardItem[]
  const name = widgets.find((w) => w.id === item.widget)?.title ?? ''
  change(items.filter((i) => i.i !== item.i))
  toast.success(m.dash_removed({ name }), {
    action: { label: m.dash_undo(), onClick: () => change(before) },
  })
}

const greeting = $derived.by(() => {
  const name = session.user?.name?.split(' ')[0] ?? ''
  const hour = new Date().getHours()
  if (hour < 12) return m.home_greeting_morning({ name })
  if (hour < 18) return m.home_greeting_afternoon({ name })
  return m.home_greeting_evening({ name })
})
</script>

<svelte:head><title>{m.nav_home()} · {workspace?.name ?? 'Kern'}</title></svelte:head>

<Page padding="home">
  <PageHeader
    title={editingWorkspace ? m.dash_edit_workspace_layout() : greeting}
    subtitle={editingWorkspace ? m.dash_editing_workspace() : today()}
  >
    {#snippet actions()}
      {#if editing}
        <Button variant="secondary" onclick={() => (pickerOpen = true)}>
          <Icon name="plus" size={15} />
          {m.dash_add_widget()}
        </Button>
        <DropdownMenu items={presetMenu}>
          {#snippet trigger(props)}
            <Button {...props} variant="ghost">{m.dash_presets()}</Button>
          {/snippet}
        </DropdownMenu>
        {#if !editingWorkspace && view.data?.source === 'personal'}
          <Button variant="ghost" onclick={() => (resetOpen = true)}>{m.dash_reset()}</Button>
        {/if}
        <Button loading={save.isPending} onclick={() => save.mutate(items)}>
          {editingWorkspace ? m.dash_save_for_workspace() : m.done()}
        </Button>
      {:else}
        {#if workspace}
          <NotificationBell workspaceId={workspace.id} workspaceSlug={slug} />
        {/if}
        {#if canCustomise}
          <Button variant="ghost" onclick={() => goto(`/${slug}?edit=1`)}>
            <Icon name="sliders-vertical" size={15} />
            {m.dash_customise()}
          </Button>
        {/if}
      {/if}
    {/snippet}
  </PageHeader>

  <div class="body">
    {#if view.isPending || modules.isPending}
      <div class="loading">
        {#each [1, 2, 3, 4] as i (i)}<Skeleton height="120px" radius="11px" />{/each}
      </div>
    {:else if items.length === 0}
      <EmptyState
        icon="layout-dashboard"
        title={m.dash_empty_title()}
        description={canCustomise ? m.dash_empty_hint() : m.dash_locked_note()}
      >
        {#snippet actions()}
          {#if canCustomise}
            <Button onclick={() => goto(`/${slug}?edit=1`)}>{m.dash_customise()}</Button>
          {/if}
        {/snippet}
      </EmptyState>
    {:else}
      <Dashboard
        items={visible}
        {widgets}
        {editing}
        {workspaceId}
        workspaceSlug={slug}
        onChange={change}
        onConfigure={(item) => (configuring = item)}
        onRemove={remove}
      />
    {/if}

    <!-- Said plainly rather than left to be inferred from a missing button. -->
    {#if locked && !editing && items.length > 0}
      <p class="locked"><Icon name="lock" size={12} /> {m.dash_locked_note()}</p>
    {/if}
  </div>
</Page>

<WidgetPicker
  bind:open={pickerOpen}
  {widgets}
  placed={items.map((i) => i.widget)}
  {ctx}
  onPick={(entry) => add(entry.id, entry.defaultSize)}
  onOpenChange={(o) => (pickerOpen = o)}
/>

<WidgetSettingsSheet
  open={configuring !== null}
  entry={widgets.find((w) => w.id === configuring?.widget)}
  value={configuring?.settings ?? {}}
  {workspaceId}
  workspaceSlug={slug}
  userId={session.user?.id ?? null}
  onSave={(next) => {
    if (!configuring) return
    const id = configuring.i
    change(items.map((it) => (it.i === id ? { ...it, settings: next } : it)))
  }}
  onOpenChange={(o) => {
    if (!o) configuring = null
  }}
/>

<!--
  Reset says what it returns to, by name, because that depends on the workspace policy: under
  `default` it is the workspace layout, under `open` it is the preset.
-->
<Dialog
  bind:open={resetOpen}
  title={m.dash_reset_title()}
  description={view.data?.policy === 'default'
    ? m.dash_reset_to_workspace()
    : m.dash_reset_to_preset({ name: presetName(view.data?.defaultPresetId ?? DEFAULT_PRESET_ID) })}
  size="sm"
>
  {#snippet children()}{/snippet}
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (resetOpen = false)}>{m.cancel()}</Button>
    <Button loading={reset.isPending} onclick={() => reset.mutate()}>{m.dash_reset()}</Button>
  {/snippet}
</Dialog>

<style>
  .body {
    display: grid;
    gap: 12px;
  }
  .loading {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  .locked {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-block-start: 4px;
    font-size: 12.5px;
    color: var(--kern-ink-350);
  }
</style>
