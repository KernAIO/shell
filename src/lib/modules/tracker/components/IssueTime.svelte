<script lang="ts">
import { formatDuration, type Timer, type Worklog } from '@kernhq/module-tracker/client'
import { Button, Icon, IconButton, Input, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { relativeTime } from '$lib/format'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'
import { getTrackerApi } from '../api'
import { getTrackerCatalogue } from '../context.svelte'
import { canTracker } from '../permissions'
import { trackerKeys } from '../query'
import { parseDuration } from '../time'

/**
 * Time spent on an issue: a running timer, and the work already logged.
 *
 * The server has had both since the module existed and nothing offered either, so `timeSpentSec`
 * on an issue could only ever be zero. A timer belongs to a person rather than to an issue —
 * starting one anywhere stops the one you had running — so the control says which issue it is on.
 */
interface Props {
  workspaceId: string
  issueId: string
  canLog: boolean
}
let { workspaceId, issueId, canLog }: Props = $props()

const api = getTrackerApi()
const cat = getTrackerCatalogue()
const queryClient = useQueryClient()

let manual = $state('')
let adding = $state(false)

const worklogsQuery = createQuery(() => ({
  queryKey: trackerKeys.worklogs(workspaceId, issueId),
  queryFn: () => api.worklogs.list({ workspaceId, issueId }),
}))
const timerQuery = createQuery(() => ({
  queryKey: trackerKeys.timer(workspaceId),
  queryFn: () => api.worklogs.timers.current({ workspaceId }),
  // A timer runs while nobody is looking, so its elapsed time has to be refreshed rather than read
  // once and left to drift.
  refetchInterval: 30_000,
}))

const worklogs = $derived(worklogsQuery.data ?? [])
const timer = $derived((timerQuery.data ?? null) as Timer | null)
const onThisIssue = $derived(timer?.issueId === issueId)
const total = $derived(worklogs.reduce((sum, w) => sum + w.durationSec, 0))

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: trackerKeys.worklogs(workspaceId, issueId) })
  void queryClient.invalidateQueries({ queryKey: trackerKeys.timer(workspaceId) })
  void queryClient.invalidateQueries({ queryKey: trackerKeys.issue(workspaceId, issueId) })
}
const fail = (error: Error) => toast.error(error.message)

const start = createMutation(() => ({
  mutationFn: () => api.worklogs.timers.start({ workspaceId, issueId }),
  onSuccess: refresh,
  onError: fail,
}))
const stop = createMutation(() => ({
  mutationFn: (discard: boolean) => api.worklogs.timers.stop({ workspaceId, discard }),
  onSuccess: refresh,
  onError: fail,
}))
const log = createMutation(() => ({
  mutationFn: (durationSec: number) =>
    api.worklogs.create({ workspaceId, issueId, durationSec, adjustRemaining: 'auto' }),
  onSuccess: () => {
    manual = ''
    adding = false
    refresh()
  },
  onError: fail,
}))
const remove = createMutation(() => ({
  mutationFn: (id: string) => api.worklogs.delete({ workspaceId, id }),
  onSuccess: refresh,
  onError: fail,
}))

const parsed = $derived(parseDuration(manual))
const elapsed = $derived(
  timer ? Math.max(0, Math.floor((Date.now() - Date.parse(timer.startedAt)) / 1000)) : 0,
)
const who = (userId: string) =>
  userId === session.user?.id ? m.tracker_time_you() : (cat.person(userId)?.name ?? '')
</script>

<section class="time" data-testid="issue-time">
  <div class="thead">
    <span class="kern-sublabel">{m.tracker_time_title()}</span>
    {#if total > 0}<span class="total">{formatDuration(total)}</span>{/if}
  </div>

  {#if canLog}
    <div class="row">
      {#if onThisIssue}
        <Button size="sm" onclick={() => stop.mutate(false)} data-testid="timer-stop">
          <Icon name="clock" size={13} strokeWidth={1.9} />
          {m.tracker_time_stop({ elapsed: formatDuration(elapsed) })}
        </Button>
        <Button size="sm" variant="ghost" onclick={() => stop.mutate(true)}>
          {m.tracker_time_discard()}
        </Button>
      {:else}
        <Button size="sm" variant="secondary" onclick={() => start.mutate()} data-testid="timer-start">
          <Icon name="clock" size={13} strokeWidth={1.9} />
          {m.tracker_time_start()}
        </Button>
        {#if timer}
          <!-- A timer belongs to a person, so starting one here stops the one running elsewhere. -->
          <span class="elsewhere">{m.tracker_time_running_elsewhere()}</span>
        {/if}
      {/if}

      {#if adding}
        <Input
          bind:value={manual}
          placeholder={m.tracker_time_placeholder()}
          data-testid="time-amount"
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && parsed) log.mutate(parsed)
            if (e.key === 'Escape') adding = false
          }}
        />
        <Button size="sm" disabled={!parsed} onclick={() => parsed && log.mutate(parsed)} data-testid="time-log">
          {m.tracker_time_log()}
        </Button>
      {:else}
        <button type="button" class="manual" onclick={() => (adding = true)}>
          {m.tracker_time_log_manually()}
        </button>
      {/if}
    </div>
  {/if}

  {#if worklogs.length}
    <ul class="logs">
      {#each worklogs as entry (entry.id)}
        <li>
          <span class="dur">{formatDuration(entry.durationSec)}</span>
          <span class="by">{who(entry.userId)}</span>
          <time datetime={entry.startedAt}>{relativeTime(entry.startedAt)}</time>
          {#if entry.note}<span class="note">{entry.note}</span>{/if}
          {#if canLog && entry.userId === session.user?.id}
            <IconButton
              icon="x"
              size={22}
              label={m.tracker_time_remove()}
              onclick={() => remove.mutate(entry.id)}
            />
          {/if}
        </li>
      {/each}
    </ul>
  {:else if !canLog}
    <p class="empty">{m.tracker_time_empty()}</p>
  {/if}
</section>

<style>
.time {
  margin-top: 16px;
}
.thead {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.total {
  font-size: 13px;
  font-weight: 600;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.manual,
.elsewhere {
  border: 0;
  background: none;
  color: var(--kern-ink-350);
  font: inherit;
  font-size: 12px;
  padding: 2px 4px;
}
.manual {
  cursor: pointer;
}
.manual:hover {
  color: var(--kern-ink);
}
.logs {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.logs li {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
}
.dur {
  font-weight: 600;
  min-width: 42px;
}
.by {
  color: var(--kern-ink-550);
}
.note,
time {
  color: var(--kern-ink-350);
}
.empty {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--kern-ink-350);
}
</style>
