import { browser } from '$app/environment'

/**
 * Per-device interface preferences.
 *
 * These say how the shell is drawn on *this* machine, which is why they live in the browser next to
 * the theme rather than on the account: the tab strip earns its width on a laptop and wastes it on a
 * 13" screen someone only uses for chat, and the same person may want it in one place and not the
 * other. Nothing here changes what you can see or do — only how much of the frame it takes.
 */

const STORAGE_KEY = 'kern.prefs'

export interface ShellPrefs {
  /** The window tab strip above the shell (DESIGN.md §2.0). */
  tabBar: boolean
  /** The local time beside the strip's actions. */
  clock: boolean
}

export const PREF_DEFAULTS: ShellPrefs = { tabBar: true, clock: true }

class PrefsState {
  tabBar = $state(PREF_DEFAULTS.tabBar)
  clock = $state(PREF_DEFAULTS.clock)

  constructor() {
    if (!browser) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const stored = JSON.parse(raw) as Partial<ShellPrefs>
      if (typeof stored.tabBar === 'boolean') this.tabBar = stored.tabBar
      if (typeof stored.clock === 'boolean') this.clock = stored.clock
    } catch {
      // a preference file we cannot read is not worth an error: the defaults are the point of them
    }
  }

  set<K extends keyof ShellPrefs>(key: K, value: ShellPrefs[K]) {
    this[key] = value
    if (!browser) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ tabBar: this.tabBar, clock: this.clock }))
    } catch {
      // private browsing and a full quota both land here; the choice still applies to this session
    }
  }
}

export const prefs = new PrefsState()
