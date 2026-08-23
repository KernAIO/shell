/**
 * Which sidebar a path asks for.
 *
 * Its own module, with no imports, because `registry.ts` reaches the module clients and those import
 * `$msg` — and a file that imports the message catalogue cannot be loaded by vitest. This is the
 * part worth testing, so it lives where a test can reach it.
 */

/** The first path segment after `/<workspace>`; `''` is the workspace root. */
export function segmentOf(pathname: string, workspaceSlug: string): string {
  const prefix = `/${workspaceSlug}`
  const rest = pathname.startsWith(prefix) ? pathname.slice(prefix.length) : pathname
  return rest.replace(/^\//, '').split('/')[0] ?? ''
}
