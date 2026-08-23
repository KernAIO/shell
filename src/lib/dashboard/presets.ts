import { addItem, type Placed, SIZE_SPAN, type WidgetSize } from './grid'

/**
 * The layouts somebody can start from.
 *
 * Presets live here rather than in the database on purpose: a preset is a list of widget ids, and a
 * widget id is a client concept the server has never heard of. Core stores *which* preset applies;
 * this file is what that means. The payoff is that reshaping a preset is an app-only change with no
 * contracts-first publish round trip.
 *
 * No `$msg` here — a `.ts` that imports the message catalogue cannot be unit-tested. The names
 * people read are looked up by id where the preset is offered.
 */

export interface PresetEntry {
  widget: string
  size: WidgetSize
  settings?: Record<string, string | number | boolean | null>
}

export interface Preset {
  id: string
  /** ordered: the layout is packed from this, so a preset cannot be authored into an overlap */
  entries: PresetEntry[]
}

export const DEFAULT_PRESET_ID = 'my-work'

export const PRESETS: Preset[] = [
  {
    // The closest honest reading of DESIGN.md §3.1 — minus the "today" agenda, which needs a
    // calendar module that does not exist.
    id: 'my-work',
    entries: [
      { widget: 'core.stat-unread', size: 's' },
      { widget: 'core.stat-mentions', size: 's' },
      { widget: 'tracker.stat-assigned', size: 's' },
      { widget: 'tracker.stat-due-soon', size: 's' },
      { widget: 'tracker.issues', size: 'l', settings: { preset: 'assigned', limit: 8 } },
      { widget: 'core.waiting-on-you', size: 'm', settings: { limit: 6 } },
      { widget: 'chat.unread', size: 'm', settings: { limit: 6 } },
      { widget: 'tracker.timer', size: 's' },
    ],
  },
  {
    id: 'delivery',
    entries: [
      { widget: 'tracker.cycle-progress', size: 'm' },
      { widget: 'tracker.velocity', size: 'l' },
      { widget: 'tracker.created-vs-resolved', size: 'xl', settings: { range: '30d' } },
      { widget: 'tracker.issues', size: 'l', settings: { preset: 'triage', limit: 8 } },
      { widget: 'tracker.issues', size: 'l', settings: { preset: 'assigned', limit: 8 } },
    ],
  },
  {
    id: 'communication',
    entries: [
      { widget: 'chat.stat-unread', size: 's' },
      { widget: 'core.stat-mentions', size: 's' },
      { widget: 'chat.unread', size: 'l', settings: { limit: 10 } },
      { widget: 'core.waiting-on-you', size: 'l', settings: { limit: 10 } },
      { widget: 'core.people', size: 'm' },
    ],
  },
  {
    // One column, nothing to count. For people who open the home page to be told what to do next.
    id: 'focus',
    entries: [
      { widget: 'tracker.issues', size: 'xl', settings: { preset: 'assigned', limit: 12 } },
      { widget: 'core.waiting-on-you', size: 'xl', settings: { limit: 10 } },
    ],
  },
]

export function preset(id: string): Preset {
  return (
    PRESETS.find((p) => p.id === id) ??
    PRESETS.find((p) => p.id === DEFAULT_PRESET_ID) ?? {
      // A preset that was removed in a later version must not produce a blank page.
      id: DEFAULT_PRESET_ID,
      entries: [],
    }
  )
}

export interface PresetItem extends Placed {
  widget: string
  size: WidgetSize
  settings: Record<string, string | number | boolean | null>
}

/**
 * Expand a preset into a placed layout.
 *
 * `known` filters out widgets whose module is switched off or that the person may not see, so a
 * preset naming a chat widget in a workspace with chat disabled simply lands with fewer cards
 * rather than with holes.
 */
export function expandPreset(
  id: string,
  newId: () => string,
  known: (widget: string) => boolean = () => true,
): PresetItem[] {
  let placed: Placed[] = []
  const out: PresetItem[] = []
  for (const entry of preset(id).entries) {
    if (!known(entry.widget)) continue
    const span = SIZE_SPAN[entry.size]
    const i = newId()
    placed = addItem(placed, { i, ...span })
    const at = placed.find((p) => p.i === i)
    if (!at) continue
    out.push({ ...at, widget: entry.widget, size: entry.size, settings: entry.settings ?? {} })
  }
  return out
}
