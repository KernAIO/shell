<script lang="ts">
import { Button, Select, Spinner, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { page } from '$app/state'
import SettingsPage from '$lib/components/settings/SettingsPage.svelte'
import SettingsSection from '$lib/components/settings/SettingsSection.svelte'
import { getTrackerApi } from '$lib/modules/tracker/api'
import { canTracker } from '$lib/modules/tracker/permissions'
import { trackerKeys } from '$lib/modules/tracker/query'
import { listMutation } from '$lib/modules/tracker/settings/mutations'
import PlanningList from '$lib/modules/tracker/settings/PlanningList.svelte'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * What a project sorts its work by: components, versions and labels.
 *
 * All three have had a server since the module existed and no screen at all, so a project could
 * only ever use the components and versions its template happened to seed. They are project-scoped,
 * which is why this page starts by asking which project — the other tracker settings are workspace
 * wide and do not.
 */
const api = getTrackerApi()
const queryClient = useQueryClient()

const slug = $derived(page.params.ws ?? '')
const workspaceId = $derived(session.workspaces.find((w) => w.slug === slug)?.id ?? '')
const canManage = $derived(canTracker('projectManage'))

let selectedId = $state<string | null>(null)

const projectsQuery = createQuery(() => ({
  queryKey: trackerKeys.projects(workspaceId),
  queryFn: () => api.projects.list({ workspaceId }),
  enabled: Boolean(workspaceId),
}))
const projects = $derived(projectsQuery.data ?? [])
const projectId = $derived(selectedId ?? projects[0]?.id ?? '')

const componentsQuery = createQuery(() => ({
  queryKey: [...trackerKeys.projects(workspaceId), 'components', projectId],
  queryFn: () => api.components.list({ workspaceId, projectId }),
  enabled: Boolean(projectId),
}))
const versionsQuery = createQuery(() => ({
  queryKey: [...trackerKeys.projects(workspaceId), 'versions', projectId],
  queryFn: () => api.versions.list({ workspaceId, projectId }),
  enabled: Boolean(projectId),
}))
const labelsQuery = createQuery(() => ({
  queryKey: [...trackerKeys.labels(workspaceId), projectId],
  queryFn: () => api.labels.list({ workspaceId, projectId }),
  enabled: Boolean(projectId),
}))

const refresh = () => {
  void queryClient.invalidateQueries({ queryKey: trackerKeys.projects(workspaceId) })
  void queryClient.invalidateQueries({ queryKey: trackerKeys.labels(workspaceId) })
}
/** A function declaration, not an arrow: an arrow's generic needs `<T,>` here, which the Svelte
 * formatter rewrites and then disagrees with itself about. */
function mutation<T>(fn: (input: T) => Promise<unknown>) {
  return listMutation(fn, refresh)
}

const addComponent = mutation((name: string) => api.components.create({ workspaceId, projectId, name }))
const renameComponent = mutation((input: { id: string; name: string }) =>
  api.components.update({ workspaceId, id: input.id, patch: { name: input.name } }),
)
const removeComponent = mutation((id: string) => api.components.delete({ workspaceId, id }))

const addVersion = mutation((name: string) => api.versions.create({ workspaceId, projectId, name }))
const renameVersion = mutation((input: { id: string; name: string }) =>
  api.versions.update({ workspaceId, id: input.id, patch: { name: input.name } }),
)
const removeVersion = mutation((id: string) => api.versions.delete({ workspaceId, id }))
const releaseVersion = mutation((input: { id: string; released: boolean }) =>
  api.versions.release({ workspaceId, ...input }),
)

const addLabel = mutation((name: string) => api.labels.create({ workspaceId, projectId, name }))
const renameLabel = mutation((input: { id: string; name: string }) =>
  api.labels.update({ workspaceId, id: input.id, patch: { name: input.name } }),
)
const removeLabel = mutation((id: string) => api.labels.delete({ workspaceId, id }))

/**
 * The intake link.
 *
 * `setIntake` returns the token and nothing else stores it, so the page keeps what it was handed.
 * Turning intake off returns `null`, which is the same thing as "there is no link" — the form then
 * says it is unavailable rather than accepting requests nobody reads.
 */
let intakeToken = $state<string | null>(null)
const intakeUrl = $derived(
  intakeToken ? `${typeof location === 'undefined' ? '' : location.origin}/request/${intakeToken}` : '',
)

const setIntake = createMutation(() => ({
  mutationFn: (input: { enabled: boolean; rotate: boolean }) =>
    api.projects.setIntake({ workspaceId, projectId, ...input }),
  onSuccess: (result: { token: string | null }) => {
    intakeToken = result.token
    toast.success(result.token ? m.tracker_intake_opened() : m.tracker_intake_closed())
  },
  onError: (error: Error) => toast.error(error.message),
}))

/** Switching project drops the link: it belonged to the project that was showing. */
$effect(() => {
  void projectId
  intakeToken = null
})

const copyLink = async () => {
  try {
    await navigator.clipboard.writeText(intakeUrl)
    toast.success(m.tracker_intake_copied())
  } catch {
    // A denied clipboard is not a failure worth an error: the link is on screen to select.
    toast.info(m.tracker_intake_copy_manually())
  }
}

const components = $derived(
  (componentsQuery.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    note: m.tracker_planning_issue_count({ count: c.issueCount }),
  })),
)
const versions = $derived(
  (versionsQuery.data ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    badge: v.status === 'released' ? m.tracker_version_released() : null,
    note: m.tracker_planning_done_of({ done: v.stats.done, total: v.stats.total }),
  })),
)
const labels = $derived((labelsQuery.data ?? []).map((l) => ({ id: l.id, name: l.name, color: l.color })))

const releasedIds = $derived(
  new Set((versionsQuery.data ?? []).filter((v) => v.status === 'released').map((v) => v.id)),
)
</script>

<SettingsPage title={m.tracker_settings_planning()} description={m.tracker_settings_planning_hint()}>
  {#if projectsQuery.isPending}
    <SettingsSection><div class="state"><Spinner /></div></SettingsSection>
  {:else if !projects.length}
    <SettingsSection>
      <p class="state">{m.tracker_settings_planning_no_projects()}</p>
    </SettingsSection>
  {:else}
    <SettingsSection title={m.tracker_settings_planning_project()}>
      <Select
        value={projectId}
        options={projects.map((p) => ({ value: p.id, label: `${p.key} · ${p.name}` }))}
        onValueChange={(v: string) => (selectedId = v)}
      />
    </SettingsSection>

    <SettingsSection
      title={m.tracker_intake_title()}
      description={m.tracker_intake_hint()}
    >
      {#if intakeToken}
        <p class="intake-link">
          <code data-testid="intake-link">{intakeUrl}</code>
        </p>
        <div class="row">
          <Button size="sm" variant="ghost" onclick={() => copyLink()} data-testid="intake-copy">
            {m.tracker_intake_copy()}
          </Button>
          <Button size="sm" variant="ghost" onclick={() => setIntake.mutate({ enabled: true, rotate: true })}>
            {m.tracker_intake_rotate()}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onclick={() => setIntake.mutate({ enabled: false, rotate: false })}
            data-testid="intake-close"
          >
            {m.tracker_intake_close()}
          </Button>
        </div>
        <p class="note">{m.tracker_intake_rotate_hint()}</p>
      {:else}
        <Button
          size="sm"
          disabled={!canManage}
          loading={setIntake.isPending}
          onclick={() => setIntake.mutate({ enabled: true, rotate: false })}
          data-testid="intake-open"
        >
          {m.tracker_intake_open()}
        </Button>
      {/if}
    </SettingsSection>

    <SettingsSection>
      <PlanningList
        title={m.tracker_planning_components()}
        description={m.tracker_planning_components_hint()}
        items={components}
        loading={componentsQuery.isPending}
        editable={canManage}
        addLabel={m.tracker_planning_component_add()}
        emptyLabel={m.tracker_planning_components_empty()}
        onadd={(name) => addComponent.mutate(name)}
        onrename={(id, name) => renameComponent.mutate({ id, name })}
        onremove={(id) => removeComponent.mutate(id)}
      />

      <PlanningList
        title={m.tracker_planning_versions()}
        description={m.tracker_planning_versions_hint()}
        items={versions}
        loading={versionsQuery.isPending}
        editable={canManage}
        addLabel={m.tracker_planning_version_add()}
        emptyLabel={m.tracker_planning_versions_empty()}
        onadd={(name) => addVersion.mutate(name)}
        onrename={(id, name) => renameVersion.mutate({ id, name })}
        onremove={(id) => removeVersion.mutate(id)}
        rowAction={{
          label: (item) =>
            releasedIds.has(item.id) ? m.tracker_version_unrelease() : m.tracker_version_release(),
          run: (item) => releaseVersion.mutate({ id: item.id, released: !releasedIds.has(item.id) }),
        }}
      />

      <PlanningList
        title={m.tracker_planning_labels()}
        description={m.tracker_planning_labels_hint()}
        items={labels}
        loading={labelsQuery.isPending}
        editable={canManage}
        addLabel={m.tracker_planning_label_add()}
        emptyLabel={m.tracker_planning_labels_empty()}
        onadd={(name) => addLabel.mutate(name)}
        onrename={(id, name) => renameLabel.mutate({ id, name })}
        onremove={(id) => removeLabel.mutate(id)}
      />
    </SettingsSection>
  {/if}
</SettingsPage>

<style>
.intake-link {
  margin: 0 0 8px;
  font-size: 12.5px;
  overflow-wrap: anywhere;
}
.intake-link code {
  font-family: var(--kern-font-mono);
}
.row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.note {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--kern-ink-400);
}
.state {
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 13px;
}
</style>
