<script lang="ts">
import { IconButton, type MenuItem, TabBar, type TabBarTab } from '@kernhq/ui'
import { goto } from '$app/navigation'
import { localPlace, localTime } from '$lib/format'
import { prefs } from '$lib/state/prefs.svelte'
import { indexOfId } from '$lib/state/tabs'
import { tabs } from '$lib/state/tabs.svelte'
import { destinationsFor, type NavSource } from '$lib/tabs-nav'
import * as m from '$msg'

/**
 * The workspace's open places, above the whole shell.
 *
 * This is the only thing that knows both the tab store and the workspace's navigation: it turns the
 * store's list into a strip, and the shell's destinations into what `+` offers. The strip itself
 * (`@kernhq/ui`) knows neither.
 */

interface Props {
  slug: string
  /** Navigation contributed by the enabled modules, as the rail and sidebar receive it. */
  nav: NavSource[]
  /** Unread notifications, so an inbox tab you are not on can say so. */
  unread?: number
  onsearch: () => void
}
let { slug, nav, unread = 0, onsearch }: Props = $props()

const items = $derived<TabBarTab[]>(
  tabs.items.map((tab) => ({
    id: tab.id,
    label: tab.label,
    icon: tab.icon,
    pinned: tab.pinned,
    dot: tab.href === '/inbox' && unread > 0,
    title: tab.pinned ? tab.label : undefined,
  })),
)

const newItems = $derived<MenuItem[]>([
  ...destinationsFor(nav).map((d) => ({
    id: `new-${d.href || 'home'}`,
    label: d.label,
    icon: d.icon,
    onSelect: () => tabs.open(d.href, { label: d.label, icon: d.icon }),
  })),
  { type: 'separator' as const },
  { id: 'new-search', label: m.tabs_new_search(), icon: 'search', shortcut: ['⌘', 'K'], onSelect: onsearch },
])

function menuFor(id: string): MenuItem[] {
  const at = indexOfId(tabs.items, id)
  const tab = tabs.items[at]
  if (!tab) return []
  return [
    { id: 'dup', label: m.tabs_duplicate(), icon: 'copy', onSelect: () => tabs.duplicate(id) },
    {
      id: 'pin',
      label: tab.pinned ? m.tabs_unpin() : m.tabs_pin(),
      icon: 'bookmark',
      onSelect: () => tabs.togglePin(id),
    },
    { type: 'separator' as const },
    // no icon: an arrow would point the wrong way in RTL, where the strip runs the other direction
    { id: 'prev', label: m.tabs_move_prev(), disabled: at <= 0, onSelect: () => tabs.move(at, at - 1) },
    {
      id: 'next',
      label: m.tabs_move_next(),
      disabled: at < 0 || at >= tabs.items.length - 1,
      onSelect: () => tabs.move(at, at + 1),
    },
    { type: 'separator' as const },
    {
      id: 'close',
      label: m.tabs_close(),
      icon: 'x',
      disabled: tab.pinned,
      onSelect: () => tabs.close(id),
    },
    {
      id: 'others',
      label: m.tabs_close_others(),
      disabled: tabs.items.filter((t) => !t.pinned && t.id !== id).length === 0,
      onSelect: () => tabs.closeOthers(id),
    },
    {
      id: 'right-of',
      label: m.tabs_close_right(),
      disabled: at < 0 || !tabs.items.slice(at + 1).some((t) => !t.pinned),
      onSelect: () => tabs.closeToRight(id),
    },
  ]
}

// the clock is only ever minutes deep, so it wakes on the minute rather than every second
let now = $state(new Date())
$effect(() => {
  if (!prefs.clock) return
  let interval: ReturnType<typeof setInterval> | undefined
  const tick = () => {
    now = new Date()
  }
  const align = setTimeout(
    () => {
      tick()
      interval = setInterval(tick, 60_000)
    },
    60_000 - (Date.now() % 60_000),
  )
  return () => {
    clearTimeout(align)
    if (interval) clearInterval(interval)
  }
})

const place = $derived(prefs.clock ? localPlace() : null)
</script>

<TabBar
  tabs={items}
  label={m.tabs_region()}
  activeId={tabs.activeId}
  newItems={newItems}
  newLabel={m.tabs_new()}
  closeLabel={m.tabs_close()}
  onselect={(id) => tabs.select(id)}
  onclose={(id) => tabs.close(id)}
  onreorder={(from, to) => tabs.move(from, to)}
  {menuFor}
>
  {#snippet actions()}
    <IconButton icon="search" label={m.search_placeholder()} size={26} onclick={onsearch} />
    {#if prefs.clock}
      <span class="clock" aria-hidden="true">
        {#if place}<span class="place">{place}</span>{/if}
        <span class="time">{localTime(now)}</span>
      </span>
    {/if}
    <IconButton
      icon="settings"
      label={m.nav_settings()}
      size={26}
      onclick={() => goto(`/${slug}/settings`)}
    />
  {/snippet}
</TabBar>

<style>
  .clock {
    display: inline-flex; align-items: baseline; gap: 6px;
    padding: 0 6px; white-space: nowrap;
    font-size: 12px; color: var(--kern-ink-400);
  }
  .place { letter-spacing: -0.005em; }
  .time { font-family: var(--kern-font-mono); font-size: 11.5px; color: var(--kern-ink-500); }
  /* the clock is the first thing to go when the strip runs out of room */
  @media (max-width: 1100px) { .clock { display: none; } }
</style>
