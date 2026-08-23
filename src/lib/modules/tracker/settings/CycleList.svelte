<script lang="ts">
import type { Cycle } from '@kernhq/module-tracker/client'
import { Badge, Button, IconButton, Input, Select, Spinner } from '@kernhq/ui'
import { getLocale } from '$lib/paraglide/runtime'
import * as m from '$msg'

/**
 * A project's cycles — the sprint, whatever a team calls it.
 *
 * Not a `PlanningList` because a cycle is not a name: it is a name and a window, and the window is
 * the whole point. A cycle also has a life — upcoming, active, completed — and the two moves that
 * advance it are the reason the screen exists at all.
 *
 * Completing asks where unfinished work goes rather than deciding quietly. Leaving a cycle is the
 * one moment a team looks at what did not get done, and moving it somewhere they did not choose is
 * how work disappears.
 */
interface Props {
  cycles: Cycle[]
  loading?: boolean
  editable: boolean
  busy?: boolean
  oncreate: (input: { name: string; startAt: string; endAt: string }) => void
  onstart: (id: string) => void
  oncomplete: (input: { id: string; rollToCycleId: string | null }) => void
  onremove: (id: string) => void
}
let {
  cycles,
  loading = false,
  editable,
  busy = false,
  oncreate,
  onstart,
  oncomplete,
  onremove,
}: Props = $props()

let name = $state('')
let startAt = $state('')
let endAt = $state('')
let confirmingId = $state<string | null>(null)
/** The cycle being completed, and where its leftovers are headed. */
let completingId = $state<string | null>(null)
let rollTo = $state('')

const dates = $derived(
  new Intl.DateTimeFormat(getLocale(), { day: 'numeric', month: 'short', year: 'numeric' }),
)
/** `formatRange`, not two dates joined by a dash: in an RTL locale a hand-built range reads
 * backwards, and the shared parts of the two dates are collapsed for free. */
const range = (c: Cycle) => dates.formatRange(new Date(c.startAt), new Date(c.endAt))

/** An end before its start is the one mistake this form can make; it says so instead of failing. */
const invalidRange = $derived(Boolean(startAt && endAt && endAt < startAt))
const canAdd = $derived(Boolean(name.trim() && startAt && endAt) && !invalidRange && !busy)

const submit = () => {
  if (!canAdd) return
  oncreate({
    name: name.trim(),
    startAt: new Date(startAt).toISOString(),
    endAt: new Date(endAt).toISOString(),
  })
  name = ''
  startAt = ''
  endAt = ''
}

/** Where leftovers could go: an upcoming cycle of the same project, never the one being closed. */
const rollTargets = $derived(
  cycles
    .filter((c) => c.status === 'upcoming' && c.id !== completingId)
    .map((c) => ({ value: c.id, label: c.name })),
)

const beginComplete = (c: Cycle) => {
  completingId = c.id
  rollTo = ''
}

const statusLabel = (status: Cycle['status']) =>
  status === 'active'
    ? m.tracker_cycle_active()
    : status === 'completed'
      ? m.tracker_cycle_completed()
      : m.tracker_cycle_upcoming()
</script>

<section class="clist" data-testid="planning-cycles">
  <header>
    <h3>{m.tracker_planning_cycles()}</h3>
    <p>{m.tracker_planning_cycles_hint()}</p>
  </header>

  {#if loading}
    <div class="state"><Spinner /></div>
  {:else}
    <ul>
      {#each cycles as cycle (cycle.id)}
        <!-- Two lines, not one: a cycle carries a number, a name, a state, a window, its progress
             and what it inherited, and on one line the name is what gets squeezed out. The name is
             the thing being looked for. -->
        <li class="cycle" data-testid="cycle-row">
          <span class="num">{cycle.number}</span>
          <span class="body">
            <span class="top">
              <span class="name" data-item={cycle.name}>{cycle.name}</span>
              <Badge tone={cycle.status === 'completed' ? 'done' : cycle.status}>
                {statusLabel(cycle.status)}
              </Badge>
            </span>
            <span class="meta">
              <span>{range(cycle)}</span>
              <span>{m.tracker_planning_done_of({ done: cycle.stats.done, total: cycle.stats.total })}</span>
              {#if cycle.carryOverCount > 0}
                <!-- Where a cycle's work came from is worth as much as where it went: a cycle that
                     is mostly last cycle's leftovers is the thing a team needs to see. -->
                <span>{m.tracker_cycle_carried({ count: cycle.carryOverCount })}</span>
              {/if}
            </span>
          </span>
          {#if editable && cycle.status === 'upcoming'}
            <Button size="sm" variant="ghost" onclick={() => onstart(cycle.id)} data-testid="cycle-start">
              {m.tracker_cycle_start()}
            </Button>
          {/if}
          {#if editable && cycle.status === 'active'}
            <Button
              size="sm"
              variant="ghost"
              onclick={() => beginComplete(cycle)}
              data-testid="cycle-complete"
            >
              {m.tracker_cycle_complete()}
            </Button>
          {/if}
          {#if editable}
            <IconButton
              icon="x"
              size={22}
              label={m.tracker_planning_remove({ name: cycle.name })}
              onclick={() => (confirmingId = cycle.id)}
            />
          {/if}
        </li>

        {#if completingId === cycle.id}
          <li class="panel" data-testid="cycle-complete-panel">
            <p>{m.tracker_cycle_complete_body({ name: cycle.name })}</p>
            <div class="row">
              <span data-testid="cycle-roll">
                <Select
                  value={rollTo}
                  options={[{ value: '', label: m.tracker_cycle_roll_backlog() }, ...rollTargets]}
                  onValueChange={(v: string) => (rollTo = v)}
                />
              </span>
              <Button
                size="sm"
                onclick={() => {
                  oncomplete({ id: cycle.id, rollToCycleId: rollTo || null })
                  completingId = null
                }}
                data-testid="cycle-complete-confirm"
              >
                {m.tracker_cycle_complete()}
              </Button>
              <Button size="sm" variant="ghost" onclick={() => (completingId = null)}>{m.cancel()}</Button>
            </div>
          </li>
        {/if}

        {#if confirmingId === cycle.id}
          <li class="panel danger" role="alertdialog">
            <span>{m.tracker_planning_remove_body({ name: cycle.name })}</span>
            <div class="row">
              <Button
                size="sm"
                variant="danger"
                onclick={() => {
                  onremove(cycle.id)
                  confirmingId = null
                }}
              >
                {m.delete()}
              </Button>
              <Button size="sm" variant="ghost" onclick={() => (confirmingId = null)}>{m.cancel()}</Button>
            </div>
          </li>
        {/if}
      {:else}
        <li class="empty-row">{m.tracker_planning_cycles_empty()}</li>
      {/each}
    </ul>

    {#if editable}
      <!-- The name spans the row and the two dates sit side by side, because a start and an end
           that land on different lines stop reading as one window. -->
      <form class="add" onsubmit={(e) => { e.preventDefault(); submit() }}>
        <span class="wide">
          <Input bind:value={name} placeholder={m.tracker_planning_cycle_add()} data-testid="cycle-name" />
        </span>
        <input
          class="date"
          type="date"
          bind:value={startAt}
          aria-label={m.tracker_cycle_starts()}
          data-testid="cycle-start-date"
        />
        <input
          class="date"
          type="date"
          bind:value={endAt}
          aria-label={m.tracker_cycle_ends()}
          data-testid="cycle-end-date"
        />
        <Button size="sm" disabled={!canAdd} onclick={submit} data-testid="cycle-add">{m.add()}</Button>
      </form>
      {#if invalidRange}
        <p class="warn" data-testid="cycle-range-error">{m.tracker_cycle_range_error()}</p>
      {/if}
    {/if}
  {/if}
</section>

<style>
.clist {
  padding: 14px 0;
  border-bottom: 1px solid var(--kern-border-hairline);
}
h3 {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
}
header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: var(--kern-ink-400);
}
ul {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}
.cycle {
  align-items: flex-start;
  padding: 7px 0;
}
.num {
  min-width: 20px;
  padding-top: 2px;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  color: var(--kern-ink-400);
}
.body {
  flex: 1;
  min-width: 0;
}
.top {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name {
  min-width: 0;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-top: 2px;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.panel {
  display: block;
  padding: 8px 0 10px;
  font-size: 12.5px;
}
.panel p {
  margin: 0 0 6px;
}
.panel.danger {
  color: var(--kern-danger);
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.empty-row {
  font-size: 13px;
  color: var(--kern-ink-400);
}
.warn {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--kern-danger);
}
.add {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}
.wide {
  grid-column: 1 / -1;
}
.date {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid var(--kern-border);
  border-radius: var(--kern-radius-sm);
  background: var(--kern-surface);
  color: inherit;
  font: inherit;
  font-size: 13px;
}
.state {
  display: grid;
  place-items: center;
  padding: 18px;
}
</style>
