/**
 * The dashboard's geometry.
 *
 * Pure on purpose: no Svelte, no DOM, and above all no `$msg` — a module that imports the message
 * catalogue cannot be unit-tested, because SvelteKit's alias plugin does not run under vitest. A
 * dashboard breaks in its arithmetic far more often than in its markup, so this is the part that
 * has to be testable.
 *
 * Everything here works on a twelve-column grid. Narrower screens are a *projection* computed at
 * render time and never written back: if six-column geometry were saved, going back to a wide
 * screen would show a layout nobody arranged.
 */

export const COLUMNS = 12
export const ROW_HEIGHT = 84
export const GAP = 12

export type WidgetSize = 's' | 'm' | 'l' | 'xl'

/** What each step size spans. Nobody picks pixels; they pick one of these. */
export const SIZE_SPAN: Record<WidgetSize, { w: number; h: number }> = {
  s: { w: 3, h: 1 },
  m: { w: 4, h: 3 },
  l: { w: 6, h: 4 },
  xl: { w: 12, h: 5 },
}

export const SIZE_ORDER: WidgetSize[] = ['s', 'm', 'l', 'xl']

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export interface Placed extends Rect {
  i: string
}

export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Reading order: row first, then column. The order the keyboard, the DOM and a screen reader use. */
export function readingOrder(items: Placed[]): Placed[] {
  return [...items].sort((a, b) => a.y - b.y || a.x - b.x)
}

/**
 * Lay items out so none overlap, in reading order, pushing down where they must.
 *
 * `priority` is the item the person is holding: it sorts ahead of anything sharing its row, so the
 * card being dragged keeps the slot it was dropped on and its neighbours move instead.
 */
function settleDown(items: Placed[], priority?: string): Placed[] {
  const sorted = [...items].sort(
    (a, b) => a.y - b.y || (a.i === priority ? -1 : 0) - (b.i === priority ? -1 : 0) || a.x - b.x,
  )
  const placed: Placed[] = []
  for (const it of sorted) {
    const cur = { ...it }
    let guard = 0
    while (placed.some((p) => overlaps(p, cur)) && guard++ < 500) cur.y += 1
    placed.push(cur)
  }
  return placed
}

/** Gravity: pull everything up until it rests on something or on row zero. */
export function compact(items: Placed[]): Placed[] {
  const placed: Placed[] = []
  for (const it of readingOrder(items)) {
    const cur = { ...it }
    let guard = 0
    while (cur.y > 0 && !placed.some((p) => overlaps(p, { ...cur, y: cur.y - 1 })) && guard++ < 500) {
      cur.y -= 1
    }
    placed.push(cur)
  }
  return readingOrder(placed)
}

/** Resolve overlaps, then let gravity take over. Every mutation below ends here. */
function settle(items: Placed[], priority?: string): Placed[] {
  return compact(settleDown(items, priority))
}

/** The first origin a `w`×`h` card fits, scanning row by row. */
export function findSlot(items: Placed[], w: number, h: number, columns = COLUMNS): { x: number; y: number } {
  const width = clamp(w, 1, columns)
  for (let y = 0; y < 400; y++) {
    for (let x = 0; x + width <= columns; x++) {
      if (!items.some((it) => overlaps(it, { x, y, w: width, h }))) return { x, y }
    }
  }
  return { x: 0, y: 400 }
}

export function addItem(items: Placed[], item: Omit<Placed, 'x' | 'y'>, columns = COLUMNS): Placed[] {
  const at = findSlot(items, item.w, item.h, columns)
  return settle([...items, { ...item, ...at }], item.i)
}

export function removeItem(items: Placed[], id: string): Placed[] {
  return compact(items.filter((it) => it.i !== id))
}

export function moveItem(
  items: Placed[],
  id: string,
  to: { x: number; y: number },
  columns = COLUMNS,
): Placed[] {
  const target = items.find((it) => it.i === id)
  if (!target) return items
  const next = items.map((it) =>
    it.i === id ? { ...it, x: clamp(to.x, 0, columns - it.w), y: Math.max(0, to.y) } : it,
  )
  return settle(next, id)
}

export function resizeItem(
  items: Placed[],
  id: string,
  span: { w: number; h: number },
  columns = COLUMNS,
): Placed[] {
  const target = items.find((it) => it.i === id)
  if (!target) return items
  const w = clamp(span.w, 1, columns)
  const next = items.map((it) =>
    it.i === id ? { ...it, w, h: Math.max(1, span.h), x: clamp(it.x, 0, columns - w) } : it,
  )
  return settle(next, id)
}

/**
 * One step in a direction.
 *
 * Returns the **same array reference** when the step is impossible, which is how the caller knows
 * whether there is anything to announce — a keyboard user who hears "moved" after nothing moved
 * loses track of where they are.
 */
export function nudge(
  items: Placed[],
  id: string,
  dir: 'left' | 'right' | 'up' | 'down',
  columns = COLUMNS,
): Placed[] {
  const it = items.find((p) => p.i === id)
  if (!it) return items
  const to = {
    left: { x: it.x - 1, y: it.y },
    right: { x: it.x + 1, y: it.y },
    up: { x: it.x, y: it.y - 1 },
    down: { x: it.x, y: it.y + 1 },
  }[dir]
  if (to.x < 0 || to.x + it.w > columns || to.y < 0) return items
  const next = moveItem(items, id, to, columns)
  const moved = next.find((p) => p.i === id)
  return moved && (moved.x !== it.x || moved.y !== it.y) ? next : items
}

/**
 * Swap with the neighbour in reading order.
 *
 * `nudge` can be blocked in a dense layout — every direction is occupied and gravity puts the card
 * straight back. This always does something, which is what makes it the route the keyboard can rely
 * on and the one the overflow menu offers.
 */
export function reorder(items: Placed[], id: string, delta: -1 | 1, columns = COLUMNS): Placed[] {
  const order = readingOrder(items)
  const at = order.findIndex((p) => p.i === id)
  const to = at + delta
  if (at < 0 || to < 0 || to >= order.length) return items
  const a = order[at]!
  const b = order[to]!
  const swapped = items.map((p) => {
    if (p.i === a.i) return { ...p, x: clamp(b.x, 0, columns - p.w), y: b.y }
    if (p.i === b.i) return { ...p, x: clamp(a.x, 0, columns - p.w), y: a.y }
    return p
  })
  return settle(swapped, id)
}

/**
 * Project a twelve-column layout onto a narrower one. Never written back.
 *
 * At one column the grid stops being a grid, so reading order is the whole answer — which is why
 * `readingOrder` is the same function the keyboard uses.
 */
export function project(items: Placed[], columns: 12 | 6 | 1): Placed[] {
  if (columns === COLUMNS) return compact(items)
  if (columns === 1) {
    return readingOrder(items).map((it, idx) => ({ ...it, x: 0, y: idx, w: 1 }))
  }
  const half = items.map((it) => {
    const w = clamp(Math.round(it.w / 2), 1, columns)
    return { ...it, w, x: clamp(Math.floor(it.x / 2), 0, columns - w) }
  })
  return compact(settleDown(half))
}

/**
 * Which cell a pointer is over.
 *
 * `dir` is not decoration. Under RTL, CSS grid has already mirrored the columns, so column 0 is on
 * the right of the screen — an unmirrored pointer would drag a card the opposite way to the hand
 * holding it.
 */
export function cellAt(
  point: { x: number; y: number },
  box: { width: number; rowHeight?: number; gap?: number; columns?: number },
  dir: 'ltr' | 'rtl' = 'ltr',
): { x: number; y: number } {
  const columns = box.columns ?? COLUMNS
  const gap = box.gap ?? GAP
  const rowHeight = box.rowHeight ?? ROW_HEIGHT
  const colWidth = (box.width - gap * (columns - 1)) / columns
  const raw = clamp(Math.floor(point.x / Math.max(1, colWidth + gap)), 0, columns - 1)
  return {
    x: dir === 'rtl' ? columns - 1 - raw : raw,
    y: Math.max(0, Math.floor(point.y / Math.max(1, rowHeight + gap))),
  }
}

/**
 * Repair a layout that came out of the database.
 *
 * `items` is a jsonb column, so the database guarantees only that it is JSON. A row written by an
 * older version of the app, by a later one that was rolled back, or by hand, must not be able to
 * draw two cards on top of each other or place one off the grid. This runs on every read — it is
 * what makes storing geometry as jsonb safe rather than merely convenient.
 */
export function normalise(items: Placed[], columns = COLUMNS): Placed[] {
  const seen = new Set<string>()
  const clean: Placed[] = []
  for (const it of items) {
    if (!it || typeof it.i !== 'string' || seen.has(it.i)) continue
    seen.add(it.i)
    const w = clamp(Math.trunc(it.w) || 1, 1, columns)
    clean.push({
      i: it.i,
      w,
      h: clamp(Math.trunc(it.h) || 1, 1, 12),
      x: clamp(Math.trunc(it.x) || 0, 0, columns - w),
      y: clamp(Math.trunc(it.y) || 0, 0, 400),
    })
  }
  return settle(clean)
}

/** The next size up or down, staying inside what the widget declared. */
export function stepSize(sizes: WidgetSize[], current: WidgetSize, delta: -1 | 1): WidgetSize {
  const allowed = SIZE_ORDER.filter((s) => sizes.includes(s))
  const at = allowed.indexOf(current)
  if (at < 0) return allowed[0] ?? current
  return allowed[clamp(at + delta, 0, allowed.length - 1)] ?? current
}
