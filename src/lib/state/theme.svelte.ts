import { browser } from '$app/environment'

export type ThemeChoice = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'kern.theme'

/**
 * Light, dark or follow the system. The choice is applied to `<html data-theme>`; `app.html` replays it
 * before first paint so there is no flash on load.
 */
class ThemeState {
  choice = $state<ThemeChoice>('system')
  systemDark = $state(false)

  constructor() {
    if (!browser) return
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') this.choice = stored
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    this.systemDark = mq.matches
    mq.addEventListener('change', (e) => {
      this.systemDark = e.matches
      this.apply()
    })
    this.apply()
  }

  get resolved(): 'light' | 'dark' {
    return this.choice === 'system' ? (this.systemDark ? 'dark' : 'light') : this.choice
  }

  set(choice: ThemeChoice) {
    this.choice = choice
    if (browser) localStorage.setItem(STORAGE_KEY, choice)
    this.apply()
  }

  private apply() {
    if (!browser) return
    const root = document.documentElement
    if (this.resolved === 'dark') root.dataset.theme = 'dark'
    else root.removeAttribute('data-theme')
    root.style.colorScheme = this.resolved
  }
}

export const theme = new ThemeState()
