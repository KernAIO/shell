import { toast } from '@kernhq/ui'
import { goto } from '$app/navigation'
import * as m from '$msg'
import { planLimitOf } from './errors'

/**
 * Turn a plan limit into something a person can act on, instead of the server's English sentence.
 *
 * The three refusals in `PLAN_LIMIT_REASONS` are not mistakes: nothing was typed wrongly and trying
 * again will not help, so the only useful next step is the plan. Every one of them used to arrive as
 * a bare toast reading "This workspace's plan includes 25 seats" — the server's own words, in
 * English whatever the reader's language, with nowhere to go from there.
 *
 * Returns `false` when the failure is not a plan limit, so a caller keeps its own error handling:
 *
 * ```ts
 * onError: (err) => {
 *   if (planLimitToast(err, plan)) return
 *   toast.error(err instanceof Error ? err.message : m.error_generic())
 * }
 * ```
 *
 * The action is offered only to somebody who may actually open the page. Without that check the
 * toast sends a member who cannot see billing to a route the module router answers with 404 — worse
 * than no button, because it looks like the product is broken rather than like the plan is the
 * limit. They still get the translated sentence, which is the half that was missing.
 */
export interface PlanContext {
  /** The workspace whose plan was the limit — its slug, because that is what the URL carries. */
  workspaceSlug: string
  /** Whether this person holds `billing.subscription.view`. */
  canSeePlans: boolean
}

export function planLimitToast(err: unknown, ctx: PlanContext): boolean {
  const limit = planLimitOf(err)
  if (!limit) return false

  const said =
    limit.reason === 'billing.seats.limit_reached'
      ? { title: m.billing_limit_seats(), body: m.billing_limit_seats_hint() }
      : limit.reason === 'billing.storage.limit_reached'
        ? { title: m.billing_limit_storage(), body: m.billing_limit_storage_hint() }
        : { title: m.billing_limit_module(), body: m.billing_limit_module_hint() }

  toast.error(said.title, {
    description: said.body,
    // Longer than the default: this is a sentence to read and a decision to make, not an
    // acknowledgement, and the action is useless if it has gone before it is reached.
    duration: 10_000,
    action: ctx.canSeePlans
      ? {
          // Billing declares `settingsPages: [{ id: 'plan', scope: 'workspace' }]`, and the shell
          // mounts a module settings page at `/<ws>/settings/<moduleId>/<pageId>` — so this URL is
          // the declaration, not a route file somebody has to keep in step with it.
          label: m.billing_see_plans(),
          onClick: () => void goto(`/${ctx.workspaceSlug}/settings/billing/plan`),
        }
      : undefined,
  })
  return true
}
