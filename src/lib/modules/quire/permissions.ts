import { session } from '$lib/state/session.svelte'

/**
 * What this module lets somebody do.
 *
 * Hide what a person may never do; disable — with a reason — what they cannot do right now. The
 * server checks again regardless: this is about not offering a door that will not open.
 *
 * Every key is declared at **space** scope on the server, so a person may be able to edit one space
 * and only read another. `session.can` answers for the workspace, which is the right answer for
 * "should this appear in the rail at all" and the wrong one for "may I edit this page" — the page
 * asks the server for that, and the server is what refuses.
 */
export const QUIRE_PERMISSIONS = {
  spaceView: 'quire.space.view',
  spaceManage: 'quire.space.manage',
  pageView: 'quire.page.view',
  pageCreate: 'quire.page.create',
  pageEdit: 'quire.page.edit',
  pageDelete: 'quire.page.delete',
} as const

export type QuirePermission = keyof typeof QUIRE_PERMISSIONS

export function canQuire(permission: QuirePermission): boolean {
  return session.can(QUIRE_PERMISSIONS[permission])
}
