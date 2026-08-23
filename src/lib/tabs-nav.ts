import type { TabMeta } from '$lib/state/tabs'
import * as m from '$msg'

/**
 * What a workspace-relative href is called in the tab strip.
 *
 * The strip has to name a place before the page for it has loaded — often before it exists, when a
 * tab is restored from a previous session — so the name comes from the navigation the shell already
 * knows about: the fixed destinations plus whatever the enabled modules contribute. A page that
 * knows better refines it afterwards through `tabs.describe`, which is how `Chat` becomes
 * `# eng-core`.
 */

export interface Destination extends TabMeta {
  /** Workspace-relative, as tabs store it: `''`, `'/inbox'`, `'/chat'`. */
  href: string
}

export interface NavSource {
  id: string
  label: string
  icon?: string
  href: string
}

/** Everywhere the "+" button can send you, in the order the sidebar lists them. */
export function destinationsFor(nav: NavSource[]): Destination[] {
  return [
    { href: '', label: m.nav_home(), icon: 'home' },
    { href: '/inbox', label: m.nav_inbox(), icon: 'inbox' },
    ...nav.map((item) => ({ href: item.href, label: item.label, icon: item.icon ?? 'circle' })),
    { href: '/settings', label: m.nav_settings(), icon: 'settings' },
  ]
}

/**
 * The longest destination the href sits under wins, so `/settings/members` is "Settings" and
 * `/tracker/KRN-12` is whatever the tracker calls itself — while `''` only ever matches home.
 */
export function metaFor(href: string, nav: NavSource[]): TabMeta {
  const path = href.split('?')[0] ?? ''
  const candidates = destinationsFor(nav)
    .filter((d) => (d.href === '' ? path === '' : path === d.href || path.startsWith(`${d.href}/`)))
    .sort((a, b) => b.href.length - a.href.length)
  const hit = candidates[0]
  if (hit) return { label: hit.label, icon: hit.icon }
  return { label: m.nav_workspace(), icon: 'circle' }
}
