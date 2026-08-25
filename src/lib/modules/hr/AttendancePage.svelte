<script lang="ts">
import { Badge, EmptyState, Page, PageHeader, Skeleton, StatTile } from '@kernhq/ui'
import { createQuery } from '@tanstack/svelte-query'
import { page as pageState } from '$app/state'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getHrApi } from './api'
import ClockControls from './components/ClockControls.svelte'
import { formatDuration, hrKeys, monthRange } from './query'

/**
 * My attendance: the clock, then the month.
 *
 * The totals come from the derived day sheet rather than being added up here — the server already
 * knows what a day is worth, and a second implementation in the browser is how a screen starts
 * disagreeing with a payslip.
 */
const api = getHrApi()

const workspaceSlug = $derived(pageState.params.ws ?? '')
const workspace = $derived(session.workspaces.find((w) => w.slug === workspaceSlug))
const workspaceId = $derived(workspace?.id ?? '')

const range = $derived(monthRange())

const daysQuery = createQuery(() => ({
  queryKey: hrKeys.attendanceDays(workspaceId, undefined, range.from, range.to),
  enabled: Boolean(workspaceId),
  queryFn: () => api.attendance.days.list({ workspaceId, from: range.from, to: range.to, limit: 100 }),
}))
const days = $derived(daysQuery.data?.items ?? [])

const words = {
  hours: (n: string) => m.hr_hours_short({ n }),
  minutes: (n: string) => m.hr_minutes_short({ n }),
}

const totals = $derived({
  worked: days.reduce((sum, d) => sum + d.workedMinutes, 0),
  scheduled: days.reduce((sum, d) => sum + d.scheduledMinutes, 0),
  overtime: days.reduce((sum, d) => sum + d.overtimeMinutes, 0),
})

const statusLabel = (s: string) =>
  s === 'present'
    ? m.hr_att_status_present()
    : s === 'absent'
      ? m.hr_att_status_absent()
      : s === 'leave'
        ? m.hr_att_status_leave()
        : s === 'holiday'
          ? m.hr_att_status_holiday()
          : s === 'weekend'
            ? m.hr_att_status_weekend()
            : s === 'partial'
              ? m.hr_att_status_partial()
              : m.hr_att_status_pending()

const statusTone = (s: string) =>
  s === 'present'
    ? 'done'
    : s === 'absent'
      ? 'declined'
      : s === 'leave'
        ? 'on-leave'
        : s === 'pending'
          ? 'urgent'
          : 'grey'

const dayLabel = (iso: string) =>
  new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(`${iso}T00:00:00`),
  )
</script>

<PageHeader
  crumbs={[{ label: workspace?.name ?? '' }, { label: m.hr_attendance_title() }]}
  title={m.hr_attendance_title()}
/>

<Page>
  <ClockControls {workspaceId} />

  <div class="tiles">
    <StatTile label={m.hr_att_worked()} value={formatDuration(totals.worked, words)} />
    <StatTile label={m.hr_att_scheduled()} value={formatDuration(totals.scheduled, words)} />
    <StatTile label={m.hr_att_overtime()} value={formatDuration(totals.overtime, words)} />
  </div>

  {#if daysQuery.isLoading}
    <Skeleton height="200px" />
  {:else if days.length === 0}
    <EmptyState
      icon="timer"
      title={m.hr_attendance_none()}
      description={m.hr_attendance_none_desc()}
    />
  {:else}
    <ul>
      {#each days as day (day.id)}
        <li class="row">
          <span class="date">{dayLabel(day.businessDate)}</span>
          <span class="worked">{formatDuration(day.workedMinutes, words)}</span>
          {#if day.overtimeMinutes > 0}
            <span class="ot">+{formatDuration(day.overtimeMinutes, words)}</span>
          {/if}
          <!-- An anomaly is why a day needs a human; saying so beats a silent zero. -->
          {#if day.anomalies.length}
            <Badge tone="warning">{day.anomalies.length}</Badge>
          {/if}
          <Badge tone={statusTone(day.status)}>{statusLabel(day.status)}</Badge>
        </li>
      {/each}
    </ul>
  {/if}
</Page>

<style>
.tiles {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 12px;
  margin-block: 16px 20px;
}
ul {
  display: grid;
  gap: 4px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--kern-border);
}
.date {
  flex: 1;
}
.worked,
.ot {
  font-variant-numeric: tabular-nums;
}
.ot {
  color: var(--kern-ink-500);
}
</style>
