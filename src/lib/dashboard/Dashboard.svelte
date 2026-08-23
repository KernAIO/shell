<script lang="ts">
import type { AnyComponent, WidgetSettings, WidgetSize } from '@kernhq/ui'
import { untrack } from 'svelte'
import type { WidgetEntry } from '$lib/modules/registry'
import * as m from '$msg'
import {
  COLUMNS,
  cellAt,
  GAP,
  moveItem,
  nudge,
  type Placed,
  project,
  ROW_HEIGHT,
  readingOrder,
  reorder,
  resizeItem,
  SIZE_SPAN,
  stepSize,
} from './grid'
import { resolveSettings } from './settings'
import WidgetFrame from './WidgetFrame.svelte'

export interface BoardItem extends Placed {
  widget: string
  size: WidgetSize
  settings: WidgetSettings
}

interface Props {
  items: BoardItem[]
  widgets: WidgetEntry[]
  editing: boolean
  workspaceId: string
  workspaceSlug: string
  onChange: (items: BoardItem[]) => void
  onConfigure: (item: BoardItem) => void
  onRemove: (item: BoardItem) => void
}
let { items, widgets, editing, workspaceId, workspaceSlug, onChange, onConfigure, onRemove }: Props = $props()

let board = $state<HTMLElement | null>(null)
let width = $state(1200)
/** what the arrow keys and the live region are currently talking about */
let held = $state<string | null>(null)
let dragging = $state<string | null>(null)
let announcement = $state('')

const columns = $derived<12 | 6 | 1>(width < 640 ? 1 : width < 1024 ? 6 : 12)
/** Narrow screens are a projection, computed here and never written back. */
const shown = $derived(columns === COLUMNS ? items : projectItems(items, columns))

function projectItems(source: BoardItem[], cols: 12 | 6 | 1): BoardItem[] {
  const placed = project(source, cols)
  return placed.map((p) => {
    const original = source.find((s) => s.i === p.i)
    return { ...(original as BoardItem), ...p }
  })
}

const entryOf = (id: string) => widgets.find((w) => w.id === id)

/**
 * Lazy components are loaded once per widget id and remembered.
 *
 * `{#await entry.component()}` looks harmless and is not: the call happens during render, so every
 * re-render produces a *new* promise, the await block restarts, and every widget body on the board
 * unmounts and remounts — losing its query state and blinking empty. Focusing a grip was enough to
 * blank the whole dashboard. The cache is module-level because a component module is loaded once
 * per page anyway.
 */
const loaded = new Map<string, Promise<{ default: AnyComponent }>>()
function bodyOf(entry: WidgetEntry): Promise<{ default: AnyComponent }> {
  const cached = loaded.get(entry.id)
  if (cached) return cached
  const promise = entry.component() as Promise<{ default: AnyComponent }>
  loaded.set(entry.id, promise)
  return promise
}

const order = $derived(readingOrder(items).map((i) => i.i))

$effect(() => {
  if (!board) return
  const ro = new ResizeObserver(([entry]) => {
    if (entry) width = entry.contentRect.width
  })
  ro.observe(board)
  return () => ro.disconnect()
})

function commit(next: Placed[]) {
  const merged = next.map((p) => ({ ...(items.find((s) => s.i === p.i) as BoardItem), ...p }))
  onChange(merged)
}

// ---------------------------------------------------------------- pointer

interface Drag {
  id: string
  pointerId: number
  /** where the layout stood when the drag began, so Escape can put it back */
  snapshot: BoardItem[]
}
let drag: Drag | null = null

function direction(): 'ltr' | 'rtl' {
  return typeof document !== 'undefined' && document.dir === 'rtl' ? 'rtl' : 'ltr'
}

function onGrip(item: BoardItem, event: PointerEvent) {
  if (!editing || columns === 1) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  drag = { id: item.i, pointerId: event.pointerId, snapshot: $state.snapshot(items) as BoardItem[] }
  dragging = item.i
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', endDrag)
  window.addEventListener('keydown', cancelDrag, true)
}

function onPointerMove(event: PointerEvent) {
  if (!drag || !board) return
  const box = board.getBoundingClientRect()
  const cell = cellAt(
    { x: event.clientX - box.left, y: event.clientY - box.top },
    { width: box.width, rowHeight: ROW_HEIGHT, gap: GAP, columns },
    direction(),
  )
  commit(moveItem(items, drag.id, cell, columns))
}

function endDrag() {
  drag = null
  dragging = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', endDrag)
  window.removeEventListener('keydown', cancelDrag, true)
}

function cancelDrag(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !drag) return
  event.stopPropagation()
  onChange(drag.snapshot)
  endDrag()
}

// ---------------------------------------------------------------- resize

let resizing: { id: string; startW: number; startH: number; x: number; y: number } | null = null

function onResizeStart(item: BoardItem, event: PointerEvent) {
  if (!editing || columns === 1) return
  event.preventDefault()
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  resizing = { id: item.i, startW: item.w, startH: item.h, x: event.clientX, y: event.clientY }
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', endResize)
}

function onResizeMove(event: PointerEvent) {
  if (!resizing || !board) return
  const entry = entryOf(items.find((i) => i.i === resizing!.id)?.widget ?? '')
  if (!entry) return
  const colWidth = (board.getBoundingClientRect().width - GAP * (columns - 1)) / columns
  const dxRaw = event.clientX - resizing.x
  const dx = direction() === 'rtl' ? -dxRaw : dxRaw
  const wantW = resizing.startW + Math.round(dx / Math.max(1, colWidth + GAP))
  // Snap to a size the widget actually declared, rather than to arbitrary pixels.
  const best = entry.sizes.reduce((a, b) =>
    Math.abs(SIZE_SPAN[b].w - wantW) < Math.abs(SIZE_SPAN[a].w - wantW) ? b : a,
  )
  applySize(resizing.id, best)
}

function endResize() {
  resizing = null
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', endResize)
}

// ---------------------------------------------------------------- keyboard

/**
 * Everything the pointer can do, without one.
 *
 * A drag is unreachable by keyboard, so the grip doubles as a grab toggle: Enter or Space holds the
 * card, the arrows move it, Enter drops it and Escape puts it back where it was.
 *
 * The arrows only do anything while a card is *held*, and every handled key stops propagating.
 * Both matter: the shell binds its own shortcuts on `window`, and an unclaimed key press from here
 * reaches them — a bare `]` navigated to the issues list mid-test, which is a confusing way to lose
 * a layout you were arranging. Sizing and reordering live in the card's menu rather than on more
 * keys, because a shortcut that collides is worse than no shortcut.
 */
function onKeys(item: BoardItem, event: KeyboardEvent) {
  const entry = entryOf(item.widget)
  const claim = () => {
    event.preventDefault()
    event.stopPropagation()
  }

  if (event.key === 'Enter' || event.key === ' ') {
    claim()
    held = held === item.i ? null : item.i
    say(held ? m.dash_grabbed({ name: entry?.title ?? '' }) : m.dash_dropped({ name: entry?.title ?? '' }))
    return
  }
  if (event.key === 'Escape' && held === item.i) {
    claim()
    held = null
    say(m.dash_dropped({ name: entry?.title ?? '' }))
    return
  }

  const arrows: Record<string, 'left' | 'right' | 'up' | 'down'> = {
    ArrowLeft: direction() === 'rtl' ? 'right' : 'left',
    ArrowRight: direction() === 'rtl' ? 'left' : 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
  }
  const dir = arrows[event.key]
  // Not held: the arrows belong to whatever else is listening, including the browser's own scrolling.
  if (!dir || held !== item.i) return
  claim()

  let next = nudge(items, item.i, dir, columns)

  /*
   * Gravity pulls upward, so nudging a card *down* into empty space is undone the moment the layout
   * settles — pressing ArrowDown on the last card looked broken because the card genuinely went
   * nowhere. Vertically, the move somebody means is "put me after the next one", which is a reorder.
   * Fall back to it rather than reporting that a perfectly ordinary move is impossible.
   */
  if (next === items && (dir === 'up' || dir === 'down')) {
    next = reorder(items, item.i, dir === 'up' ? -1 : 1, columns)
  }

  if (next === items) {
    say(m.dash_move_blocked())
    return
  }
  commit(next)
  announce(item)
}

function applySize(id: string, size: WidgetSize) {
  const span = SIZE_SPAN[size]
  const resized = resizeItem(items, id, span, columns)
  onChange(
    resized.map((p) => {
      const original = items.find((s) => s.i === p.i) as BoardItem
      return { ...original, ...p, size: p.i === id ? size : original.size }
    }),
  )
}

/** Say where the card ended up. A move nobody can perceive is not an accessible move. */
function announce(item: BoardItem) {
  const now = untrack(() => items.find((i) => i.i === item.i))
  if (!now) return
  say(
    m.dash_moved({
      name: entryOf(item.widget)?.title ?? '',
      row: now.y + 1,
      column: now.x + 1,
    }),
  )
}

function say(text: string) {
  announcement = text
}
</script>

<div
  class="board"
  class:editing
  bind:this={board}
  style:--cols={columns}
  style:--row-h="{ROW_HEIGHT}px"
  style:--gap="{GAP}px"
>
  {#each shown as item (item.i)}
    {@const entry = entryOf(item.widget)}
    <div class="cell" style:grid-column="span {item.w}" style:grid-row="{item.y + 1} / span {item.h}">
      <WidgetFrame
        {entry}
        size={item.size}
        {editing}
        active={dragging === item.i}
        grabbed={held === item.i}
        first={order[0] === item.i}
        last={order[order.length - 1] === item.i}
        onGrip={(e) => onGrip(item, e)}
        onResizeStart={(e) => onResizeStart(item, e)}
        onKeys={(e) => onKeys(item, e)}
        onMove={(delta) => {
          const next = reorder(items, item.i, delta, columns)
          if (next === items) return say(m.dash_move_blocked())
          commit(next)
          announce(item)
        }}
        onSize={(size) => applySize(item.i, size)}
        onConfigure={() => onConfigure(item)}
        onRemove={() => onRemove(item)}
      >
        {#if entry}
          {#await bodyOf(entry) then mod}
            {@const Body = mod.default}
            <Body
              instanceId={item.i}
              {workspaceId}
              {workspaceSlug}
              settings={resolveSettings(entry.settings, item.settings)}
              size={item.size}
              span={{ w: item.w, h: item.h }}
              {editing}
              {columns}
              configure={() => onConfigure(item)}
            />
          {/await}
        {/if}
      </WidgetFrame>
    </div>
  {/each}
</div>

<!-- Announcements only; the grid itself is read through the cards. -->
<p class="sr" aria-live="polite">{announcement}</p>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
    grid-auto-rows: var(--row-h);
    gap: var(--gap);
    align-items: stretch;
  }
  /* A faint rule behind the grid while it is being rearranged, so the columns are visible. */
  .board.editing {
    background-image: repeating-linear-gradient(
      to right,
      var(--kern-border-hairline) 0 1px,
      transparent 1px calc(100% / var(--cols))
    );
  }
  .cell {
    min-width: 0;
    min-height: 0;
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>
