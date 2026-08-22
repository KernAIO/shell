import type { GroupBy, GroupKey, Priority, StatusCategory } from '@kernhq/module-tracker/client'
import * as m from '$msg'
import type { TrackerCatalogue } from './context.svelte'
import type { Preset } from './filters'

/**
 * What the tracker's own vocabulary is called on screen.
 *
 * Group keys, priorities and presets are ids and enums in the data; every place they are shown to a
 * person goes through here, so the interface has one translation of each and Persian, German and
 * Arabic get them all.
 */

/** What a group heading draws next to its name. */
export type GroupBadge =
  | { kind: 'status'; id: string; category: StatusCategory }
  | { kind: 'priority'; priority: Priority }
  | { kind: 'person'; id: string; name: string; avatarUrl: string | null }
  | { kind: 'colour'; color: string | null }

/** What the toolbar's group-by button cycles through, in order (DESIGN.md 2.5). */
export const GROUP_CYCLE: GroupBy[] = ['status', 'priority', 'assignee']

export function groupByLabel(groupBy: GroupBy): string {
  switch (groupBy) {
    case 'status':
      return m.tracker_group_status()
    case 'priority':
      return m.tracker_group_priority()
    case 'assignee':
      return m.tracker_group_assignee()
    case 'label':
      return m.tracker_group_label()
    case 'project':
      return m.tracker_group_project()
    case 'cycle':
      return m.tracker_group_cycle()
    default:
      return m.tracker_group_none()
  }
}

export function priorityLabel(priority: Priority): string {
  switch (priority) {
    case 'urgent':
      return m.tracker_priority_urgent()
    case 'high':
      return m.tracker_priority_high()
    case 'medium':
      return m.tracker_priority_medium()
    case 'low':
      return m.tracker_priority_low()
    default:
      return m.tracker_priority_none()
  }
}

/**
 * The heading for one group: what to call it, and the badge that goes in front of it.
 *
 * `null` is the group for issues that have no value for the field, and it reads differently per
 * field — "Unassigned" for people, "No cycle" for planning — which is why this is one place rather
 * than a fallback string sprinkled through the components.
 */
export function describeGroup(
  key: GroupKey,
  /** a built-in group key or `cf.<key>` */
  groupBy: string,
  cat: TrackerCatalogue,
): { label: string; badge?: GroupBadge } {
  if (groupBy === 'none') return { label: m.tracker_all_issues() }

  // A custom field's value is stored as an option id, so the heading has to ask the field what it
  // is called — otherwise a column reads `opt_7f3a` instead of `Sev 1`.
  const custom = /^cf\.(.+)$/.exec(groupBy)
  if (custom) {
    if (key === null) return { label: m.tracker_group_none() }
    return { label: cat.customValueLabel(custom[1]!, key) }
  }

  if (key === null) {
    switch (groupBy) {
      case 'assignee':
        return { label: m.tracker_unassigned() }
      case 'label':
        return { label: m.tracker_no_label() }
      case 'cycle':
        return { label: m.tracker_no_cycle() }
      case 'milestone':
        return { label: m.tracker_no_milestone() }
      default:
        return { label: m.tracker_group_none() }
    }
  }

  switch (groupBy as GroupBy) {
    case 'status': {
      const status = cat.status(key)
      return {
        label: status?.name ?? key,
        badge: { kind: 'status', id: key, category: status?.category ?? 'todo' },
      }
    }
    case 'statusCategory':
      return { label: key, badge: { kind: 'status', id: key, category: key as StatusCategory } }
    case 'priority':
      return {
        label: priorityLabel(key as Priority),
        badge: { kind: 'priority', priority: key as Priority },
      }
    case 'assignee': {
      const person = cat.person(key)
      return {
        label: person?.name ?? m.tracker_unassigned(),
        badge: { kind: 'person', id: key, name: person?.name ?? '', avatarUrl: person?.avatarUrl ?? null },
      }
    }
    case 'label': {
      const label = cat.label(key)
      return { label: label?.name ?? key, badge: { kind: 'colour', color: label?.color ?? null } }
    }
    case 'project': {
      const project = cat.project(key)
      return { label: project?.name ?? key, badge: { kind: 'colour', color: project?.color ?? null } }
    }
    case 'cycle': {
      const cycle = cat.cycle(key)
      return { label: cycle?.name ?? key }
    }
    case 'milestone': {
      const milestone = cat.milestone(key)
      return { label: milestone?.name ?? key }
    }
    case 'type': {
      const type = cat.type(key)
      return { label: type?.name ?? key }
    }
    default:
      return { label: key }
  }
}

export function presetLabel(preset: Preset): string {
  switch (preset) {
    case 'assigned':
      return m.tracker_preset_assigned()
    case 'active':
      return m.tracker_preset_active()
    case 'backlog':
      return m.tracker_preset_backlog()
    case 'created':
      return m.tracker_preset_created()
    case 'subscribed':
      return m.tracker_preset_subscribed()
    default:
      return m.tracker_preset_all()
  }
}
