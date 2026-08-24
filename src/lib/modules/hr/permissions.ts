import { session } from '$lib/state/session.svelte'

/**
 * What this module lets somebody do.
 *
 * Hide what a person may never do; disable — with a reason — what they cannot do right now. The
 * server checks again regardless: this is about not offering a door that will not open.
 */
export const HR_PERMISSIONS = {
  view: 'hr.note.view',
  manage: 'hr.note.manage',
} as const

export type HrPermission = keyof typeof HR_PERMISSIONS

export function canHr(permission: HrPermission): boolean {
  return session.can(HR_PERMISSIONS[permission])
}

/**
 * Sub-features a workspace can switch off inside this module.
 *
 * Delete this if your module is all-or-nothing. Where it is not, a client contribution names one
 * unqualified — `capability: 'HR_CAPABILITIES.archive'` — and the shell drops the
 * navigation, widget, command or settings page when the workspace has it off. Nothing is greyed
 * out: a capability is about whether the workspace has the feature at all, so there is nothing to
 * explain and nothing to upgrade to.
 *
 * These ids must match what the server declares in `defineCapabilities`, and what the mock reports
 * from `workspaces.modules.list` — a disagreement is a screen that works in `dev:mock` and 404s
 * against core.
 */
export const HR_CAPABILITIES = {
  notes: 'notes',
  archive: 'archive',
} as const
