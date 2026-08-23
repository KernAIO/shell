<script lang="ts">
import type { Project } from '@kernhq/module-tracker/client'
import { Badge, Button, Checkbox, Input, Select, Spinner, Textarea, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * Running a project after it has been created.
 *
 * A project could be created and never touched again: `projects.update`, `archive` and `delete` all
 * had a server and nothing that called it, so a typo in a name outlived the project and a finished
 * project stayed in every menu forever.
 *
 * The key is deliberately not editable. It is in every issue reference (`KRN-12`), every link
 * anybody has pasted, and every saved query — renaming it would break all of them at once, and the
 * server does not offer it either.
 */
const api = getTrackerApi()
const core = getApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('projectManage'))

let selectedId = $state<string | null>(null)
let showArchived = $state(false)
/** `null` means "no unsaved change", which is what disables Save. */
let draft = $state<Record<string, unknown> | null>(null)
let confirmDelete = $state(false)
let deleteKey = $state('')

const projectsQuery = createQuery(() => ({
  queryKey: [...trackerKeys.projects(workspaceId), showArchived],
  queryFn: () => api.projects.list({ workspaceId, includeArchived: showArchived }),
  enabled: Boolean(workspaceId),
}))
const projects = $derived(projectsQuery.data ?? [])
const project = $derived(projects.find((p) => p.id === selectedId) ?? projects[0] ?? null)

/** What the form shows: the unsaved value where there is one, the stored value otherwise. */
const field = <K extends keyof Project>(key: K): Project[K] =>
  (draft && key in draft ? (draft[key] as Project[K]) : project?.[key]) as Project[K]
const edit = (patch: Record<string, unknown>) => {
  draft = { ...(draft ?? {}), ...patch }
}

const settings = $derived(project?.settings)
const cycleSettings = $derived(
  (draft?.settings as Project['settings'] | undefined)?.cycles ?? settings?.cycles,
)
const editSettings = (patch: Record<string, unknown>) => {
  const base = (draft?.settings as Record<string, unknown> | undefined) ?? {}
  edit({ settings: { ...base, ...patch } })
}

const refresh = () => queryClient.invalidateQueries({ queryKey: ['tracker', 'project'] })

const save = createMutation(() => ({
  mutationFn: (patch: Record<string, unknown>) =>
    api.projects.update({ workspaceId, projectId: project?.id as string, patch }),
  onSuccess: () => {
    draft = null
    void refresh()
    toast.success(m.tracker_project_saved())
  },
  onError: (error: Error) => toast.error(error.message),
}))

/**
 * Archived, not deleted: the issues stay, the history stays, and the project comes off the menus.
 * It is what a finished project wants, and it is reversible, which deletion is not.
 */
const archive = createMutation(() => ({
  mutationFn: (input: { projectId: string; archived: boolean }) =>
    api.projects.archive({ workspaceId, ...input }),
  onSuccess: () => void refresh(),
  onError: (error: Error) => toast.error(error.message),
}))

const remove = createMutation(() => ({
  mutationFn: (projectId: string) => api.projects.delete({ workspaceId, projectId }),
  onSuccess: () => {
    confirmDelete = false
    deleteKey = ''
    selectedId = null
    void refresh()
    toast.success(m.tracker_project_deleted())
  },
  onError: (error: Error) => toast.error(error.message),
}))

/** Switching project abandons an unsaved edit rather than carrying it to another project. */
const select = (id: string) => {
  selectedId = id
  draft = null
  confirmDelete = false
  deleteKey = ''
}

/** The lead is a workspace member, which is core's list rather than the tracker's. */
const membersQuery = createQuery(() => ({
  queryKey: keys.members(workspaceId),
  queryFn: () => core.workspaces.members.list({ workspaceId, limit: 200 }),
  enabled: Boolean(workspaceId),
}))
const leadOptions = $derived([
  { value: '', label: m.tracker_project_no_lead() },
  ...(membersQuery.data?.items ?? []).map((entry) => ({
    value: entry.user.id,
    label: entry.user.name,
  })),
])
</script>

<SettingsPage title={m.tracker_settings_projects()} description={m.tracker_settings_projects_hint()}>
  {#if projectsQuery.isPending}
    <SettingsSection><div class="state"><Spinner /></div></SettingsSection>
  {:else if !projects.length}
    <SettingsSection>
      <p class="state">{m.tracker_settings_planning_no_projects()}</p>
    </SettingsSection>
  {:else}
    <SettingsSection flush>
      <ul class="plist" data-testid="project-list">
        {#each projects as p (p.id)}
          <li class:on={project?.id === p.id}>
            <button
              type="button"
              class="prow"
              onclick={() => select(p.id)}
              data-testid="project-row"
              data-project-key={p.key}
            >
              <span class="pkey">{p.key}</span>
              <span class="pname">{p.name}</span>
              {#if p.archivedAt}<Badge tone="grey">{m.tracker_project_archived()}</Badge>{/if}
              <span class="pnote">{m.tracker_project_open_count({ count: p.openIssueCount })}</span>
            </button>
          </li>
        {/each}
      </ul>

      {#snippet footer()}
        <Checkbox
          checked={showArchived}
          label={m.tracker_project_show_archived()}
          onCheckedChange={(on: boolean) => (showArchived = on)}
        />
      {/snippet}
    </SettingsSection>

    {#if project}
      <SettingsSection title={m.tracker_project_identity()} description={m.tracker_project_key_fixed()}>
        <div class="grid">
          <label class="row">
            <span class="lbl">{m.tracker_project_name()}</span>
            <Input
              value={field('name') ?? ''}
              disabled={!canManage}
              oninput={(e: Event) => edit({ name: (e.currentTarget as HTMLInputElement).value })}
              data-testid="project-name"
            />
          </label>
          <label class="row">
            <span class="lbl">{m.tracker_project_description()}</span>
            <Textarea
              value={field('description') ?? ''}
              rows={2}
              disabled={!canManage}
              oninput={(e: Event) =>
                edit({ description: (e.currentTarget as HTMLTextAreaElement).value || null })}
            />
          </label>
          <label class="row">
            <span class="lbl">{m.tracker_project_lead()}</span>
            <Select
              value={(field('leadId') as string) ?? ''}
              options={leadOptions}
              disabled={!canManage}
              onValueChange={(v: string) => edit({ leadId: v || null })}
            />
          </label>
          <label class="row">
            <span class="lbl">{m.tracker_project_visibility()}</span>
            <Select
              value={field('visibility') ?? 'workspace'}
              options={[
                { value: 'workspace', label: m.tracker_project_visible_workspace() },
                { value: 'private', label: m.tracker_project_visible_private() },
              ]}
              disabled={!canManage}
              onValueChange={(v: string) => edit({ visibility: v })}
            />
          </label>
          <label class="row">
            <span class="lbl">{m.tracker_project_default_assignee()}</span>
            <Select
              value={field('defaultAssignee') ?? 'unassigned'}
              options={[
                { value: 'unassigned', label: m.tracker_project_assignee_nobody() },
                { value: 'lead', label: m.tracker_project_assignee_lead() },
              ]}
              disabled={!canManage}
              onValueChange={(v: string) => edit({ defaultAssignee: v })}
            />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title={m.tracker_project_behaviour()} description={m.tracker_project_behaviour_hint()}>
        <div class="grid">
          <label class="row">
            <span class="lbl">{m.tracker_project_estimation()}</span>
            <Select
              value={(draft?.settings as Project['settings'] | undefined)?.estimation ??
                settings?.estimation ??
                'points'}
              options={[
                { value: 'points', label: m.tracker_estimate_points() },
                { value: 'hours', label: m.tracker_estimate_hours() },
                { value: 'none', label: m.tracker_estimate_none() },
              ]}
              disabled={!canManage}
              onValueChange={(v: string) => editSettings({ estimation: v })}
            />
          </label>

          <!-- Triage is what the request link feeds: without it, anything a stranger sends lands
               straight in the backlog with no one having looked at it. -->
          <Checkbox
            checked={(draft?.settings as Project['settings'] | undefined)?.triage?.enabled ??
              settings?.triage.enabled ??
              false}
            label={m.tracker_project_triage()}
            disabled={!canManage}
            onCheckedChange={(on: boolean) => editSettings({ triage: { enabled: on } })}
          />

          <span data-testid="project-cycles">
            <Checkbox
              checked={cycleSettings?.enabled ?? false}
              label={m.tracker_project_cycles()}
              disabled={!canManage}
              onCheckedChange={(on: boolean) =>
                editSettings({ cycles: { ...cycleSettings, enabled: on } })}
            />
          </span>
          {#if cycleSettings?.enabled}
            <label class="row">
              <span class="lbl">{m.tracker_project_cycle_length()}</span>
              <Select
                value={String(cycleSettings.lengthWeeks)}
                options={[1, 2, 3, 4].map((n) => ({
                  value: String(n),
                  label: m.tracker_project_weeks({ count: n }),
                }))}
                disabled={!canManage}
                onValueChange={(v: string) =>
                  editSettings({ cycles: { ...cycleSettings, lengthWeeks: Number(v) } })}
              />
            </label>
          {/if}
        </div>

        {#snippet footer()}
          <Button variant="ghost" size="sm" onclick={() => (draft = null)} disabled={!draft}>
            {m.discard()}
          </Button>
          <Button
            size="sm"
            disabled={!draft || !canManage}
            loading={save.isPending}
            onclick={() => draft && save.mutate(draft)}
            data-testid="project-save"
          >
            {m.save()}
          </Button>
        {/snippet}
      </SettingsSection>

      <SettingsSection title={m.tracker_project_lifecycle()} description={m.tracker_project_lifecycle_hint()}>
        <div class="lifecycle">
          {#if project.archivedAt}
            <Button
              size="sm"
              variant="ghost"
              disabled={!canManage}
              onclick={() => archive.mutate({ projectId: project.id, archived: false })}
              data-testid="project-restore"
            >
              {m.tracker_project_restore()}
            </Button>
          {:else}
            <Button
              size="sm"
              variant="ghost"
              disabled={!canManage}
              onclick={() => archive.mutate({ projectId: project.id, archived: true })}
              data-testid="project-archive"
            >
              {m.archive()}
            </Button>
          {/if}

          {#if confirmDelete}
            <!-- Typing the key, not a yes/no: this takes every issue, comment and attachment with
                 it and there is no undo. The one control in the tracker that asks for proof. -->
            <div class="danger" role="alertdialog" aria-label={m.tracker_project_delete_body()}>
              <p>{m.tracker_project_delete_body()}</p>
              <p class="ask">{m.tracker_project_delete_confirm({ key: project.key })}</p>
              <div class="row">
                <Input bind:value={deleteKey} placeholder={project.key} data-testid="project-delete-key" />
                <Button
                  size="sm"
                  variant="danger"
                  disabled={deleteKey !== project.key}
                  loading={remove.isPending}
                  onclick={() => remove.mutate(project.id)}
                  data-testid="project-delete-confirm"
                >
                  {m.delete()}
                </Button>
                <Button size="sm" variant="ghost" onclick={() => (confirmDelete = false)}>
                  {m.cancel()}
                </Button>
              </div>
            </div>
          {:else}
            <Button
              size="sm"
              variant="danger"
              disabled={!canManage}
              onclick={() => (confirmDelete = true)}
              data-testid="project-delete"
            >
              {m.delete()}
            </Button>
          {/if}
        </div>
      </SettingsSection>
    {/if}
  {/if}
</SettingsPage>

<style>
.state {
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 13px;
}
.plist {
  list-style: none;
  margin: 0;
  padding: 0;
}
.plist li {
  border-bottom: 1px solid var(--kern-border-hairline);
}
.plist li:last-child {
  border-bottom: 0;
}
.plist li.on {
  background: var(--kern-surface-active);
}
.prow {
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
.prow:hover {
  background: var(--kern-surface-hover);
}
.pkey {
  min-width: 44px;
  font-family: var(--kern-font-mono);
  font-size: 11.5px;
  color: var(--kern-ink-400);
}
.pname {
  flex: 1;
  font-size: 13px;
  color: var(--kern-ink-800);
}
.pnote {
  font-size: 12px;
  color: var(--kern-ink-400);
}
.grid {
  display: grid;
  gap: 12px;
}
.row {
  display: grid;
  gap: 4px;
}
.lbl {
  font-size: 12px;
  font-weight: 500;
  color: var(--kern-ink-600);
}
.lifecycle {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-start;
}
.danger {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid var(--kern-danger);
  border-radius: var(--kern-radius-sm);
  font-size: 12.5px;
}
.danger p {
  margin: 0 0 6px;
}
.danger .ask {
  color: var(--kern-ink-600);
}
.danger .row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
