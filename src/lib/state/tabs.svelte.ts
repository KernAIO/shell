import { browser } from '$app/environment'
import { goto } from '$app/navigation'
import {
  closeOthers,
  closeTab,
  closeToRight,
  describe,
  findByHref,
  indexOfId,
  insertTab,
  makeTab,
  moveTab,
  restore,
  setPinned,
  stepId,
  type TabMeta,
  type WorkTab,
} from './tabs'

/**
 * The open places in a workspace, and the navigation that goes with them.
 *
 * The rules are in `tabs.ts`; this holds the state, persists it per workspace and is the only thing
 * that moves the address bar. Two decisions worth stating:
 *
 * - A tab follows you. Clicking something inside a page changes where that tab points, exactly as a
 *   link does in a browser — a new tab is only ever opened deliberately, from `+`, the context menu
 *   or ⌥T.
 * - Each workspace keeps its own strip. Switching workspace is not switching view; the tabs you had
 *   open in one are not the ones you want in the other, and they are waiting when you come back.
 */

const key = (slug: string) => `kern.tabs.${slug}`

class TabsState {
  slug = $state<string | null>(null)
  items = $state<WorkTab[]>([])
  activeId = $state<string | null>(null)

  /** Closed tabs, most recent first — what ⇧⌥T puts back. Session-only: a mistake is undone now or not at all. */
  #closed: WorkTab[] = []

  get active(): WorkTab | null {
    return this.items.find((t) => t.id === this.activeId) ?? null
  }

  get canReopen(): boolean {
    return this.#closed.length > 0
  }

  /**
   * Point the strip at a workspace and make sure the page you are on is one of its tabs.
   *
   * The restored list is kept as it was and the current URL is adopted into it — a reload lands you
   * back where you were with everything else still open, rather than replacing the session with one
   * tab.
   */
  attach(slug: string, href: string, resolve: (href: string) => TabMeta) {
    if (this.slug === slug) {
      this.sync(href, resolve)
      return
    }
    this.slug = slug
    this.#closed = []
    const stored = this.#read(slug)
    if (!stored) {
      this.items = [makeTab(href, resolve(href))]
      this.activeId = this.items[0]!.id
      this.#save()
      return
    }
    this.items = stored.tabs
    this.activeId = stored.activeId
    const existing = findByHref(this.items, href)
    if (existing) this.activeId = existing.id
    else this.#push(makeTab(href, resolve(href)))
    this.#refresh(resolve)
    this.#save()
  }

  /** Called after every navigation: the tab you are on is now pointing here. */
  sync(href: string, resolve: (href: string) => TabMeta) {
    if (!this.items.length) {
      this.items = [makeTab(href, resolve(href))]
      this.activeId = this.items[0]!.id
      this.#save()
      return
    }
    const active = this.active
    if (!active) {
      this.activeId = this.items[0]!.id
      return
    }
    if (active.href !== href) {
      this.items = this.items.map((t) =>
        t.id === active.id ? { ...t, href, ...resolve(href), named: false } : t,
      )
    }
    this.#refresh(resolve)
    this.#save()
  }

  /**
   * Re-derive the names the shell gave, and leave the ones the pages gave.
   *
   * Every tab, not just the one you are on: after a language change the strip would otherwise stay in
   * the old language until each tab was visited, which is how you end up with "Inbox" and "Settings"
   * sitting in a Persian window. `named` is what keeps `eng-core` out of it — reapplying the derived
   * name unconditionally used to undo whatever the page had called itself.
   */
  #refresh(resolve: (href: string) => TabMeta) {
    let next = this.items
    for (const tab of this.items) {
      if (tab.named) continue
      next = describe(next, tab.href, resolve(tab.href), false)
    }
    if (next !== this.items) this.items = next
  }

  /**
   * Refine what a tab is called once the page knows.
   *
   * The shell can only name a tab after its URL — "Chat" — while the page knows it is `# eng-core`.
   * Keyed by href so a page that has already been navigated away from cannot rename its successor.
   */
  describe(href: string, meta: Partial<TabMeta>) {
    const next = describe(this.items, href, meta)
    if (next === this.items) return
    this.items = next
    this.#save()
  }

  /** Open a place in its own tab, or go to the tab already showing it. */
  open(href: string, meta: TabMeta) {
    const existing = findByHref(this.items, href)
    if (existing) {
      this.select(existing.id)
      return
    }
    this.#push(makeTab(href, meta))
    this.#save()
    this.#go(href)
  }

  duplicate(id: string) {
    const tab = this.items.find((t) => t.id === id)
    if (!tab) return
    this.#push(makeTab(tab.href, { label: tab.label, icon: tab.icon }))
    this.#save()
    this.#go(tab.href)
  }

  select(id: string) {
    const tab = this.items.find((t) => t.id === id)
    if (!tab || id === this.activeId) return
    this.activeId = id
    this.#save()
    this.#go(tab.href)
  }

  selectIndex(index: number) {
    const tab = index < 0 ? this.items.at(-1) : this.items[index]
    if (tab) this.select(tab.id)
  }

  step(delta: number) {
    const id = stepId(this.items, this.activeId, delta)
    if (id) this.select(id)
  }

  close(id: string) {
    const result = closeTab(this.items, this.activeId, id)
    if (!result.closed) return
    this.#closed.unshift(result.closed)
    this.#closed = this.#closed.slice(0, 10)
    this.items = result.tabs
    // the last tab closed leaves nowhere to be: open home rather than an empty frame
    if (!result.tabs.length) {
      this.items = [makeTab('', { label: result.closed.label, icon: 'home' })]
      this.activeId = this.items[0]!.id
      this.#save()
      this.#go('')
      return
    }
    const moved = result.activeId !== this.activeId
    this.activeId = result.activeId
    this.#save()
    if (moved) this.#go(this.active?.href ?? '')
  }

  closeOthers(id: string) {
    this.items = closeOthers(this.items, id)
    if (indexOfId(this.items, this.activeId ?? '') < 0) this.select(id)
    this.#save()
  }

  closeToRight(id: string) {
    this.items = closeToRight(this.items, id)
    if (indexOfId(this.items, this.activeId ?? '') < 0) this.select(id)
    this.#save()
  }

  togglePin(id: string) {
    const tab = this.items.find((t) => t.id === id)
    if (!tab) return
    this.items = setPinned(this.items, id, !tab.pinned)
    this.#save()
  }

  move(from: number, to: number) {
    this.items = moveTab(this.items, from, to)
    this.#save()
  }

  reopen() {
    const tab = this.#closed.shift()
    if (!tab) return
    const existing = findByHref(this.items, tab.href)
    if (existing) {
      this.select(existing.id)
      return
    }
    // the tab itself goes back, not a fresh one pointing at the same place: its name and whether the
    // page or the shell gave it that name come back too, so an undo does not flicker through "Chat"
    this.#push(tab)
    this.#save()
    this.#go(tab.href)
  }

  /** Leaving a workspace should not leave its strip behind for the next person on this device. */
  forget(slug: string) {
    if (browser) localStorage.removeItem(key(slug))
    if (this.slug === slug) {
      this.slug = null
      this.items = []
      this.activeId = null
    }
  }

  #push(tab: WorkTab) {
    this.items = insertTab(this.items, tab, this.activeId)
    this.activeId = tab.id
  }

  #go(href: string) {
    if (!this.slug) return
    void goto(`/${this.slug}${href}`)
  }

  #read(slug: string) {
    if (!browser) return null
    try {
      const raw = localStorage.getItem(key(slug))
      return raw ? restore(JSON.parse(raw)) : null
    } catch {
      return null
    }
  }

  #save() {
    if (!browser || !this.slug) return
    try {
      localStorage.setItem(key(this.slug), JSON.stringify({ tabs: this.items, activeId: this.activeId }))
    } catch {
      // out of quota: the strip still works for this session, it just will not survive a reload
    }
  }
}

export const tabs = new TabsState()
