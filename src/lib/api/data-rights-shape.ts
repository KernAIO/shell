/**
 * The shapes and constants of the export/erasure surface, with no SvelteKit imports.
 *
 * `./data-rights` is the client and `./data-rights-mock` is its in-memory twin; both need these, and
 * the client also imports `$app/environment` and `$env/dynamic/public`. Those aliases are applied by
 * SvelteKit's Vite plugin, which **vitest does not run** — so anything that reaches the client, even
 * only for a constant, becomes impossible to unit-test: `mock.ts` importing the mock twin was enough
 * to fail `mock-manifests.test.ts` with "Cannot find module '$app/environment'", a message that
 * names neither file involved. Types alone would have been fine (they are erased); it takes one
 * value import to drag the whole module in.
 *
 * So the value lives here, at the leaf, and `./data-rights` re-exports it — every existing
 * `from '$lib/api/data-rights'` still works. Anything shared between the client and the mock belongs
 * in this file rather than in the client. **This whole surface goes away when the nine routes move
 * onto `@kernhq/contracts`**; see the header of `./data-rights`.
 */

/**
 * How long a scheduled erasure can still be called off — core's `GRACE_PERIOD_DAYS`.
 *
 * Duplicated here, and there is no way not to: it is a constant in a service this app does not
 * import, and it appears in copy a person reads *before* any record exists ("erased after 30 days"),
 * so it cannot be derived from a `purgeAfter` that has not been written yet. Once a record does
 * exist, every screen quotes **its** `purgeAfter` rather than counting from this — so a core that
 * moved the window would be right on every screen showing a real request, and wrong only in the
 * sentence above the button. Keep the two in step.
 */
export const GRACE_PERIOD_DAYS = 30

export type ExportStatus = 'pending' | 'running' | 'ready' | 'failed' | 'expired'

export interface ExportRecord {
  id: string
  workspaceId: string
  status: ExportStatus
  sizeBytes: number | null
  /** modules that own data in this workspace and could not contribute it — shown, never hidden */
  followUps: string[]
  error: string | null
  createdAt: string
  completedAt: string | null
  expiresAt: string | null
}

export type DeletionSubject = 'workspace' | 'account'
export type DeletionStatus = 'scheduled' | 'cancelled' | 'running' | 'done' | 'failed'

export interface DeletionRecord {
  id: string
  subjectKind: DeletionSubject
  subjectId: string
  status: DeletionStatus
  /** when the rows actually go; the grace period is the distance between this and `createdAt` */
  purgeAfter: string
  followUps: string[]
  error: string | null
  createdAt: string
  completedAt: string | null
}

/**
 * When a workspace was archived, read off a `WorkspaceSummary` that does not declare the field yet.
 *
 * `archivedAt` is being added to `WorkspaceSummary` in `@kernhq/contracts` so that `users.me()` can
 * return archived workspaces instead of filtering them out — the change that makes a scheduled
 * erasure reachable at all. Until that version is published the SDK's generated type has no such
 * field, so reading it directly does not compile, and inventing a second place to keep the fact
 * would be worse than the cast: two sources of truth for one row, and only one of them from core.
 *
 * So it is read here, once, behind a narrow cast that states exactly what is assumed. **Delete this
 * and read `w.archivedAt` directly the moment the contracts version lands** — the whole reason it is
 * a named function rather than an inline `as` at three call sites is so there is one thing to
 * remove. Anything that is not a string reads as "not archived", so an older core that still omits
 * the field degrades to today's behaviour rather than throwing.
 */
export function archivedAtOf(workspace: unknown): string | null {
  const value = (workspace as { archivedAt?: unknown } | null | undefined)?.archivedAt
  return typeof value === 'string' ? value : null
}
