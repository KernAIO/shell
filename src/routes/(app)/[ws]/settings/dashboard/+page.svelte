<script lang="ts">
import { Button, Card, Field, Icon, PageHeader, Select, toast } from '@kernhq/ui'
import { createMutation, createQuery, useQueryClient } from '@tanstack/svelte-query'
import { goto } from '$app/navigation'
import { page } from '$app/state'
import { getApi } from '$lib/api/client'
import { DEFAULT_PRESET_ID, PRESETS } from '$lib/dashboard/presets'
import { keys } from '$lib/query'
import { session } from '$lib/state/session.svelte'
import * as m from '$msg'

/**
 * How much of the home page a workspace decides for its members.
 *
 * The three modes are a spectrum of one question — may somebody rearrange their own home page — so
 * they are radio buttons with their consequence written underneath, not a switch whose meaning you
 * have to remember.
 */
const api = getApi()
const client = useQueryClient()

const slug = $derived(page.params.ws!)
const workspace = $derived(session.workspaces.find((w) => w.slug === slug))
const workspaceId = $derived(workspace?.id ?? '')

const query = createQuery(() => ({
  queryKey: keys.dashboardSettings(workspaceId),
  queryFn: () => api.dashboard.settings.get({ workspaceId, surface: 'home' }),
  enabled: Boolean(workspaceId),
}))

const save = createMutation(() => ({
  mutationFn: (input: { policy?: 'locked' | 'default' | 'open'; defaultPresetId?: string }) =>
    api.dashboard.settings.set({ workspaceId, surface: 'home', ...input }),
  onSuccess: () => {
    toast.success(m.dash_policy_saved())
    void client.invalidateQueries({ queryKey: ['core', 'dashboard'] })
  },
  onError: (e: unknown) => toast.error(e instanceof Error ? e.message : m.error_generic()),
}))

const policy = $derived(query.data?.policy ?? 'default')
const hasWorkspaceLayout = $derived(Boolean(query.data?.workspace))

const presetName = (id: string) =>
  ({
    'my-work': m.dash_preset_my_work(),
    delivery: m.dash_preset_delivery(),
    communication: m.dash_preset_communication(),
    focus: m.dash_preset_focus(),
  })[id] ?? id

const presetOptions = $derived(PRESETS.map((p) => ({ value: p.id, label: presetName(p.id) })))

const MODES = [
  { value: 'locked', label: () => m.dash_policy_locked(), hint: () => m.dash_policy_locked_hint() },
  { value: 'default', label: () => m.dash_policy_default(), hint: () => m.dash_policy_default_hint() },
  { value: 'open', label: () => m.dash_policy_open(), hint: () => m.dash_policy_open_hint() },
] as const

/**
 * Under `default` with a workspace layout set, the starting preset is never reached — members fall
 * back to the layout instead. A control that cannot affect anything is disabled with the reason,
 * rather than left there to be discovered.
 */
const presetUnused = $derived(policy === 'default' && hasWorkspaceLayout)
</script>

<svelte:head><title>{m.settings_dashboard()} · {workspace?.name ?? 'Kern'}</title></svelte:head>

<PageHeader title={m.settings_dashboard()} subtitle={m.dash_policy_title()} compact />

<div class="wrap">
  <Card>
    <fieldset>
      <legend class="sr">{m.dash_policy_title()}</legend>
      {#each MODES as mode (mode.value)}
        <label class="mode" class:on={policy === mode.value}>
          <input
            type="radio"
            name="dashboard-policy"
            value={mode.value}
            checked={policy === mode.value}
            disabled={save.isPending || query.isPending}
            onchange={() => save.mutate({ policy: mode.value })}
          />
          <span class="text">
            <span class="label">{mode.label()}</span>
            <span class="hint">{mode.hint()}</span>
          </span>
        </label>
      {/each}
    </fieldset>
  </Card>

  <Card>
    <Field
      label={m.dash_default_preset()}
      hint={presetUnused ? m.dash_default_preset_unused() : m.dash_default_preset_hint()}
    >
      {#snippet children(id)}
        <Select
          {id}
          value={query.data?.defaultPresetId ?? DEFAULT_PRESET_ID}
          options={presetOptions}
          disabled={presetUnused || save.isPending}
          onValueChange={(v) => save.mutate({ defaultPresetId: v })}
        />
      {/snippet}
    </Field>
  </Card>

  <Card>
    <div class="edit">
      <p>{m.dash_editing_workspace()}</p>
      <Button variant="secondary" onclick={() => goto(`/${slug}?edit=workspace`)}>
        <Icon name="layout-grid" size={15} />
        {m.dash_edit_workspace_layout()}
      </Button>
    </div>
  </Card>
</div>

<style>
  .wrap {
    display: grid;
    gap: 14px;
    max-width: 640px;
  }
  fieldset {
    display: grid;
    gap: 2px;
  }
  .mode {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    border-radius: var(--kern-r-lg);
    cursor: pointer;
  }
  .mode:hover {
    background: var(--kern-surface-hover);
  }
  .mode.on {
    background: var(--kern-accent-tint);
  }
  .mode input {
    margin-block-start: 2px;
    accent-color: var(--kern-accent);
  }
  .text {
    display: grid;
    gap: 2px;
  }
  .label {
    font-size: 13px;
    font-weight: 500;
    color: var(--kern-ink-900);
  }
  .hint {
    font-size: 12.5px;
    line-height: 1.45;
    color: var(--kern-ink-500);
  }
  .edit {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }
  .edit p {
    font-size: 12.5px;
    color: var(--kern-ink-500);
  }
  .sr {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
</style>
