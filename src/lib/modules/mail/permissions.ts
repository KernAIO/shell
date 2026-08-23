import { session } from '$lib/state/session.svelte'

/**
 * The mail permissions the settings screen gates on.
 *
 * Both are declared by the module's contract (`mailPermissions`) and checked again by the server on
 * every call; this only stops the interface offering what would be refused. Managing the provider
 * is marked dangerous there — it decides where a workspace's email comes from — so it defaults to
 * owners and admins, and viewing the delivery log is separate because a log of who was emailed
 * about what is not something every admin task needs.
 */
export const MAIL_PERMISSIONS = {
  settingsManage: 'mail.settings.manage',
  deliveriesView: 'mail.deliveries.view',
} as const

export type MailPermission = (typeof MAIL_PERMISSIONS)[keyof typeof MAIL_PERMISSIONS]

export function canMail(key: keyof typeof MAIL_PERMISSIONS): boolean {
  return session.can(MAIL_PERMISSIONS[key])
}
