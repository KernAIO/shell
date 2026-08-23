/**
 * The model behind the window tab strip (DESIGN.md §2.0).
 *
 * A tab is a place in the workspace you left open — nothing more. It holds a workspace-relative
 * href, so the list survives the workspace being renamed, and a label and icon that are only ever a
 * cache of what that href was called the last time it was on screen.
 *
 * Everything here is a pure function over a tab list. The reactive store in `tabs.svelte.ts` owns the
 * state and the navigation; keeping the rules out of it is what makes them testable without a
 * browser, and it is where the awkward cases actually live: closing the tab you are looking at,
 * dragging across the pinned block, restoring a list written by an older version of the app.
 */

/** What a tab is called and how it is drawn. Derived from the href, refined by the page. */
export interface TabMeta {
  label: string
  icon: string
}

export interface WorkTab extends TabMeta {
  id: string
  /** Workspace-relative, including the query: `''`, `'/inbox'`, `'/chat?c=abc'`. */
  href: string
  /** Pinned tabs sit at the front of the strip, shrink to their icon and do not close in bulk. */
  pinned: boolean
  /**
   * The page named this one; the shell must not overwrite it.
   *
   * Without this the two namings fight: the href-derived label is reapplied on every navigation, so
   * `eng-core` reverts to `Chat` the moment you move anywhere. A derived label still needs
   * refreshing — the interface language can change under it — which is exactly what this flag makes
   * safe to do.
   */
  named: boolean
}

/**
 * Enough tabs to work with, few enough that the strip is still readable. Opening past the cap drops
 * the oldest unpinned tab rather than refusing, because refusing to open what you asked for is the
 * more annoying of the two.
 */
export const MAX_TABS = 20

let seq = 0
function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  seq += 1
  return `tab-${seq}`
}

/**
 * The part of a URL a tab remembers: everything after `/:workspace`, query included.
 *
 * The hash is left out on purpose — an anchor within a page is a scroll position, not a destination,
 * and remembering it would reopen the tab halfway down.
 */
export function relativeHref(pathname: string, search: string, slug: string): string {
  const prefix = `/${slug}`
  let rest =
    pathname === prefix ? '' : pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname
  if (rest.length > 1 && rest.endsWith('/')) rest = rest.slice(0, -1)
  return `${rest}${search && search !== '?' ? search : ''}`
}

export function makeTab(href: string, meta: TabMeta, id: string = makeId()): WorkTab {
  return { id, href, label: meta.label, icon: meta.icon, pinned: false, named: false }
}

export function findByHref(tabs: WorkTab[], href: string): WorkTab | undefined {
  return tabs.find((t) => t.href === href)
}

export function indexOfId(tabs: WorkTab[], id: string): number {
  return tabs.findIndex((t) => t.id === id)
}

/** Pinned first, order preserved inside each block. Every mutation ends here. */
export function order(tabs: WorkTab[]): WorkTab[] {
  return [...tabs.filter((t) => t.pinned), ...tabs.filter((t) => !t.pinned)]
}

/**
 * Add a tab after the active one — where a browser puts it, and where you look for it.
 *
 * Past the cap the oldest unpinned tab that is not the one you are on gives way; if every tab is
 * pinned there is nothing to drop and the list simply grows.
 */
export function insertTab(tabs: WorkTab[], tab: WorkTab, activeId: string | null): WorkTab[] {
  const at = indexOfId(tabs, activeId ?? '')
  const next = [...tabs]
  next.splice(at < 0 ? next.length : at + 1, 0, tab)
  if (next.length > MAX_TABS) {
    const victim = next.find((t) => !t.pinned && t.id !== tab.id && t.id !== activeId)
    if (victim) return order(next.filter((t) => t.id !== victim.id))
  }
  return order(next)
}

/**
 * Close one tab and say what to look at next.
 *
 * Closing the tab you are on moves you to its right neighbour, falling back to its left — the rule
 * every browser uses, and the one that keeps a run of closes moving in a single direction. Closing a
 * tab you are not on leaves you where you are. Emptying the strip returns a null active id; the
 * caller decides what to open in its place, because only it knows where "home" is.
 */
export function closeTab(
  tabs: WorkTab[],
  activeId: string | null,
  id: string,
): { tabs: WorkTab[]; activeId: string | null; closed: WorkTab | null } {
  const at = indexOfId(tabs, id)
  if (at < 0) return { tabs, activeId, closed: null }
  const closed = tabs[at] as WorkTab
  const next = tabs.filter((t) => t.id !== id)
  if (id !== activeId) return { tabs: next, activeId, closed }
  const heir = next[at] ?? next[at - 1] ?? null
  return { tabs: next, activeId: heir?.id ?? null, closed }
}

export function closeOthers(tabs: WorkTab[], id: string): WorkTab[] {
  return tabs.filter((t) => t.id === id || t.pinned)
}

export function closeToRight(tabs: WorkTab[], id: string): WorkTab[] {
  const at = indexOfId(tabs, id)
  if (at < 0) return tabs
  return tabs.filter((t, i) => i <= at || t.pinned)
}

/** Move a tab within the strip. The pinned block still comes first, so a drag across it is clamped. */
export function moveTab(tabs: WorkTab[], from: number, to: number): WorkTab[] {
  if (from === to || from < 0 || to < 0 || from >= tabs.length || to >= tabs.length) return tabs
  const next = [...tabs]
  const [moved] = next.splice(from, 1)
  if (!moved) return tabs
  next.splice(to, 0, moved)
  return order(next)
}

export function setPinned(tabs: WorkTab[], id: string, pinned: boolean): WorkTab[] {
  return order(tabs.map((t) => (t.id === id ? { ...t, pinned } : t)))
}

/**
 * Relabel every tab pointing at this href — the page that just named itself may not be the active one.
 *
 * `named` says who is speaking. A page's name sticks; the shell's derived one may be replaced by
 * another derived one, but never overwrites a page's.
 */
export function describe(tabs: WorkTab[], href: string, meta: Partial<TabMeta>, named = true): WorkTab[] {
  let changed = false
  const next = tabs.map((t) => {
    if (t.href !== href) return t
    if (t.named && !named) return t
    const label = meta.label ?? t.label
    const icon = meta.icon ?? t.icon
    if (label === t.label && icon === t.icon && t.named === named) return t
    changed = true
    return { ...t, label, icon, named }
  })
  return changed ? next : tabs
}

/** The tab `delta` steps away, wrapping around the ends. */
export function stepId(tabs: WorkTab[], activeId: string | null, delta: number): string | null {
  if (!tabs.length) return null
  const at = indexOfId(tabs, activeId ?? '')
  const from = at < 0 ? 0 : at
  const to = (((from + delta) % tabs.length) + tabs.length) % tabs.length
  return tabs[to]?.id ?? null
}

/**
 * Read back what was written to storage.
 *
 * Anything that is not a plausible tab list is discarded rather than repaired: a broken strip is
 * recoverable by opening a tab, whereas a half-restored one is a puzzle.
 */
export function restore(raw: unknown): { tabs: WorkTab[]; activeId: string | null } | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { tabs, activeId } = raw as { tabs?: unknown; activeId?: unknown }
  if (!Array.isArray(tabs)) return null
  const parsed: WorkTab[] = []
  for (const entry of tabs) {
    if (typeof entry !== 'object' || entry === null) return null
    const t = entry as Record<string, unknown>
    if (typeof t.id !== 'string' || typeof t.href !== 'string' || typeof t.label !== 'string') return null
    parsed.push({
      id: t.id,
      href: t.href,
      label: t.label,
      icon: typeof t.icon === 'string' ? t.icon : 'circle',
      pinned: t.pinned === true,
      named: t.named === true,
    })
  }
  if (!parsed.length) return null
  const active =
    typeof activeId === 'string' && parsed.some((t) => t.id === activeId) ? activeId : parsed[0]!.id
  return { tabs: order(parsed).slice(0, MAX_TABS), activeId: active }
}
