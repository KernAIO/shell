<script lang="ts">
import { Badge, Button, Card, EmptyState, Page, PageHeader, Skeleton, StatTile } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getHrApi } from './api'
import { formatDays, hrKeys } from './query'

/**
 * My time off: what is left, and what is booked.
 *
 * Balance first, then the requests, because "how much do I have" is the question somebody opens
 * this page with — and the number they need before deciding anything is `available`, not `balance`.
 * Pending requests are already spoken for; showing the raw balance is how somebody books a week
 * they do not have and finds out at approval.
 */
const api = getHrApi()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

const balanceQuery = createQuery(() => ({
  queryKey: hrKeys.leaveBalance(workspaceId, undefined),
  enabled: Boolean(workspaceId),
  queryFn: () => api.leave.balance.get({ workspaceId }),
}))
const balances = $derived(balanceQuery.data ?? [])

const requestsQuery = createQuery(() => ({
  queryKey: hrKeys.leaveRequests(workspaceId, undefined),
  enabled: Boolean(workspaceId),
  queryFn: () => api.leave.requests.list({ workspaceId, limit: 50 }),
}))
const requests = $derived(requestsQuery.data?.items ?? [])

const statusLabel = (s: string) =>
  s === 'pending'
    ? m.hr_leave_pending()
    : s === 'approved'
      ? m.hr_leave_approved()
      : s === 'rejected'
        ? m.hr_leave_rejected()
        : s === 'withdrawn'
          ? m.hr_leave_withdrawn()
          : m.hr_leave_cancelled()

const statusTone = (s: string) =>
  s === 'approved' ? 'done' : s === 'pending' ? 'upcoming' : s === 'rejected' ? 'declined' : 'grey'

/**
 * A date range, through `Intl.formatRange`.
 *
 * Not two dates and a dash: a hand-built range reads backwards under `dir="rtl"` — the earlier date
 * ends up on the right — and `formatRange` collapses the parts the two dates share for free.
 */
function range(from: string, to: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
  return fmt.formatRange(new Date(`${from}T00:00:00`), new Date(`${to}T00:00:00`))
}
</script>

<PageHeader
  crumbs={[{ label: workspace?.name ?? '' }, { label: m.hr_leave_title() }]}
  title={m.hr_leave_title()}
>
  {#snippet actions()}
    <Button size="sm" href={`/${workspaceSlug}/hr/leave?new=1`}>{m.hr_request_leave()}</Button>
  {/snippet}
</PageHeader>

<Page>
  {#if balanceQuery.isLoading}
    <Skeleton height="88px" />
  {:else if balances.length}
    <div class="tiles">
      {#each balances as balance (balance.leaveTypeId)}
        <StatTile
          label={balance.leaveTypeName}
          value={formatDays(balance.available)}
          note={`${m.hr_available()} · ${m.hr_days()}`}
        />
      {/each}
    </div>
  {/if}

  <h2>{m.hr_leave_title()}</h2>
  {#if requestsQuery.isLoading}
    <Skeleton height="120px" />
  {:else if requests.length === 0}
    <EmptyState icon="tree-palm" title={m.hr_leave_none()} description={m.hr_leave_none_desc()} />
  {:else}
    <ul>
      {#each requests as request (request.id)}
        <li>
          <Card>
            <div class="row">
              <span class="dates">{range(request.startsOn, request.endsOn)}</span>
              <span class="meta">{formatDays(request.workingDays)} {m.hr_days()}</span>
              <Badge tone={statusTone(request.status)}>{statusLabel(request.status)}</Badge>
            </div>
          </Card>
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  margin-block-end: 20px;
}
h2 {
  font-size: 13.5px;
  margin: 0 0 12px;
}
ul {
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.dates {
  flex: 1;
  font-weight: 500;
}
.meta {
  color: var(--kern-ink-500);
  font-size: 12px;
}
</style>
