/**
 * Export and erasure: the one part of core's API that is not on the contract.
 *
 * Everything else the app calls goes through `@kernhq/sdk`, which is generated from `coreContract`
 * and gives typing, the OpenAPI document and every middleware for free. These nine routes do not,
 * and the reason is written out at the top of core's `src/modules/core/http-routes.ts`: the
 * contract lives in `@kernhq/contracts`, a package in another repository, so putting them there is
 * a contracts-first change that has to land and publish before core can consume it. Core mounted
 * them as raw Fastify routes under the same `/api/core` prefix rather than ship the engine with
 * nothing able to reach it — and until this file existed, nothing was.
 *
 * So this is the client the generator would have written, by hand and no wider than it has to be:
 * the same base URL and the same cookie the SDK uses, and `KernError`'s `{ code, message, reason }`
 * read back off the wire so `reasonOf` in `./errors` works on a failure from here exactly as it
 * does on one from a procedure. **When these move onto the contract this file goes away** — it is
 * the mirror of that one, and it should shrink with it rather than grow.
 */

import { browser } from '$app/environment'
import { env } from '$env/dynamic/public'
import { isMock } from './client'
import { mockDataRights } from './data-rights-mock'
import type { DeletionRecord, ExportRecord } from './data-rights-shape'

/**
 * The shapes and the grace period live in `./data-rights-shape`, which imports nothing from
 * SvelteKit, and are re-exported here so every caller keeps one import path. The split exists
 * because this module's `$app/environment` import makes anything that reaches it untestable under
 * vitest — see that file's header.
 */
export {
  archivedAtOf,
  type DeletionRecord,
  type DeletionStatus,
  type DeletionSubject,
  type ExportRecord,
  type ExportStatus,
  GRACE_PERIOD_DAYS,
} from './data-rights-shape'

/**
 * A refusal from one of these routes, shaped like the ones the SDK throws.
 *
 * `code` and `reason` are what a screen branches on — never the message, which is a sentence core
 * wrote in English. `reasonOf` in `./errors` reads `err.reason`, so a caller can use one helper for
 * both surfaces.
 */
export class DataRightsError extends Error {
  readonly code: string
  readonly reason: string | null
  readonly status: number
  constructor(status: number, code: string, message: string, reason: string | null) {
    super(message)
    this.name = 'DataRightsError'
    this.status = status
    this.code = code
    this.reason = reason
  }
}

/** Same origin as the SDK's: the dev server proxies `/api` to core and Caddy routes it in production. */
function baseUrl(): string {
  return env.PUBLIC_API_URL || (browser ? window.location.origin : 'http://localhost:4000')
}

async function call<T>(
  method: 'GET' | 'POST' | 'DELETE',
  path: string,
  options: { query?: Record<string, string>; body?: unknown } = {},
): Promise<T> {
  const url = new URL(`/api/core${path}`, baseUrl())
  for (const [k, v] of Object.entries(options.query ?? {})) url.searchParams.set(k, v)
  const res = await fetch(url, {
    method,
    // The session is a cookie, and these routes resolve the principal from it exactly as the
    // procedures do. Without this every one of them is anonymous.
    credentials: 'include',
    headers: options.body === undefined ? {} : { 'content-type': 'application/json' },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (!res.ok) {
    // `fail()` in core's http-routes always sends this shape; a proxy answering with HTML does not,
    // hence the catch. Losing the body is not a reason to lose the status.
    const payload = (await res.json().catch(() => null)) as {
      code?: string
      message?: string
      reason?: string
    } | null
    throw new DataRightsError(
      res.status,
      payload?.code ?? 'INTERNAL',
      payload?.message ?? res.statusText,
      payload?.reason ?? null,
    )
  }
  return (await res.json()) as T
}

/**
 * The nine calls, and their in-memory twins.
 *
 * `dev:mock` has no core at all, so every one of these would be a failed fetch — which is exactly
 * the environment the end-to-end sweep runs in, and a screen that can only render its error state
 * is a screen nobody has looked at. The mock is chosen once per call rather than at module load so
 * a test that installs a fake still sees it.
 */
export const dataRights = {
  exports: {
    request: (workspaceId: string): Promise<ExportRecord> =>
      isMock()
        ? mockDataRights.exports.request(workspaceId)
        : call('POST', '/exports', { body: { workspaceId } }),
    list: (workspaceId: string): Promise<ExportRecord[]> =>
      isMock()
        ? mockDataRights.exports.list(workspaceId)
        : call<{ items: ExportRecord[] }>('GET', '/exports', { query: { workspaceId } }).then((r) => r.items),
    downloadUrl: (workspaceId: string, id: string): Promise<{ url: string; expiresAt: string }> =>
      isMock()
        ? mockDataRights.exports.downloadUrl(workspaceId, id)
        : call('GET', `/exports/${id}/download`, { query: { workspaceId } }),
  },

  workspaceDeletion: {
    /** `null` rather than a throw for "nothing scheduled": core answers that with a 404. */
    pending: (workspaceId: string): Promise<DeletionRecord | null> =>
      isMock()
        ? mockDataRights.workspaceDeletion.pending(workspaceId)
        : call<DeletionRecord>('GET', `/workspaces/${workspaceId}/deletion`).catch(nullOn404),
    schedule: (workspaceId: string, reason?: string): Promise<DeletionRecord> =>
      isMock()
        ? mockDataRights.workspaceDeletion.schedule(workspaceId)
        : call('POST', `/workspaces/${workspaceId}/deletion`, { body: { reason } }),
    cancel: (workspaceId: string): Promise<DeletionRecord> =>
      isMock()
        ? mockDataRights.workspaceDeletion.cancel(workspaceId)
        : call('DELETE', `/workspaces/${workspaceId}/deletion`),
  },

  accountDeletion: {
    pending: (): Promise<DeletionRecord | null> =>
      isMock()
        ? mockDataRights.accountDeletion.pending()
        : call<DeletionRecord>('GET', '/account/deletion').catch(nullOn404),
    schedule: (reason?: string): Promise<DeletionRecord> =>
      isMock()
        ? mockDataRights.accountDeletion.schedule()
        : call('POST', '/account/deletion', { body: { reason } }),
    cancel: (): Promise<DeletionRecord> =>
      isMock() ? mockDataRights.accountDeletion.cancel() : call('DELETE', '/account/deletion'),
  },
}

/**
 * "Nothing is scheduled" is a fact, not a failure.
 *
 * Core answers both `GET .../deletion` routes with 404 when there is no open request, which is the
 * right status and the wrong thing for a query to throw on: every screen reading it would need the
 * same branch, and TanStack would retry a state that is not going to change.
 *
 * A 401 is deliberately **not** folded in here. On the account route it is the signal that the
 * session is gone, and a caller has to be able to tell "you are signed out" from "you have not
 * asked for anything".
 */
function nullOn404(err: unknown): null {
  if (err instanceof DataRightsError && err.status === 404) return null
  throw err
}

/** Query keys, in the `[module, entity, …scope]` shape the realtime invalidator matches on. */
export const dataRightsKeys = {
  exports: (workspaceId: string) => ['core', 'export', workspaceId] as const,
  workspaceDeletion: (workspaceId: string) => ['core', 'deletion', 'workspace', workspaceId] as const,
  accountDeletion: () => ['core', 'deletion', 'account'] as const,
}
