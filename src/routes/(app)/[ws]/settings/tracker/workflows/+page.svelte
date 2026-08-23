<script lang="ts">
import type { Workflow } from '@kernhq/module-tracker/client'
import { describeApprovers, describeRule } from '@kernhq/module-tracker/client'
import { Badge, Button, Icon, IconButton, Input, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Workflows: the statuses work moves through, and what each move requires.
 *
 * The statuses are editable here. The transitions are shown rather than edited — every one of them
 * carries conditions, validators and post-functions, and a graph editor for those is its own piece
 * of work. What matters first is that they stop being invisible: a workflow's rules decided who
 * could close an issue and nobody could read them.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('workflowManage'))

let selectedId = $state<string | null>(null)
/** The statuses being edited, or `null` when nothing has been touched — which is what gates Save. */
let draft = $state<Array<{ id: string; name: string }> | null>(null)
let adding = $state('')

const workflowsQuery = createQuery(() => ({
  queryKey: [...trackerKeys.types(workspaceId), 'workflows'],
  queryFn: () => api.workflows.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))
const typesQuery = createQuery(() => ({
  queryKey: trackerKeys.types(workspaceId),
  queryFn: () => api.types.list({ workspaceId, includeArchived: false }),
  enabled: Boolean(workspaceId),
}))

const workflows = $derived(workflowsQuery.data ?? [])
const selected = $derived(workflows.find((w) => w.id === selectedId) ?? workflows[0] ?? null)
const statuses = $derived(
  draft ?? (selected?.definition.statuses ?? []).map((s) => ({ id: s.id, name: s.name })),
)
/** Which work item types this workflow governs — the reason editing it is not a local decision. */
const usedBy = $derived((typesQuery.data ?? []).filter((t) => t.workflowId === selected?.id))

const save = createMutation(() => ({
  mutationFn: (next: Array<{ id: string; name: string }>) => {
    const definition = selected!.definition
    const byId = new Map(definition.statuses.map((s) => [s.id, s]))
    return api.workflows.update({
      workspaceId,
      id: selected!.id,
      patch: {
        definition: {
          ...definition,
          // Renames and reordering only. A status is identified by its id, which issues point at,
          // so changing a name never moves an issue.
          statuses: next.map((s, order) => ({ ...byId.get(s.id)!, name: s.name, order })),
        },
      },
    } as never)
  },
  onSuccess: () => {
    draft = null
    void queryClient.invalidateQueries({ queryKey: trackerKeys.types(workspaceId) })
    void queryClient.invalidateQueries({ queryKey: trackerKeys.statuses(workspaceId) })
    toast.success(m.tracker_workflow_saved())
  },
  onError: (error: Error) => toast.error(error.message),
}))

const select = (workflow: Workflow) => {
  selectedId = workflow.id
  draft = null
}

const rename = (id: string, name: string) => {
  draft = statuses.map((s) => (s.id === id ? { ...s, name } : s))
}
const move = (index: number, by: number) => {
  const next = [...statuses]
  const target = index + by
  if (target < 0 || target >= next.length) return
  const [moved] = next.splice(index, 1)
  next.splice(target, 0, moved!)
  draft = next
}

const statusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id
const from = (t: { from: string | string[] }) =>
  t.from === '*' ? m.tracker_workflow_from_any() : (t.from as string[]).map(statusName).join(', ')
</script>

<SettingsPage title={m.tracker_settings_workflows()} description={m.tracker_settings_workflows_hint()}>
  {#if workflowsQuery.isPending}
    <SettingsSection><div class="state"><Spinner /></div></SettingsSection>
  {:else if !workflows.length}
    <SettingsSection><p class="state">{m.tracker_settings_workflows_empty()}</p></SettingsSection>
  {:else}
    <SettingsSection flush>
      <ul class="wlist" data-testid="workflow-list">
        {#each workflows as workflow (workflow.id)}
          <li>
            <button
              type="button"
              class="wrow"
              class:on={selected?.id === workflow.id}
              onclick={() => select(workflow)}
              data-workflow={workflow.name}
            >
              <span class="wname">{workflow.name}</span>
              <span class="wmeta">{m.tracker_workflow_status_count({ count: workflow.definition.statuses.length })}</span>
              {#if workflow.isDefault}<Badge>{m.tracker_type_default()}</Badge>{/if}
            </button>
          </li>
        {/each}
      </ul>
    </SettingsSection>

    {#if selected}
      <SettingsSection title={m.tracker_workflow_statuses()} description={m.tracker_workflow_statuses_hint()}>
        <ul class="statuses" data-testid="workflow-statuses">
          {#each statuses as status, i (status.id)}
            <li>
              <span class="ord">{i + 1}</span>
              {#if canManage}
                <Input
                  value={status.name}
                  data-status={status.id}
                  oninput={(e: Event) => rename(status.id, (e.currentTarget as HTMLInputElement).value)}
                />
                <IconButton
                  icon="chevron-up"
                  size={22}
                  label={m.tracker_workflow_move_up({ name: status.name })}
                  disabled={i === 0}
                  onclick={() => move(i, -1)}
                />
                <IconButton
                  icon="chevron-down"
                  size={22}
                  label={m.tracker_workflow_move_down({ name: status.name })}
                  disabled={i === statuses.length - 1}
                  onclick={() => move(i, 1)}
                />
              {:else}
                <span class="sname">{status.name}</span>
              {/if}
            </li>
          {/each}
        </ul>

        {#if usedBy.length}
          <p class="used">
            {m.tracker_workflow_used_by({ types: usedBy.map((t) => t.name).join(', ') })}
          </p>
        {/if}

        {#snippet footer()}
          <Button variant="ghost" size="sm" onclick={() => (draft = null)} disabled={!draft}>
            {m.discard()}
          </Button>
          <Button
            size="sm"
            disabled={!draft || !canManage}
            loading={save.isPending}
            onclick={() => draft && save.mutate(draft)}
            data-testid="save-workflow"
          >
            {m.save()}
          </Button>
        {/snippet}
      </SettingsSection>

      <SettingsSection
        title={m.tracker_workflow_transitions()}
        description={m.tracker_workflow_transitions_hint()}
      >
        <ul class="transitions" data-testid="workflow-transitions">
          {#each selected.definition.transitions as transition (transition.id)}
            <li>
              <div class="thead">
                <strong>{transition.name}</strong>
                <span class="path">
                  {from(transition)}
                  <Icon name="arrow-right" size={12} strokeWidth={1.8} />
                  {statusName(transition.to)}
                </span>
              </div>
              <ul class="rules">
                {#if transition.approval}
                  <li class="rule approval">
                    {describeApprovers(
                      transition.approval.approvers,
                      transition.approval.minApprovals ?? 1,
                    )}
                  </li>
                {/if}
                {#each [...(transition.conditions ?? []), ...(transition.validators ?? []), ...(transition.postFunctions ?? [])] as rule, i (rule.type + i)}
                  {@const described = describeRule(rule)}
                  <li class="rule" class:unknown={described.unknown}>{described.text}</li>
                {/each}
                {#if transition.screen?.fields?.length}
                  <li class="rule">
                    {m.tracker_workflow_asks({ count: transition.screen.fields.length })}
                  </li>
                {/if}
              </ul>
            </li>
          {/each}
        </ul>
      </SettingsSection>
    {/if}
  {/if}
</SettingsPage>

<style>
.state {
  display: grid;
  place-items: center;
  padding: 26px;
  font-size: 13px;
}
.wlist,
.statuses,
.transitions,
.rules {
  list-style: none;
  margin: 0;
  padding: 0;
}
.wlist li {
  border-bottom: 1px solid var(--kern-border-hairline);
}
.wlist li:last-child {
  border-bottom: 0;
}
.wrow {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 18px;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
}
.wrow:hover {
  background: var(--kern-surface-hover);
}
.wrow.on {
  background: var(--kern-surface-active);
}
.wname {
  font-size: 13px;
  color: var(--kern-ink-800);
}
.wmeta {
  flex: 1;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.statuses li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
}
.ord {
  width: 18px;
  font-family: var(--kern-font-mono);
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
.sname {
  font-size: 13px;
}
.used {
  margin: 10px 0 0;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.transitions > li {
  padding: 10px 0;
  border-bottom: 1px solid var(--kern-border-hairline);
}
.transitions > li:last-child {
  border-bottom: 0;
}
.thead {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 13px;
}
.path {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--kern-ink-450, var(--kern-ink-400));
}
.rules {
  margin-top: 4px;
}
.rule {
  font-size: 12.5px;
  color: var(--kern-ink-550);
  padding: 1px 0 1px 10px;
  border-inline-start: 2px solid var(--kern-border);
  margin-inline-start: 2px;
}
.rule.approval {
  border-color: var(--kern-warning);
}
.rule.unknown {
  font-family: var(--kern-font-mono);
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
</style>
