/**
 * Reading the machine-readable half of a failed API call.
 *
 * `KernError` carries a `reason` — `billing.seats.limit_reached`, `core.invitation.expired` — and
 * the kernel folds it into oRPC's `data` on the way out, so the client gets `{ reason, ...details }`
 * beside the message. The **message** is a sentence the server wrote in English; the **reason** is a
 * code. Only one of those can be translated, and only one of them a screen can branch on without
 * keeping a list of English sentences in step with a service it does not ship with.
 *
 * No `$msg` here on purpose: this file decides *what happened*, the caller decides what to say
 * about it, and that split is what lets this be unit-tested at all (see `vitest.config.ts`).
 */

/** The three refusals that mean "your plan does not stretch to this", not "you did it wrong". */
export const PLAN_LIMIT_REASONS = [
  'billing.seats.limit_reached',
  'billing.storage.limit_reached',
  'billing.modules.not_included',
] as const

export type PlanLimitReason = (typeof PLAN_LIMIT_REASONS)[number]

export interface PlanLimit {
  reason: PlanLimitReason
  /** The plan's name, when the workspace is on a named one. Absent on a self-hosted instance. */
  plan: string | null
  /** Which module was refused — `billing.modules.not_included` only. */
  module: string | null
}

/** The `data` bag oRPC carries, when there is one. */
function dataOf(err: unknown): Record<string, unknown> | null {
  if (typeof err !== 'object' || err === null) return null
  const data = (err as { data?: unknown }).data
  return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : null
}

function stringOr(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

/**
 * The reason code behind a failure, or `null` when it has none.
 *
 * `data.reason` is where it arrives over the wire. `err.reason` is read too, for a `KernError` that
 * never crossed one — a server `load` calling core in-process, which is how the public routes work.
 */
export function reasonOf(err: unknown): string | null {
  return stringOr(dataOf(err)?.reason) ?? stringOr((err as { reason?: unknown } | null)?.reason)
}

/**
 * Whether this failure is a plan limit, and what the server said about it.
 *
 * `null` for everything else, including every other `CONFLICT`: a screen must not turn "you are not
 * allowed" or "that name is taken" into an invitation to go and look at pricing.
 */
export function planLimitOf(err: unknown): PlanLimit | null {
  const reason = reasonOf(err)
  if (!reason || !(PLAN_LIMIT_REASONS as readonly string[]).includes(reason)) return null
  const data = dataOf(err)
  return {
    reason: reason as PlanLimitReason,
    plan: stringOr(data?.plan),
    module: stringOr(data?.module),
  }
}
