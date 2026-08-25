/**
 * The session moved into `@kernhq/ui`, and this re-export is why nothing had to be rewritten.
 *
 * It belongs in the framework because a module's own screens gate on `can()`, and a module cannot
 * import the app. Keep importing it from `$lib/state/session.svelte` inside the shell — the app's
 * own screens have no reason to name the framework package for something this central — but a
 * module client imports it from `@kernhq/ui`.
 *
 * One instance in the tree, guaranteed by `pnpm.overrides` pinning `@kernhq/ui`. Two copies would
 * mean the shell and a module disagreeing about who the user is.
 */
export { session } from '@kernhq/ui'
