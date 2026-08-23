<script lang="ts">
import type { RecurrenceRule } from '@kernhq/module-tracker/client'
import { Badge, Button, Icon, IconButton, Input, Select, Spinner } from '@kernhq/ui'
import { createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import { describeRecurrence, type RecurrenceStrings } from '$lib/modules/tracker/recurrence'
import { listMutation } from '$lib/modules/tracker/settings/mutations'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Work that comes back: issue templates, and issues that create themselves.
 *
 * Both had a server and no screen. A recurring issue in particular is something you set up once and
 * then have to trust — so what it will do is spelled out in a sentence, and when it last ran and
 * what it made are shown beside it, because a schedule you cannot check is a schedule you cannot
 * rely on.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('projectManage'))

let selectedProject = $state<string | null>(null)
let newName = $state('')
let freq = $state<RecurrenceRule['freq']>('weekly')
let at = $state('09:00')

const projectsQuery = createQuery(() => ({
  queryKey: trackerKeys.projects(workspaceId),
  queryFn: () => api.projects.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))
const projects = $derived(projectsQuery.data ?? [])
const projectId = $derived(selectedProject ?? projects[0]?.id ?? '')

const templatesQuery = createQuery(() => ({
  queryKey: [...trackerKeys.projects(workspaceId), 'issue-templates', projectId],
  queryFn: () => api.issues.templates.list({ workspaceId, projectId }),
  enabled: Boolean(projectId),
}))
const recurringQuery = createQuery(() => ({
  queryKey: [...trackerKeys.projects(workspaceId), 'recurring', projectId],
  queryFn: () => api.issues.recurring.list({ workspaceId, projectId }),
  enabled: Boolean(projectId),
}))

const refresh = () => queryClient.invalidateQueries({ queryKey: trackerKeys.projects(workspaceId) })

const addRecurring = listMutation(
  (input: { name: string; rule: RecurrenceRule }) =>
    api.issues.recurring.create({
      workspaceId,
      projectId,
      name: input.name,
      rule: input.rule,
      defaults: { title: input.name },
    } as never),
  refresh,
)
const toggleRecurring = listMutation(
  (input: { id: string; enabled: boolean }) =>
    api.issues.recurring.update({ workspaceId, id: input.id, patch: { enabled: input.enabled } }),
  refresh,
)
const removeRecurring = listMutation(
  (id: string) => api.issues.recurring.delete({ workspaceId, id }),
  refresh,
)
const removeTemplate = listMutation((id: string) => api.issues.templates.delete({ workspaceId, id }), refresh)

/** The wording, handed to the describer so the sentence can be built and tested separately. */
const strings: RecurrenceStrings = {
  every: (unit) => m.tracker_recur_every({ unit }),
  everyN: (n, unit) => m.tracker_recur_every_n({ n, unit }),
  day: m.tracker_recur_day(),
  week: m.tracker_recur_week(),
  month: m.tracker_recur_month(),
  year: m.tracker_recur_year(),
  on: (when, days) => m.tracker_recur_on({ when, days }),
  dayOfMonth: (day) => m.tracker_recur_day_of_month({ day }),
  at: (when, time) => m.tracker_recur_at({ when, time }),
  times: (text, count) => m.tracker_recur_times({ text, count }),
  until: (text, date) => m.tracker_recur_until({ text, date }),
}

const add = () => {
  const name = newName.trim()
  if (!name) return
  addRecurring.mutate({ name, rule: { freq, interval: 1, at } as RecurrenceRule })
  newName = ''
}

const when = (iso: string | null) => (iso ? iso.slice(0, 16).replace('T', ' ') : m.tracker_repeat_never())
</script>

<SettingsPage title={m.tracker_settings_repeating()} description={m.tracker_settings_repeating_hint()}>
  {#if projectsQuery.isPending}
    <SettingsSection><div class="state"><Spinner /></div></SettingsSection>
  {:else if !projects.length}
    <SettingsSection><p class="state">{m.tracker_settings_planning_no_projects()}</p></SettingsSection>
  {:else}
    <SettingsSection title={m.tracker_settings_planning_project()}>
      <Select
        value={projectId}
        options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
        onValueChange={(v: string) => (selectedProject = v)}
      />
    </SettingsSection>

    <SettingsSection title={m.tracker_repeat_title()} description={m.tracker_repeat_hint()}>
      {#if recurringQuery.isPending}
        <div class="state"><Spinner /></div>
      {:else}
        <ul class="rows" data-testid="recurring-list">
          {#each recurringQuery.data ?? [] as entry (entry.id)}
            <li>
              <div class="what">
                <span class="name">{entry.name}</span>
                <span class="rule">{describeRecurrence(entry.rule, strings)}</span>
                <span class="ran">
                  {m.tracker_repeat_last_run({ when: when(entry.lastRunAt) })}
                  · {m.tracker_repeat_next_run({ when: when(entry.nextRunAt) })}
                  · {m.tracker_repeat_made({ count: entry.runCount })}
                </span>
              </div>
              {#if !entry.enabled}<Badge>{m.tracker_repeat_paused()}</Badge>{/if}
              {#if canManage}
                <!-- A verb rather than a switch: "Pause" says what will happen, where a toggle
                     asks somebody to work out which way is on. -->
                <Button
                  size="sm"
                  variant="ghost"
                  onclick={() => toggleRecurring.mutate({ id: entry.id, enabled: !entry.enabled })}
                  data-testid="recurring-toggle"
                >
                  {entry.enabled ? m.tracker_repeat_pause() : m.tracker_repeat_resume()}
                </Button>
                <IconButton
                  icon="x"
                  size={22}
                  label={m.tracker_planning_remove({ name: entry.name })}
                  onclick={() => removeRecurring.mutate(entry.id)}
                />
              {/if}
            </li>
          {:else}
            <li class="empty">{m.tracker_repeat_empty()}</li>
          {/each}
        </ul>

        {#if canManage}
          <div class="add">
            <Input bind:value={newName} placeholder={m.tracker_repeat_name()} data-testid="recurring-name" />
            <Select
              value={freq}
              options={[
                { value: 'daily', label: m.tracker_recur_day() },
                { value: 'weekly', label: m.tracker_recur_week() },
                { value: 'monthly', label: m.tracker_recur_month() },
              ]}
              onValueChange={(v: string) => (freq = v as RecurrenceRule['freq'])}
            />
            <Input bind:value={at} type="time" />
            <Button size="sm" disabled={!newName.trim()} onclick={add} data-testid="recurring-add">
              {m.add()}
            </Button>
          </div>
          <p class="note">{m.tracker_repeat_note()}</p>
        {/if}
      {/if}
    </SettingsSection>

    <SettingsSection title={m.tracker_template_title()} description={m.tracker_template_hint()}>
      {#if templatesQuery.isPending}
        <div class="state"><Spinner /></div>
      {:else}
        <ul class="rows" data-testid="template-list">
          {#each templatesQuery.data ?? [] as template (template.id)}
            <li>
              <div class="what">
                <span class="name">{template.name}</span>
                {#if template.description}<span class="rule">{template.description}</span>{/if}
                {#if template.subItems.length}
                  <span class="ran">{m.tracker_template_subitems({ count: template.subItems.length })}</span>
                {/if}
              </div>
              {#if canManage}
                <IconButton
                  icon="x"
                  size={22}
                  label={m.tracker_planning_remove({ name: template.name })}
                  onclick={() => removeTemplate.mutate(template.id)}
                />
              {/if}
            </li>
          {:else}
            <li class="empty">
              <Icon name="bookmark" size={13} strokeWidth={1.8} />
              {m.tracker_template_empty()}
            </li>
          {/each}
        </ul>
      {/if}
    </SettingsSection>
  {/if}
</SettingsPage>

<style>
.state {
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 13px;
}
.rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.rows li {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--kern-border-hairline);
}
.rows li:last-child {
  border-bottom: 0;
}
.what {
  display: flex;
  flex-direction: column;
  gap: 1px;
  flex: 1;
  min-width: 0;
}
.name {
  font-size: 13px;
  color: var(--kern-ink-800);
}
.rule {
  font-size: 12.5px;
  color: var(--kern-ink-550);
}
.ran {
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
.empty {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--kern-ink-400);
}
.add {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--kern-ink-400);
}
</style>
