<script lang="ts">
import {
  Avatar,
  Badge,
  type BadgeTone,
  Button,
  Card,
  EmptyState,
  Input,
  Page,
  PageHeader,
  SectionLabel,
  Skeleton,
  StatTile,
  Tabs,
} from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getHrApi } from './api'
import PersonPanel from './components/PersonPanel.svelte'
import { canHr } from './permissions'
import { formatDays, hrKeys } from './query'

/**
 * The people view, laid out to DESIGN.md §3.12.
 *
 * Four stat tiles, then `minmax(0,1fr) 320px`: a real table on the left — name, role, office,
 * started, status on one grid so the columns line up down the page — and the things that need a
 * decision on the right. A flat list of names would be a directory; this is the screen somebody
 * actually opens in the morning, which is why what is waiting on them sits beside it.
 *
 * Each row carries the person's **local time**, because the directory of a company with more than
 * one office is also the answer to "can I call them now".
 */
const api = getHrApi()
const queryClient = useQueryClient()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

let search = $state('')
let officeTab = $state('all')
const selected = $derived(pageState.url.searchParams.get('person'))

/** Debounced: every keystroke would otherwise be a request, and the term is part of the cache key. */
let debounced = $state('')
$effect(() => {
  const term = search
  const handle = setTimeout(() => {
    debounced = term
  }, 250)
  return () => clearTimeout(handle)
})

const officesQuery = createQuery(() => ({
  queryKey: hrKeys.offices(workspaceId),
  enabled: Boolean(workspaceId) && canHr('officeView'),
  queryFn: () => api.offices.list({ workspaceId, includeArchived: false }),
}))
const offices = $derived(officesQuery.data ?? [])

const peopleQuery = createQuery(() => ({
  queryKey: hrKeys.people(workspaceId, { q: debounced, officeId: officeTab }),
  enabled: Boolean(workspaceId),
  queryFn: () =>
    api.people.list({
      workspaceId,
      limit: 100,
      ...(debounced ? { q: debounced } : {}),
      ...(officeTab !== 'all' ? { officeId: officeTab } : {}),
    }),
}))
const people = $derived(peopleQuery.data?.items ?? [])

/** Office tabs only once there is more than one place of work — otherwise they say nothing. */
const tabs = $derived([
  { value: 'all', label: m.hr_title() },
  ...offices.map((o) => ({ value: o.id, label: o.name })),
])

const balancesQuery = createQuery(() => ({
  queryKey: hrKeys.leaveBalance(workspaceId, undefined),
  enabled: Boolean(workspaceId),
  queryFn: () => api.leave.balance.get({ workspaceId }),
}))

const inboxQuery = createQuery(() => ({
  queryKey: hrKeys.approvalInbox(workspaceId),
  enabled: Boolean(workspaceId),
  queryFn: () => api.approvals.inbox({ workspaceId, limit: 6, includeDecided: false }),
}))
const waiting = $derived(inboxQuery.data?.items ?? [])

const decide = createMutation(() => ({
  mutationFn: (vars: { requestId: string; decision: 'approve' | 'reject' }) =>
    api.approvals.decide({ workspaceId, ...vars }),
  onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['hr'] }),
}))

const stats = $derived({
  headcount: peopleQuery.data?.total ?? people.length,
  offices: offices.length,
  away: people.filter((p) => p.status === 'on_leave').length,
  balance: balancesQuery.data?.[0]?.available ?? 0,
})

const statusLabel = (s: string) =>
  s === 'active'
    ? m.hr_status_active()
    : s === 'onboarding'
      ? m.hr_status_onboarding()
      : s === 'on_leave'
        ? m.hr_status_on_leave()
        : s === 'offboarding'
          ? m.hr_status_offboarding()
          : m.hr_status_terminated()

/** The design system already has tones for these exact states — §1.1 semantic chips. */
const statusTone = (s: string): BadgeTone =>
  s === 'active'
    ? 'active'
    : s === 'on_leave'
      ? 'on-leave'
      : s === 'onboarding'
        ? 'onboarding'
        : s === 'terminated'
          ? 'grey'
          : 'upcoming'

/** Re-renders the clocks once a minute; a directory showing a stale time is worse than none. */
let tick = $state(0)
$effect(() => {
  const handle = setInterval(() => {
    tick++
  }, 60_000)
  return () => clearInterval(handle)
})

function localTime(timezone: string | null, _tick: number): string | null {
  void _tick
  if (!timezone) return null
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    // An unknown zone must not take the directory down with it.
    return null
  }
}

const started = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat(undefined, { month: 'short', year: 'numeric' }).format(
        new Date(`${iso}T00:00:00`),
      )
    : '—'
</script>

<PageHeader
  crumbs={[{ label: workspace?.name ?? '' }, { label: m.hr_title() }]}
  title={m.hr_title()}
  subtitle={m.hr_subtitle()}
>
  {#snippet actions()}
    {#if canHr('personManage')}
      <Button size="sm" href={`/${workspaceSlug}/hr?new=1`}>{m.hr_add_person()}</Button>
    {/if}
  {/snippet}
</PageHeader>

<Page>
  <div class="tiles">
    <StatTile size="md" label={m.hr_widget_headcount_title()} value={new Intl.NumberFormat().format(stats.headcount)} />
    <StatTile size="md" label={m.hr_offices_title()} value={new Intl.NumberFormat().format(stats.offices)} />
    <StatTile size="md" label={m.hr_status_on_leave()} value={new Intl.NumberFormat().format(stats.away)} />
    <StatTile size="md" label={m.hr_available()} value={formatDays(stats.balance)} note={m.hr_days()} />
  </div>

  <div class="split">
    <section>
      <SectionLabel label={m.hr_title()} count={people.length} />

      <div class="filters">
        {#if tabs.length > 1}
          <Tabs items={tabs} value={officeTab} variant="pill" onValueChange={(v) => (officeTab = v)} />
        {/if}
        <div class="search">
          <Input bind:value={search} placeholder={m.hr_search_people()} type="search" size="sm" />
        </div>
      </div>

      {#if peopleQuery.isLoading}
        <div class="rows">
          {#each [1, 2, 3, 4, 5] as n (n)}<Skeleton height="48px" />{/each}
        </div>
      {:else if peopleQuery.isError}
        <EmptyState icon="triangle-alert" title={m.hr_people_error()}>
          {#snippet actions()}
            <Button variant="secondary" onclick={() => void peopleQuery.refetch()}>{m.retry()}</Button>
          {/snippet}
        </EmptyState>
      {:else if people.length === 0}
        <EmptyState icon="users" title={m.hr_no_people()} description={m.hr_no_people_desc()} />
      {:else}
        <div class="table" role="table" aria-label={m.hr_title()}>
          <div class="thead" role="row">
            <span role="columnheader">{m.hr_title()}</span>
            <span role="columnheader">{m.hr_employee_no()}</span>
            <span role="columnheader">{m.hr_office()}</span>
            <span role="columnheader">{m.hr_started()}</span>
            <span role="columnheader">{m.hr_local_time()}</span>
            <span role="columnheader">{m.hr_status()}</span>
          </div>
          {#each people as person (person.id)}
            {@const time = localTime(person.timezone, tick)}
            <a class="trow" role="row" href={`/${workspaceSlug}/hr?person=${person.id}`}>
              <span class="cell who" role="cell">
                <Avatar name={person.displayName} id={person.id} size={28} />
                <span class="stack">
                  <span class="name">{person.displayName}</span>
                  {#if person.workEmail}<span class="sub">{person.workEmail}</span>{/if}
                </span>
              </span>
              <span class="cell role" role="cell">{person.employeeNo ?? '—'}</span>
              <span class="cell muted" role="cell">{person.officeName ?? '—'}</span>
              <span class="cell muted" role="cell">{started(person.hiredOn)}</span>
              <span class="cell num" role="cell" title={person.timezone ?? ''}>{time ?? '—'}</span>
              <span class="cell" role="cell">
                <Badge tone={statusTone(person.status)}>{statusLabel(person.status)}</Badge>
              </span>
            </a>
          {/each}
        </div>
      {/if}
    </section>

    <aside>
      <SectionLabel label={m.hr_approvals_title()} count={waiting.length} />
      {#if inboxQuery.isLoading}
        <Skeleton height="120px" />
      {:else if waiting.length === 0}
        <EmptyState bare compact icon="check-check" title={m.hr_approvals_none()} />
      {:else}
        <div class="cards">
          {#each waiting as item (item.id)}
            <Card>
              <div class="cardhead">
                <Badge tone="upcoming">{m.hr_leave_title()}</Badge>
              </div>
              <p class="summary">{item.summary}</p>
              <div class="cardactions">
                <Button
                  size="sm"
                  disabled={decide.isPending}
                  onclick={() => decide.mutate({ requestId: item.id, decision: 'approve' })}
                  >{m.hr_approve()}</Button
                >
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={decide.isPending}
                  onclick={() => decide.mutate({ requestId: item.id, decision: 'reject' })}
                  >{m.hr_reject()}</Button
                >
              </div>
            </Card>
          {/each}
        </div>
      {/if}
    </aside>
  </div>
</Page>

{#if selected}
  <PersonPanel personId={selected} {workspaceId} {workspaceSlug} />
{/if}

<style>
/* §3.12: four stat tiles, then a 1fr / 320px split, gap 20. */
.tiles {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-block-end: 20px;
}
.split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
}
/* Tabs on the start edge, search on the end — logical properties so it flips under dir="rtl". */
.filters {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-block: 4px 8px;
}
.search {
  margin-inline-start: auto;
  width: min(260px, 40%);
}
.rows {
  display: grid;
  gap: 4px;
}

/* One grid for the header and every row, so the columns line up down the page. */
.table {
  --hr-cols: minmax(180px, 1.1fr) minmax(80px, 0.5fr) minmax(90px, 0.6fr) 110px 96px 104px;
  width: 100%;
}
.thead,
.trow {
  display: grid;
  grid-template-columns: var(--hr-cols);
  gap: 12px;
  align-items: center;
  padding-inline: 12px;
}
.thead {
  height: 34px;
  border-block-end: 1px solid var(--kern-border);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--kern-ink-400);
}
.trow {
  height: 48px;
  border-block-end: 1px solid var(--kern-border-hairline);
  text-decoration: none;
  color: inherit;
  border-radius: 6px;
}
.trow:hover {
  background: var(--kern-surface-raised, #fff);
}
.cell {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.who {
  display: flex;
  align-items: center;
  gap: 10px;
}
.stack {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  font-size: 13.5px;
  font-weight: 500;
}
.sub,
.muted {
  font-size: 12px;
  color: var(--kern-ink-500);
}
.role {
  font-size: 13px;
}
.num {
  font-size: 13px;
  color: var(--kern-ink-500);
  font-variant-numeric: tabular-nums;
}
.cards {
  display: grid;
  gap: 8px;
}
.cardhead {
  display: flex;
  align-items: center;
  gap: 8px;
}
.summary {
  font-size: 13.5px;
  margin: 7px 0 0;
}
.cardactions {
  display: flex;
  gap: 6px;
  margin-block-start: 11px;
}

/* Below 1024 the right column stacks under the table rather than squeezing it. */
@media (max-width: 1024px) {
  .split {
    grid-template-columns: minmax(0, 1fr);
  }
  .tiles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
