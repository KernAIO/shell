/**
 * In-memory export and erasure, for `dev:mock`.
 *
 * The routes in `./data-rights` are raw `fetch` calls, so in mock mode — which has no core at all —
 * every one of them would be a failed request. That is the environment `pnpm dev:mock` demos in and
 * the one `tests/e2e/ux.spec.ts` sweeps, so without this the data-and-privacy screens could only
 * ever render their error state, which is the same as not having looked at them.
 *
 * Two behaviours are modelled deliberately rather than shortcut, because they are the whole point of
 * the screens:
 *
 * - **An export is not ready when you ask for it.** It goes `pending` → `running` → `ready` on a
 *   timer, so the polling, the progress copy and the moment the download button appears are all
 *   exercised. Returning `ready` immediately would leave three of the four states undrawn.
 * - **`followUps` is never empty.** No first-party module implements `<module>.export` yet, so a
 *   real archive today lists every enabled module as data it does not contain. A mock that hid that
 *   would be teaching the screen to hide it too.
 */

import { type DeletionRecord, type ExportRecord, GRACE_PERIOD_DAYS } from './data-rights'

/** Matches `EXPORT_TTL_HOURS` in core's `exports.ts`. */
const EXPORT_TTL_HOURS = 72

const iso = (offsetMs: number) => new Date(Date.now() + offsetMs).toISOString()

/**
 * What core writes into `follow_ups` today, in the same voice.
 *
 * Core builds one line per enabled module that did not answer `<module>.export`, naming the schema
 * it owns. None of them answer, so this is what a real export of the demo workspace would say.
 */
const FOLLOW_UPS = [
  "tracker: no export procedure — this module's data is not in this archive. It owns schema mod_tracker.",
  "quire: no export procedure — this module's data is not in this archive. It owns schema mod_quire.",
  "chat: no export procedure — this module's data is not in this archive. It owns schema mod_chat.",
]

/** How long the mock takes to "build" an archive. Long enough to see the pending state, short enough to demo. */
const BUILD_MS = 2_200

interface MockExport extends ExportRecord {
  /** When `request` was called, so `list` can age the row into `ready` without a timer. */
  requestedAt: number
}

const exportsByWorkspace = new Map<string, MockExport[]>()

/**
 * A scheduled erasure outlives the page that asked for it, because on a real instance it is a row
 * in Postgres.
 *
 * Module memory does not: scheduling sends the person to the workspace chooser, and the moment
 * anything reloads the app the record is gone and the screen is back to offering *Delete*. So the
 * one branch that matters most here — the workspace is going to be destroyed on a date, and this is
 * how you stop it — was unreachable after a reload, which is also the only way `ux.spec.ts` visits
 * a route. `localStorage` is where the mock already keeps state a test has to be able to set, and it
 * makes the branch reachable by seeding the key rather than by driving the whole flow first.
 *
 * Wrapped in try/catch throughout: a browser set to block site data throws on both reads and writes.
 */
const DELETIONS_KEY = 'kern.mock.deletions'

/** Reason code `accountDeletion.schedule` should refuse with, so both refusals can be rendered. */
const CLOSE_REFUSAL_KEY = 'kern.mock.close_refusal'

function mockFlag(key: string): string | null {
  if (typeof localStorage === 'undefined') return null
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

interface StoredDeletions {
  workspaces: Record<string, DeletionRecord>
  account: DeletionRecord | null
}

function readStore(): StoredDeletions {
  if (typeof localStorage === 'undefined') return { workspaces: {}, account: null }
  try {
    const raw = localStorage.getItem(DELETIONS_KEY)
    if (!raw) return { workspaces: {}, account: null }
    const parsed = JSON.parse(raw) as Partial<StoredDeletions>
    return { workspaces: parsed.workspaces ?? {}, account: parsed.account ?? null }
  } catch {
    return { workspaces: {}, account: null }
  }
}

function writeStore(store: StoredDeletions) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DELETIONS_KEY, JSON.stringify(store))
  } catch {
    // a browser that refuses site data still gets a working screen, just not a durable one
  }
}

/**
 * Age a row on read rather than on a `setTimeout`.
 *
 * A timer would keep running after the page that started it had gone, and would not survive the
 * navigation the screens are most often demoed with. Deriving the status from elapsed time means the
 * row is correct whenever anybody happens to look at it, which is what a real poll sees too.
 */
function aged(row: MockExport): MockExport {
  if (row.status !== 'pending' && row.status !== 'running') return row
  const elapsed = Date.now() - row.requestedAt
  if (elapsed >= BUILD_MS) {
    row.status = 'ready'
    row.sizeBytes = 48_812
    row.completedAt = new Date(row.requestedAt + BUILD_MS).toISOString()
    row.expiresAt = new Date(row.requestedAt + BUILD_MS + EXPORT_TTL_HOURS * 3_600_000).toISOString()
  } else if (elapsed >= BUILD_MS / 3) {
    row.status = 'running'
  }
  return row
}

const strip = ({ requestedAt: _requestedAt, ...rest }: MockExport): ExportRecord => rest

let seq = 0
const mockId = () => `01920000-0000-7000-8002-${String(++seq).padStart(12, '0')}`

/** A believable archive, so pressing Download in `dev:mock` actually saves a file worth opening. */
function archiveFor(workspaceId: string): Blob {
  const document = {
    format: 'kern.workspace-export/1',
    kernVersion: '0.0.0-mock',
    exportedAt: new Date().toISOString(),
    workspace: { id: workspaceId, name: 'Northstar', slug: 'northstar' },
    core: { members: [], roles: [], groups: [], activity: [] },
    files: [],
    modules: {},
    followUps: FOLLOW_UPS,
  }
  return new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
}

function scheduled(kind: 'workspace' | 'account', subjectId: string): DeletionRecord {
  return {
    id: mockId(),
    subjectKind: kind,
    subjectId,
    status: 'scheduled',
    purgeAfter: iso(GRACE_PERIOD_DAYS * 86_400_000),
    // Core records the same list here: every module that will have to erase its own rows.
    followUps: FOLLOW_UPS.map((f) => f.replace('no export procedure', 'no erase procedure')),
    error: null,
    createdAt: iso(0),
    completedAt: null,
  }
}

export const mockDataRights = {
  exports: {
    request: async (workspaceId: string): Promise<ExportRecord> => {
      const rows = exportsByWorkspace.get(workspaceId) ?? []
      // Core returns the build already in flight rather than starting a second one.
      const open = rows.map(aged).find((r) => r.status === 'pending' || r.status === 'running')
      if (open) return strip(open)
      const row: MockExport = {
        id: mockId(),
        workspaceId,
        status: 'pending',
        sizeBytes: null,
        followUps: FOLLOW_UPS,
        error: null,
        createdAt: iso(0),
        completedAt: null,
        expiresAt: iso(EXPORT_TTL_HOURS * 3_600_000),
        requestedAt: Date.now(),
      }
      exportsByWorkspace.set(workspaceId, [row, ...rows])
      return strip(row)
    },
    list: async (workspaceId: string): Promise<ExportRecord[]> =>
      (exportsByWorkspace.get(workspaceId) ?? []).map(aged).map(strip),
    downloadUrl: async (workspaceId: string, id: string) => {
      const row = (exportsByWorkspace.get(workspaceId) ?? []).map(aged).find((r) => r.id === id)
      if (row?.status !== 'ready')
        throw Object.assign(new Error('Export is not ready yet'), {
          code: 'CONFLICT',
          reason: 'core.export.not_ready',
        })
      return { url: URL.createObjectURL(archiveFor(workspaceId)), expiresAt: iso(900_000) }
    },
  },

  workspaceDeletion: {
    pending: async (workspaceId: string) => readStore().workspaces[workspaceId] ?? null,
    schedule: async (workspaceId: string) => {
      const store = readStore()
      const open = store.workspaces[workspaceId]
      if (open) return open
      const record = scheduled('workspace', workspaceId)
      store.workspaces[workspaceId] = record
      writeStore(store)
      return record
    },
    cancel: async (workspaceId: string) => {
      const store = readStore()
      const open = store.workspaces[workspaceId]
      if (!open)
        throw Object.assign(new Error('Scheduled deletion'), {
          code: 'NOT_FOUND',
          reason: 'core.deletion.not_cancellable',
        })
      delete store.workspaces[workspaceId]
      writeStore(store)
      return { ...open, status: 'cancelled' as const, completedAt: iso(0) }
    },
  },

  accountDeletion: {
    pending: async () => readStore().account,
    schedule: async () => {
      /*
       * Core refuses a closure for two reasons, and neither is reachable here otherwise: the demo
       * user is the only instance admin *and* the only owner of the demo workspace, so on a real
       * instance both refusals would fire and in `dev:mock` neither could. A branch that is never
       * taken never fails — and these two are the whole reason the dialogue has an error line
       * rather than a toast.
       *
       * `kern.mock.close_refusal` holds the reason code to refuse with, in the same shape core
       * sends it. Unset, nothing here changes any answer.
       */
      const refusal = mockFlag(CLOSE_REFUSAL_KEY)
      if (refusal)
        throw Object.assign(new Error('Refused'), {
          code: 'CONFLICT',
          data: { reason: refusal },
        })
      const store = readStore()
      if (store.account) return store.account
      store.account = scheduled('account', 'mock-user')
      writeStore(store)
      return store.account
    },
    cancel: async () => {
      const store = readStore()
      if (!store.account)
        throw Object.assign(new Error('Scheduled deletion'), {
          code: 'NOT_FOUND',
          reason: 'core.deletion.not_cancellable',
        })
      const cancelled = { ...store.account, status: 'cancelled' as const, completedAt: iso(0) }
      store.account = null
      writeStore(store)
      return cancelled
    },
  },
}
